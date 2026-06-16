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
-- ─────────────────────────────────────────────
insert into challenge_templates (
  id, name, category, description,
  easy_prompt, medium_prompt, hard_prompt,
  easy_vision_checks, medium_vision_checks, hard_vision_checks,
  condition_type, condition_config
) values

('red_door', 'Red Door', 'visual',
  'Find a red door',
  'Find any red door.',
  'Find a red door with brass or gold hardware — handle, knocker, or letterbox.',
  'Find a red door with brass hardware AND an odd street number. Both visible in one frame.',
  '[{"type":"object","target":"red door","confidence":0.85}]',
  '[{"type":"object","target":"red door","confidence":0.85},{"type":"object","target":"brass hardware","confidence":0.70}]',
  '[{"type":"object","target":"red door","confidence":0.85},{"type":"text","target":"odd number","confidence":0.75}]',
  null, null
),

('locked_up', 'Locked Up', 'visual',
  'Find a bicycle locked to something that isn''t a bike rack',
  'Find a bicycle locked to anything that isn''t a bike rack.',
  'Find a bicycle locked to a moving object — a gate, a shopping cart, a sign on a hinge.',
  'Find two bicycles locked together with no rack or post involved anywhere in the frame.',
  '[{"type":"object","target":"bicycle locked","confidence":0.82}]',
  '[{"type":"object","target":"bicycle locked moving object","confidence":0.78}]',
  '[{"type":"object","target":"two bicycles locked together","confidence":0.80}]',
  null, null
),

('cat_window', 'Cat in Window', 'visual',
  'Find a cat visible through a window',
  'Find a cat sitting in or looking through any window.',
  'Find a cat in a window above the ground floor. The floor number must be determinable from the frame.',
  'Find two cats visible in the same window at the same time.',
  '[{"type":"object","target":"cat window","confidence":0.88}]',
  '[{"type":"object","target":"cat window upper floor","confidence":0.85}]',
  '[{"type":"object","target":"two cats window","confidence":0.82}]',
  null, null
),

('faces_everywhere', 'Faces Everywhere', 'visual',
  'Find a face hidden in something inanimate — pareidolia',
  'Find a face in something inanimate — a drain cover, wall stain, building facade, car front, anything. The face must be unintentional.',
  'Find a face in something inanimate with two eyes AND a mouth all clearly visible. Still unintentional.',
  'Find three separate unintentional faces in three different objects, all in one photograph.',
  '[{"type":"label","target":"face pattern object","confidence":0.72}]',
  '[{"type":"label","target":"face eyes mouth object","confidence":0.75}]',
  '[{"type":"label","target":"multiple face patterns","confidence":0.70}]',
  null, null
),

('shadow_animal', 'Shadow Animal', 'light',
  'Make your shadow look like an animal',
  'Cast your shadow onto a flat surface and make it look like any animal. The animal must be recognizable.',
  'Make your shadow look like the specific animal named today. It must be unmistakable.',
  'Two people, one combined shadow. The shadow must form one recognizable animal.',
  '[{"type":"label","target":"shadow person","confidence":0.78}]',
  '[{"type":"label","target":"shadow animal shape","confidence":0.75}]',
  '[{"type":"label","target":"shadow two people combined","confidence":0.72}]',
  null, null
),

('accidental_twins', 'Accidental Twins', 'human',
  'Find two strangers wearing the same color',
  'Find two strangers wearing the same color top. They must not be together.',
  'Find two strangers dressed in the same color head to toe. Not together, not aware of each other.',
  'Find two strangers in identical outfits — same color, same type of garment — who are not together and do not know each other.',
  '[{"type":"label","target":"two people same color","confidence":0.78}]',
  '[{"type":"label","target":"two people matching outfits","confidence":0.75}]',
  '[{"type":"label","target":"two people identical clothing","confidence":0.72}]',
  null, null
),

('nature_wins', 'Nature Wins', 'nature',
  'Find a plant growing where it has no business being',
  'Find any plant growing through or out of concrete, asphalt, brick, or metal.',
  'Find a plant that has visibly cracked or displaced the surface it''s growing through.',
  'Find a plant taller than 50cm growing from a crack in a paved surface with no soil visible at its base.',
  '[{"type":"label","target":"plant concrete crack","confidence":0.82}]',
  '[{"type":"label","target":"plant breaking through pavement","confidence":0.80}]',
  '[{"type":"label","target":"tall plant pavement crack","confidence":0.78}]',
  null, null
),

('puddle_world', 'Puddle World', 'light',
  'Find a reflection in a puddle',
  'Find a puddle that reflects a building, sign, or structure above it.',
  'Find a puddle reflection that includes both the sky AND a building in the same reflection.',
  'Find a puddle reflection that includes a person who is not looking at the puddle. The person above and their reflection both visible.',
  '[{"type":"label","target":"puddle reflection","confidence":0.82}]',
  '[{"type":"label","target":"puddle sky building reflection","confidence":0.80}]',
  '[{"type":"label","target":"puddle person reflection","confidence":0.78}]',
  null, null
),

('the_word_broken', 'The Word: BROKEN', 'concept',
  'Find something broken',
  'Find something that is broken. The break must be clearly visible.',
  'Find something broken that has been repaired. Both the original break AND the repair must be visible.',
  'Find something that looks broken but still works perfectly. Photograph the evidence of both.',
  '[{"type":"label","target":"broken object","confidence":0.78}]',
  '[{"type":"label","target":"broken repaired object","confidence":0.75}]',
  '[{"type":"label","target":"damaged functional object","confidence":0.72}]',
  null, null
),

('the_word_lost', 'The Word: LOST', 'concept',
  'Find something lost or abandoned',
  'Find one object that has clearly been abandoned — left behind, forgotten, not placed intentionally.',
  'Find an abandoned object that has been there long enough to show signs of weathering.',
  'Find an abandoned object that has been partially reclaimed by nature — moss, rust, weeds, or weather transforming it.',
  '[{"type":"label","target":"abandoned object","confidence":0.78}]',
  '[{"type":"label","target":"weathered abandoned object","confidence":0.75}]',
  '[{"type":"label","target":"nature reclaimed object","confidence":0.72}]',
  null, null
),

('lucky_seven', 'Lucky Seven', 'visual',
  'Find the number 7 in the wild',
  'Find the number 7 anywhere — address, sign, price, anything.',
  'Find the number 7 appearing three times in one frame. Three separate 7s, no digital screens.',
  'Find the number 7 on three different materials in one frame — painted, metal, and stone for example.',
  '[{"type":"text","target":"number 7","confidence":0.88}]',
  '[{"type":"text","target":"three sevens","confidence":0.82}]',
  '[{"type":"text","target":"number 7 multiple materials","confidence":0.78}]',
  null, null
),

('falling_digit', 'Falling Digit', 'visual',
  'Find a door number with a crooked or loose digit',
  'Find any address number where at least one digit is visibly crooked, loose, upside-down, or missing.',
  'Find an address where two digits are misaligned in different ways.',
  'Find an address where every visible digit is a different style, font, or material — accumulated over time.',
  '[{"type":"text","target":"crooked address number","confidence":0.82}]',
  '[{"type":"text","target":"misaligned address digits","confidence":0.78}]',
  '[{"type":"text","target":"mixed style address numbers","confidence":0.75}]',
  null, null
),

('stranger_choice', 'Stranger''s Choice', 'human',
  'Ask a stranger to point in a direction — photograph what you find',
  'Walk up to the first stranger you see. Ask them to point in any direction. Walk that way for 3 minutes. Photograph exactly what''s in front of you when the timer hits zero.',
  'Ask a stranger to describe their favourite hidden spot in the city. Find it. Photograph it.',
  'Ask three different strangers to each give you one direction (left/right/straight) in sequence. Follow all three. Photograph where you end up.',
  '[{"type":"label","target":"street urban scene","confidence":0.72}]',
  '[{"type":"label","target":"city location","confidence":0.70}]',
  '[{"type":"label","target":"urban destination","confidence":0.68}]',
  null, null
),

('spell_it', 'Spell It', 'creative',
  'Spell a word using letters found on signs',
  'Spell a 3-letter word using individual letters found on signs, doors, or any surface. One photo per letter.',
  'Spell a 4-letter word. Each letter must be a different color.',
  'Spell a 5-letter word. All letters found within a single continuous 200m walk. No backtracking.',
  '[{"type":"text","target":"letter sign","confidence":0.85}]',
  '[{"type":"text","target":"colored letter sign","confidence":0.82}]',
  '[{"type":"text","target":"letter found walking","confidence":0.80}]',
  null, null
),

('golden_hour', 'Golden Hour', 'light',
  'Capture something in golden hour light',
  'Find any object or surface bathed in direct golden hour light — warm, low, directional sunlight.',
  'Find one object completely in golden light while everything immediately around it is in shade.',
  'Capture a person''s shadow during golden hour when the shadow is at least 3x longer than they are tall.',
  '[{"type":"label","target":"golden light sunset","confidence":0.80}]',
  '[{"type":"label","target":"object golden light shadow","confidence":0.78}]',
  '[{"type":"label","target":"long shadow golden hour","confidence":0.75}]',
  'time_window', '{"time_type": "golden_hour", "window_minutes": 60}'
),

('wet_city', 'WET', 'light',
  'Rain-only challenge — capture the wet city',
  'Find a puddle that reflects something that doesn''t exist above it — a reflection of the sky showing buildings that aren''t there from your angle.',
  'Find a rain-covered window that turns the view outside into something abstract. The image through the glass must be unrecognizable.',
  'Find a person who looks completely at home in the rain — not running, not sheltering, just being in it. Their expression must be visible.',
  '[{"type":"label","target":"puddle rain reflection","confidence":0.82}]',
  '[{"type":"label","target":"rain window abstract","confidence":0.78}]',
  '[{"type":"label","target":"person rain calm","confidence":0.75}]',
  'weather', '{"condition": "rain", "min_mm": 0.5}'
),

('empty_stage', 'Empty Stage', 'light',
  'Night-only — find a place built for crowds with nobody in it',
  'After 9pm, find any public space built for many people — a square, a market, a sports court — completely empty.',
  'After 9pm, photograph an empty public space where the lighting is still on as if expecting a crowd.',
  'After 9pm, find a space built for more than 100 people with absolutely nobody visible in any direction.',
  '[{"type":"label","target":"empty public space night","confidence":0.80}]',
  '[{"type":"label","target":"empty illuminated public space","confidence":0.78}]',
  '[{"type":"label","target":"large empty public space","confidence":0.75}]',
  'time_window', '{"start_hour": 21, "end_hour": 23}'
);
