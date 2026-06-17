-- 006_challenge_templates.sql
-- Challenge template system: category enum, challenge_templates table,
-- updates to challenges, new badge definitions, and seeded templates.

-- ─────────────────────────────────────────────
-- CHALLENGE CATEGORY ENUM
-- ─────────────────────────────────────────────
create type challenge_category as enum (
  'visual',    -- color, shape, symmetry, faces, gradient
  'concept',   -- the word, out of place, ghost
  'human',     -- accidental twins, mirror, stranger
  'nature',    -- nature wins, crack, wild animal
  'light',     -- shadow, reflection, golden hour
  'movement',  -- walk north, coin flip, the end
  'creative',  -- spell it, before & after
  'special'    -- legendary, chain unlock, tournament
);

-- ─────────────────────────────────────────────
-- CHALLENGE TEMPLATES
-- Library of reusable challenge definitions.
-- vision_checks columns are arrays of check objects evaluated by the
-- AI scoring layer: { type, target, confidence }.
-- condition_type: 'weather' | 'time_window' | null
-- condition_config: free-form JSONB consumed by the scheduler.
-- ─────────────────────────────────────────────
create table challenge_templates (
  id                    text primary key,  -- e.g. 'red_door', 'accidental_twins'
  name                  text not null,
  category              challenge_category not null,
  description           text not null,
  easy_prompt           text not null,
  medium_prompt         text not null,
  hard_prompt           text not null,
  easy_vision_checks    jsonb not null default '[]',
  medium_vision_checks  jsonb not null default '[]',
  hard_vision_checks    jsonb not null default '[]',
  condition_type        text,   -- 'weather' | 'time_window' | null
  condition_config      jsonb,
  is_rare               boolean default false,  -- legendary / condition-locked
  cooldown_days         integer default 7,       -- minimum days before repeating
  created_at            timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CHALLENGES TABLE ADDITIONS
-- ─────────────────────────────────────────────
alter table challenges
  add column if not exists template_id          text references challenge_templates(id),
  add column if not exists category             challenge_category,
  add column if not exists drop_time            timestamptz,   -- random daily drop time
  add column if not exists is_chain_unlock      boolean default false,
  add column if not exists is_tournament_round  boolean default false,
  add column if not exists is_legendary         boolean default false;

-- ─────────────────────────────────────────────
-- BADGE DEFINITIONS — social / competitive mechanics
-- ─────────────────────────────────────────────
insert into badge_definitions (id, name, description, emoji, rarity, trigger_config) values
  ('crew_founder',          'Crew Founder',         'Founded a crew.',                              '🫂', 'common',    '{"condition_type": "crew_founded"}'),
  ('city_builder',          'City Builder',          'Invited 10 players to your city.',             '🏗️', 'rare',      '{"condition_type": "invite_count", "count": 10}'),
  ('city_architect',        'City Architect',        'Invited 25 players to your city.',             '🏛️', 'rare',      '{"condition_type": "invite_count", "count": 25}'),
  ('legend_maker',          'Legend Maker',          'Invited 50 players to your city.',             '🌆', 'legendary', '{"condition_type": "invite_count", "count": 50}'),
  ('duel_winner',           'Duel Winner',           'Won your first duel.',                         '⚔️', 'common',    '{"condition_type": "duel_win", "count": 1}'),
  ('duel_champion',         'Duel Champion',         'Won 10 duels.',                                '🏅', 'rare',      '{"condition_type": "duel_win", "count": 10}'),
  ('expedition_planter',    'Expedition Planter',    'Planted your first expedition flag.',          '🚩', 'common',    '{"condition_type": "expedition_planted"}'),
  ('expedition_hunter',     'Expedition Hunter',     'Found 5 expedition flags.',                    '🗺️', 'rare',      '{"condition_type": "expedition_found", "count": 5}'),
  ('relay_link',            'Chain Link',            'Contributed to a relay chain.',                '⛓️', 'common',    '{"condition_type": "relay_contribution"}'),
  ('tournament_winner',     'Tournament Winner',     'Won a tournament.',                            '🏆', 'legendary', '{"condition_type": "tournament_win"}'),
  ('legendary_hunter',      'Legendary Hunter',      'Completed a Legendary event.',                 '⚡', 'legendary', '{"condition_type": "legendary_complete"}'),
  ('parallel_life',         'Parallel Life',         'Matched with a player in another city.',       '🌍', 'common',    '{"condition_type": "parallel_lives_match"}')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- SEED CHALLENGE TEMPLATES
-- These are ACTION-based dares. The photo is proof of the dare,
-- not the dare itself. Difficulty escalates the actual stakes.
-- ─────────────────────────────────────────────
insert into challenge_templates (
  id, name, category, description,
  easy_prompt, medium_prompt, hard_prompt,
  easy_vision_checks, medium_vision_checks, hard_vision_checks,
  condition_type, condition_config
) values

('open_source', 'OPEN SOURCE', 'human',
  'Give up creative control. A stranger decides what you photograph.',
  'Walk up to anyone and ask: "What should I photograph right now?" Follow their instructions exactly. No editing their answer.',
  'Ask someone who looks like they''d have no interest in photography. Follow their instructions without deviation, however mundane.',
  'Ask three strangers. Get three completely different answers. Combine all three into one photograph.',
  '[{"type":"label","target":"urban scene stranger direction","confidence":0.65}]',
  '[{"type":"label","target":"ordinary urban subject","confidence":0.62}]',
  '[{"type":"label","target":"combined urban elements","confidence":0.62}]',
  null, null
),

('the_tail', 'THE TAIL', 'human',
  'Surveillance mission. Follow someone. Photograph where they go.',
  'Pick anyone walking with purpose in a public space. Follow for exactly 60 seconds. Photograph where they stopped.',
  'Follow without being noticed. If they look back at any point, the mission is burned — start again with someone new.',
  'Follow three different people, 60 seconds each, across one outing. Find what all three of their destinations have in common.',
  '[{"type":"label","target":"pedestrian street destination","confidence":0.70}]',
  '[{"type":"label","target":"candid street scene","confidence":0.68}]',
  '[{"type":"label","target":"urban location people","confidence":0.65}]',
  null, null
),

('dead_drop', 'DEAD DROP', 'creative',
  'Leave something. Watch someone find it.',
  'Leave a small object — a coin, a folded note, a stone — somewhere unusual. Photograph it in place before anyone takes it.',
  'Leave a note with a single instruction on it. Stay nearby. Photograph the first person who finds it.',
  'Set up a chain: leave an object, watch someone find it, follow them briefly, photograph where it ends up next.',
  '[{"type":"label","target":"object placed urban location","confidence":0.72}]',
  '[{"type":"label","target":"person found object","confidence":0.68}]',
  '[{"type":"label","target":"object new location","confidence":0.65}]',
  null, null
),

('burn_notice', 'BURN NOTICE', 'movement',
  'The moment you notice something interesting, the clock starts. 90 seconds. Then you move on forever.',
  'Spot anything that catches your eye. Start a 90-second timer. Photograph it once, any angle — then walk away. No going back.',
  'Do this 3 times in one outing. Keep moving between each. No two subjects can be within 100m of each other.',
  'Do this 5 times. All 5 shots must tell a coherent story when seen together. You can''t plan it — the story emerges from what you find.',
  '[{"type":"label","target":"urban scene candid","confidence":0.70}]',
  '[{"type":"label","target":"street photography multiple","confidence":0.68}]',
  '[{"type":"label","target":"urban series narrative","confidence":0.65}]',
  null, null
),

('cover_story', 'COVER STORY', 'creative',
  'You''re not yourself today. Photograph as your character.',
  'Pick a role — delivery driver, architect, tourist, detective. Photograph one thing that role would notice that you normally wouldn''t.',
  'Spend 10 minutes in any space completely in character. Document three things your character would never miss.',
  'Two completely different characters, same location, same 10 minutes. The two sets of photos must look like different people shot them.',
  '[{"type":"label","target":"urban detail specific perspective","confidence":0.68}]',
  '[{"type":"label","target":"location multiple details","confidence":0.65}]',
  '[{"type":"label","target":"contrasting perspectives same place","confidence":0.62}]',
  null, null
),

('the_asset', 'THE ASSET', 'human',
  'Find the most interesting person nearby. One shot. Don''t get caught.',
  'Find the most interesting-looking person in your immediate vicinity. Photograph them candidly — no posing, no asking.',
  'Photograph them in a way that communicates who they are without showing their face. The image must be immediately readable as a person.',
  'Make eye contact with them after you shoot. If they ask what you saw in them, tell them honestly. Photograph their reaction.',
  '[{"type":"label","target":"candid person portrait","confidence":0.75}]',
  '[{"type":"label","target":"person without face urban","confidence":0.72}]',
  '[{"type":"label","target":"person reaction portrait","confidence":0.70}]',
  null, null
),

('coin_flip', 'COIN FLIP', 'movement',
  'Heads = left. Tails = right. 5 flips. No deviations.',
  'Flip a coin at every intersection for 5 intersections. Follow the result every time. Photograph where you end up.',
  '8 flips. No stopping, no shortcuts, no "that one doesn''t count." Whatever is directly in front of you at flip 8 is your subject.',
  '10 flips, starting from somewhere you''ve never been. The destination is the mission. Make the photograph worth the journey.',
  '[{"type":"label","target":"urban street destination","confidence":0.70}]',
  '[{"type":"label","target":"street intersection destination","confidence":0.68}]',
  '[{"type":"label","target":"urban location discovered","confidence":0.65}]',
  null, null
),

('last_transmission', 'LAST TRANSMISSION', 'concept',
  'Find something ending. Photograph the final moment before it''s gone.',
  'Find something visibly closing down — a market packing up, a shop shuttering, a light going out. Photograph the last moment.',
  'Find something in its final state before permanent transformation — a building before demolition, a place before it changes forever.',
  'Find it before anyone else notices it''s ending. Your photograph must function as the first documentation of its final state.',
  '[{"type":"label","target":"closing business storefront","confidence":0.75}]',
  '[{"type":"label","target":"building demolition transformation","confidence":0.72}]',
  '[{"type":"label","target":"ending moment urban","confidence":0.68}]',
  null, null
),

('the_invite', 'THE INVITE', 'human',
  'Ask a stranger to show you something they love about this place.',
  'Walk up to anyone and ask: "What''s your favourite thing about this area?" Follow them to it. Photograph what they show you.',
  'Ask someone who looks like they''ve been here forever — a shopkeeper, a regular, an elder. Go exactly where they send you.',
  'Ask three different people. Find the overlap — the one thing all three point toward without knowing each other.',
  '[{"type":"label","target":"local place detail","confidence":0.70}]',
  '[{"type":"label","target":"neighbourhood hidden detail","confidence":0.68}]',
  '[{"type":"label","target":"shared urban landmark","confidence":0.65}]',
  null, null
),

('portrait_tax', 'PORTRAIT TAX', 'human',
  'Ask a stranger if you can take their portrait. Keep asking until someone says yes.',
  'Ask the first person you see. If they say no, ask the next. Stop at the first yes. One shot, that''s the submission.',
  'Ask 5 people. Photograph only those who said yes immediately — no convincing. The edit starts with who''s brave enough.',
  'Ask 10 people in a row. Photograph everyone who said yes. Their collective willingness is the image.',
  '[{"type":"label","target":"portrait person","confidence":0.82}]',
  '[{"type":"label","target":"willing portrait subject","confidence":0.80}]',
  '[{"type":"label","target":"multiple portraits series","confidence":0.75}]',
  null, null
),

('synchronized', 'SYNCHRONIZED', 'human',
  'Two strangers, same action, same frame. Neither knows.',
  'Find two people performing the same basic action simultaneously — checking phone, waiting, eating — and get them in one frame.',
  'Find two strangers in identical body language who are completely unaware of each other. The mirroring must be unmistakable.',
  'Three strangers, same action, same frame. No interaction between them. Pure coincidence that you turned into an image.',
  '[{"type":"label","target":"two people same action","confidence":0.75}]',
  '[{"type":"label","target":"mirrored body language strangers","confidence":0.72}]',
  '[{"type":"label","target":"three people synchronized","confidence":0.68}]',
  null, null
),

('field_report', 'FIELD REPORT', 'creative',
  'Tell the story of where you are right now. Exactly 3 frames. No explanation.',
  'Three photographs that together tell a complete story about this place — before, during, after, or any three-act structure.',
  'Three photographs where each reveals something the previous one deliberately hid. Sequence matters.',
  'Three photographs that work as beginning, middle, or end in any order. Rearranging them should change the story completely.',
  '[{"type":"label","target":"urban scene storytelling","confidence":0.68}]',
  '[{"type":"label","target":"urban narrative sequence","confidence":0.65}]',
  '[{"type":"label","target":"ambiguous narrative frames","confidence":0.62}]',
  null, null
),

('blackout', 'BLACKOUT', 'movement',
  'No screen. No map. Walk on instinct. Photograph where you stop.',
  'Phone in your pocket. Walk 5 minutes following only your gut — turn when you feel like it. Photograph exactly where you are at minute 5.',
  'Walk 10 minutes. Turn at every intersection that pulls you, never the logical one. Photograph your destination.',
  'Walk 15 minutes with no screen, no plan, no hesitation at crossroads. Wherever you stop is the mission. Make it worth stopping there.',
  '[{"type":"label","target":"urban location discovered","confidence":0.68}]',
  '[{"type":"label","target":"unexpected urban destination","confidence":0.65}]',
  '[{"type":"label","target":"instinct destination urban","confidence":0.62}]',
  null, null
),

('the_handoff', 'THE HANDOFF', 'human',
  'Give your phone to a stranger. 30 seconds. Whatever they photograph is your submission.',
  'Hand your phone to the nearest stranger. Say: "You have 30 seconds. Take one photo of anything." That photo is your submission.',
  'Give it to someone who looks like they''d take something completely unexpected. No instructions. Their 30 seconds, their vision.',
  'Give your phone to three different strangers, 30 seconds each. Submit all three. Three people''s unfiltered view of your world.',
  '[{"type":"label","target":"candid photo stranger perspective","confidence":0.68}]',
  '[{"type":"label","target":"unexpected subject photograph","confidence":0.65}]',
  '[{"type":"label","target":"multiple stranger perspectives","confidence":0.62}]',
  null, null
),

('the_signal', 'THE SIGNAL', 'concept',
  'Find something trying to communicate. Photograph what it''s saying.',
  'Find anything sending a message — a broken sign, a faded arrow, a locked door with a warning. Photograph what it''s actually saying.',
  'Find something communicating something its makers never intended. The gap between purpose and meaning is the image.',
  'Find three things in one frame that each communicate something different and contradictory. All three visible, all three legible.',
  '[{"type":"label","target":"sign message communication","confidence":0.75}]',
  '[{"type":"label","target":"unintended message urban","confidence":0.68}]',
  '[{"type":"label","target":"contradictory messages frame","confidence":0.65}]',
  null, null
),

('control_room', 'CONTROL ROOM', 'concept',
  'Find the thing in your immediate environment that controls the most. Photograph it.',
  'Find any panel, switch, button, or screen that operates something in the world around you.',
  'Find something that controls far more than it looks like it should. The gap between size and consequence is the image.',
  'Find the most consequential thing nobody is watching. Unmanned, unguarded, controlling something significant.',
  '[{"type":"label","target":"control panel switch","confidence":0.78}]',
  '[{"type":"label","target":"infrastructure control system","confidence":0.72}]',
  '[{"type":"label","target":"unattended control infrastructure","confidence":0.68}]',
  null, null
),

('golden_static', 'GOLDEN STATIC', 'light',
  'Night-only — find a light that has no business still being on',
  'After 9pm, find a light that''s on in a space that looks completely abandoned or closed.',
  'After 9pm, find a single warm light source surrounded by cold darkness — one lit window in an otherwise dark block.',
  'After 9pm, find a light with no visible power source, no attached building, and nobody maintaining it.',
  '[{"type":"label","target":"light night abandoned","confidence":0.75}]',
  '[{"type":"label","target":"warm light cold night","confidence":0.72}]',
  '[{"type":"label","target":"isolated light source night","confidence":0.70}]',
  'time_window', '{"start_hour": 21, "end_hour": 4}'
),

('wet_mirror', 'WET MIRROR', 'light',
  'Rain only — find a reflection more interesting than what it reflects',
  'Find a puddle where the reflection is more visually compelling than the street above it.',
  'Find a rain-streaked window where the view through the glass has become completely abstract. The original scene must be unrecognizable.',
  'Find a flooded surface where a person''s reflection is more detailed, more dramatic, or more real than the person standing above.',
  '[{"type":"label","target":"puddle rain reflection","confidence":0.82}]',
  '[{"type":"label","target":"rain distorted window abstract","confidence":0.78}]',
  '[{"type":"label","target":"rain reflection person dramatic","confidence":0.75}]',
  'weather', '{"condition": "rain", "min_mm": 0.5}'
);
