-- =============================================================
-- DARE — seed data
-- Run after 001_initial.sql
-- =============================================================

-- -------------------------------------------------------------
-- 1. CITIES
-- -------------------------------------------------------------
insert into cities (id, name, country, timezone, lat, lng)
values
  ('a1000000-0000-0000-0000-000000000001', 'Tel Aviv',  'Israel',         'Asia/Jerusalem',  32.0853,  34.7818),
  ('a1000000-0000-0000-0000-000000000002', 'London',    'United Kingdom',  'Europe/London',   51.5074,  -0.1278);

-- -------------------------------------------------------------
-- 2. BADGE DEFINITIONS
-- -------------------------------------------------------------
insert into badge_definitions (id, name, description, emoji, rarity, trigger_config)
values
  (
    'waterproof',
    'Waterproof',
    'Completed a rain challenge.',
    '🌧️',
    'rare',
    '{"condition_type": "weather", "weather_condition": "rain"}'
  ),
  (
    'lightning',
    'Lightning',
    'Submitted a photo in under 5 minutes of the challenge going live.',
    '⚡',
    'common',
    '{"condition_type": "speed", "max_seconds_after_open": 300}'
  ),
  (
    'early_bird',
    'Early Bird',
    'First submission in your city today.',
    '🐦',
    'common',
    '{"condition_type": "rank", "city_rank": 1}'
  ),
  (
    'streak_7',
    '7-Day Streak',
    'Maintained a 7-day submission streak.',
    '🔥',
    'common',
    '{"condition_type": "streak", "streak_value": 7}'
  ),
  (
    'streak_30',
    '30-Day Streak',
    'Maintained a 30-day submission streak.',
    '🏅',
    'rare',
    '{"condition_type": "streak", "streak_value": 30}'
  ),
  (
    'perfectionist',
    'Perfectionist',
    'Received 100% AI confidence on a submission.',
    '💯',
    'rare',
    '{"condition_type": "vision_confidence", "min_confidence": 1.0}'
  ),
  (
    'night_owl',
    'Night Owl',
    'Submitted a photo after 10 PM local time.',
    '🦉',
    'common',
    '{"condition_type": "time_of_day", "after_hour": 22}'
  ),
  (
    'explorer',
    'Explorer',
    'Submitted in 10 different challenge archetypes.',
    '🗺️',
    'rare',
    '{"condition_type": "archetype_variety", "min_archetypes": 10}'
  ),
  (
    'legend_tier',
    'Legend Tier',
    'Completed a hard-difficulty challenge.',
    '👑',
    'rare',
    '{"condition_type": "difficulty", "difficulty": "hard"}'
  );

-- -------------------------------------------------------------
-- 3. CHALLENGES  (7 days × 2 cities, one archetype per day)
--
--    Archetype rotation:
--      2026-06-10  detective
--      2026-06-11  sprint
--      2026-06-12  hyperlocal
--      2026-06-13  narrative
--      2026-06-14  social
--      2026-06-15  detail
--      2026-06-16  condition_lock
--
--    active_from  = 07:00 city-local time (stored as UTC)
--    active_until = 00:00 next day city-local time (stored as UTC)
--
--    Tel Aviv UTC offset  = +03:00 (Asia/Jerusalem, summer)
--    London  UTC offset  = +01:00 (Europe/London, BST, summer)
-- -------------------------------------------------------------

DO $$
declare
  tlv_id uuid := 'a1000000-0000-0000-0000-000000000001';
  ldn_id uuid := 'a1000000-0000-0000-0000-000000000002';
begin

  -- ===========================================================
  -- TEL AVIV
  -- active_from 07:00 IST = 04:00 UTC
  -- active_until 00:00 IST next day = 21:00 UTC
  -- ===========================================================

  -- 2026-06-10  detective
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-10', 'detective', 'ai_vision',
    jsonb_build_object(
      'challenge_narrative', 'Tel Aviv is a city built on sand and ambition. The founding generation left evidence everywhere — if you know what you''re looking for.',
      'title', 'Find any Hebrew inscription carved or cast into stone on a building exterior that predates Israel''s founding in 1948. A cornerstone, a dedication, a foundation plaque. Photograph it so the text is legible.',
      'hint', 'Look above doorframes on old civic and residential buildings between Allenby and Ben Gurion.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a Mandate-era foundation stone (1920–1948) on a public or civic building — not a private home — with the date of laying visible in the stonework.',
      'hint', 'Schools, cultural centres, and community buildings from this era often recorded cornerstone ceremonies in stone.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find a Mandate-era foundation stone with a date, a Hebrew inscription, AND a carved symbol — Magen David, menorah, or palm — all in the same stone. The building must still serve its original purpose.',
      'hint', 'Old schools and synagogues in the Bauhaus district are your best chance.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "text", "target": "Hebrew inscription stone", "confidence": 0.78}]',
    '2026-06-10 04:00:00+00', '2026-06-10 21:00:00+00'
  );

  -- 2026-06-11  sprint
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-11', 'sprint', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'The Mediterranean has been waiting. You have until midnight — but the best shots go to those who move.',
      'title', 'Get to any Tel Aviv beach. Photograph the exact moment water meets sand. Horizon mandatory. Shoes optional.',
      'hint', 'Gordon, Frishman, or Hilton beach — any will do, just show the sea.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a numbered lifeguard tower with both the tower number and the waterline visible in the same frame. There are 20 of them.',
      'hint', 'Numbers are painted on the side of each tower; face the sea so the number and water appear together.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Photograph a lifeguard tower number, a red warning flag flying from it, and a breaking wave — all in one frame, shot from dry sand.',
      'hint', 'Red flags go up on rough days; position yourself side-on to the tower so flag, number, and wave align.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "beach sea water", "confidence": 0.82}, {"type": "object", "target": "lifeguard tower", "confidence": 0.75}]',
    '2026-06-11 04:00:00+00', '2026-06-11 21:00:00+00'
  );

  -- 2026-06-12  hyperlocal
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-12', 'hyperlocal', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'HaCarmel Market has been selling the same things for a hundred years. The vendors know things the city doesn''t put on maps.',
      'title', 'Enter HaCarmel Market. Ask a vendor — in any language — what their best thing is today. Buy it or don''t. Photograph whatever they show you, in their hands.',
      'hint', 'Any stall works. The ask is the challenge.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a spice vendor inside HaCarmel and ask them to show you their rarest or oldest spice. Photograph the open container with the vendor''s hands visible.',
      'hint', 'Spice stalls cluster in the middle section, past the produce and before the clothing.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find a vendor who can tell you their family has been on this specific stall for more than one generation. Ask for proof — a photo, a sign, a name. Photograph the evidence.',
      'hint', 'Older family stalls are deeper in the market; look for hand-painted Hebrew signs rather than printed vinyl.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "market stall food", "confidence": 0.78}, {"type": "text", "target": "Hebrew text sign", "confidence": 0.70}]',
    '2026-06-12 04:00:00+00', '2026-06-12 21:00:00+00'
  );

  -- 2026-06-13  narrative
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-13', 'narrative', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'In 2003, UNESCO made it official. Walk outside. You are already in one of the greatest collections of Bauhaus architecture on earth.',
      'title', 'Find any White City building with a UNESCO or National Heritage plaque on its facade. The plaque must be legible. The building''s architecture must be visible in the same frame.',
      'hint', 'Rothschild Boulevard between numbers 1 and 89 is the densest concentration.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a Bauhaus building where the original pilotis — the columns lifting the structure off the ground — still form an open shaded passage underneath. Photograph from within, looking up.',
      'hint', 'Dizengoff and Bialik streets have the most intact pilotis; the ground floor should be open, not enclosed.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find one White City building with three original features surviving: its ceramic address tile, at least one porthole or ribbon window, and functioning open pilotis. All three in your photograph. No retrofits.',
      'hint', 'Bialik and Engel streets have the highest survival of original ceramic tiles; corner buildings are best for portholes.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "Bauhaus building architecture", "confidence": 0.80}, {"type": "object", "target": "heritage plaque", "confidence": 0.72}]',
    '2026-06-13 04:00:00+00', '2026-06-13 21:00:00+00'
  );

  -- 2026-06-14  social
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-14', 'social', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Agam''s fountain at Dizengoff Square runs its color cycles whether anyone is watching or not. Today, make sure someone is watching.',
      'title', 'Go to Dizengoff Square. Stand with Agam''s kinetic fountain. Take a photograph — yourself and the fountain, both clearly visible.',
      'hint', 'The fountain is at the center of the circular square where Dizengoff crosses Pinkas.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'At Agam''s fountain, approach three strangers and bring all four of you — plus the fountain — into one photograph. You have to ask. They have to say yes.',
      'hint', 'People sitting on the surrounding benches are the most approachable.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Recruit six strangers at Dizengoff Square — none who knew each other before today — in front of Agam''s fountain while the water jets are running. Every face visible. You have one hour.',
      'hint', 'Come during an active water cycle and approach groups, not individuals.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "object", "target": "fountain sculpture", "confidence": 0.78}, {"type": "label", "target": "people crowd", "confidence": 0.75}]',
    '2026-06-14 04:00:00+00', '2026-06-14 21:00:00+00'
  );

  -- 2026-06-15  detail
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-15', 'detail', 'ai_vision',
    jsonb_build_object(
      'challenge_narrative', 'Jaffa was ancient when Tel Aviv was sand. Walk south. The stones remember things the newer city has already forgotten.',
      'title', 'In Jaffa, find any carved stone detail — a lintel, archway, or capital — that clearly predates the twentieth century. Get close enough that the individual chisel marks are visible in your photograph.',
      'hint', 'The streets between the clock tower and the flea market are dense with Ottoman stonework — look above modern shopfronts.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'In Jaffa, find carved stone with a recognizable motif — geometric, floral, crescent, or Star of David — cut into the original construction material. The motif must be in the stone itself, not painted or applied.',
      'hint', 'Yefet Street and the alleys around the Mahmoudiya Mosque have the densest carved stonework.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'In Jaffa, find a stone inscription — Ottoman Turkish, Arabic, or Hebrew — carved into original construction material and still legible enough to attempt to read. Photograph it so individual characters are distinguishable.',
      'hint', 'Foundation stones and commemorative inscriptions sit above main entrances or in corner walls; the area around the old serai has intact examples.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "carved stone architecture", "confidence": 0.80}, {"type": "text", "target": "inscription lettering", "confidence": 0.68}]',
    '2026-06-15 04:00:00+00', '2026-06-15 21:00:00+00'
  );

  -- 2026-06-16  condition_lock
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, condition_type, condition_config,
      active_from, active_until)
  values (
    gen_random_uuid(), tlv_id, '2026-06-16', 'condition_lock', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Tel Aviv before 10am is a different city. The light comes in low, the sea is still cool, and the city hasn''t started pretending yet. This challenge disappears when the morning does.',
      'title', 'Before 10am, find an outdoor table facing the sea and photograph a coffee with the Mediterranean behind it. The sea doesn''t have to be close. It just has to be there.',
      'hint', 'Promenade cafés between the marina and Herbert Samuel Street put tables out before 7am.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Before 10am, photograph a coffee and a Hebrew-language print item — newspaper, receipt, or menu — on the same outdoor table, with the sea visible behind it.',
      'hint', 'Free daily newspapers are stacked at café entrances in the morning; a receipt with today''s date works equally well.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Before 10am, photograph a coffee, a Hebrew print item with today''s date, and the sun low enough that its reflection is visible on the sea behind it. The reflection means you came early enough.',
      'hint', 'The reflection disappears by 8:30am; arrive closer to 6am than 9am.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "object", "target": "coffee cup", "confidence": 0.85}, {"type": "label", "target": "sea ocean water", "confidence": 0.80}]',
    'time_window',
    '{"start_hour": 6, "end_hour": 10, "description": "Only unlocked between 06:00 and 10:00 local time"}',
    '2026-06-16 04:00:00+00', '2026-06-16 21:00:00+00'
  );


  -- ===========================================================
  -- LONDON
  -- active_from 07:00 BST = 06:00 UTC
  -- active_until 00:00 BST next day = 23:00 UTC
  -- ===========================================================

  -- 2026-06-10  detective
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-10', 'detective', 'ai_vision',
    jsonb_build_object(
      'challenge_narrative', 'London marks the dead. It marks where they lived, worked, and what they made. The city is covered in small blue declarations. Most people walk past them every day.',
      'title', 'Find any English Heritage blue plaque — the circular ones reading "[Name] lived here" — and photograph it on its building. Every street in Zone 1 has one. The name must be legible.',
      'hint', 'Bloomsbury, Marylebone, and Chelsea have the highest density; look on the first or second floor of terraced townhouses.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a blue Heritage plaque for someone you''ve actually heard of — a writer, an artist, a scientist — and photograph it with the building''s facade clearly visible behind it.',
      'hint', 'Keats, Dickens, Darwin, Handel — all have plaques in central London; the LCC blue plaque map lists them by postcode.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find a blue Heritage plaque on a building currently used for something entirely different from what the commemorated person did there. A writer''s home now a restaurant. A composer''s studio now an office. The contrast is the point. Plaque and current use must both be visible.',
      'hint', 'The irony is common in Soho, Fitzrovia, and the City — areas where Victorian residential streets became commercial.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "object", "target": "blue heritage plaque", "confidence": 0.85}, {"type": "text", "target": "name inscription", "confidence": 0.78}]',
    '2026-06-10 06:00:00+00', '2026-06-10 23:00:00+00'
  );

  -- 2026-06-11  sprint
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-11', 'sprint', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'The Thames has thirty-three bridges. You need one. Move.',
      'title', 'Get to the Thames and photograph the river with open water visible in both directions. You don''t need a bridge. You just need the river.',
      'hint', 'Any point on the South Bank between Waterloo and Tower Bridge gives clear open water in both directions.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'From the Thames bank, photograph a bridge so its name is legible — on a nameplate, a sign, or a cast marker — with the bridge structure visible in the same frame.',
      'hint', 'Most Thames bridges carry name plaques at both ends on the pedestrian walkway; the south approach to Waterloo Bridge is particularly clear.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find a spot where a bridge''s reflection sits perfectly still in the Thames — the arch appearing twice, above and below the waterline. No motion blur. No wake in the frame.',
      'hint', 'Reflections are sharpest before river traffic builds; the stretch between Waterloo and Blackfriars on the north bank holds mirror conditions longest.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "river bridge water", "confidence": 0.82}, {"type": "object", "target": "bridge reflection", "confidence": 0.72}]',
    '2026-06-11 06:00:00+00', '2026-06-11 23:00:00+00'
  );

  -- 2026-06-12  hyperlocal
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-12', 'hyperlocal', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Leadenhall Market has been a trading site since the fourteenth century. The City of London grew up around it. The market remains unconvinced it should care.',
      'title', 'Enter Leadenhall Market and photograph the central dome crossing — where the four covered avenues meet. Cobblestones, iron structure, painted ceiling. All visible.',
      'hint', 'Any of the four entrances leads directly to the crossing; the Gracechurch Street entrance is the main approach.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Inside Leadenhall, find any trader who has been there for more than twenty years. Find evidence — a date on signage, a framed history, a staff member who confirms it. Photograph the proof.',
      'hint', 'Older independent traders are in the inner sections away from Gracechurch Street; non-chain businesses with traditional signage.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Inside Leadenhall Market, find the most intricate piece of original Victorian ironwork you can locate — a column capital, a decorative bracket, a spandrel — and photograph it close enough that the individual cast elements are distinguishable. Original only, not restored reproduction.',
      'hint', 'The most detailed ironwork is in the column capitals at the central crossing and in the spandrels where the arcade ribs meet the columns; look up.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "Victorian market interior", "confidence": 0.80}, {"type": "object", "target": "cast iron architecture", "confidence": 0.75}]',
    '2026-06-12 06:00:00+00', '2026-06-12 23:00:00+00'
  );

  -- 2026-06-13  narrative
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-13', 'narrative', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Giles Gilbert Scott designed the red telephone box in 1924. He also designed Battersea Power Station. The British refuse to throw away beautiful things — though they have stopped making phone calls in them.',
      'title', 'Find a red telephone box being used for something other than a telephone. A library, a defibrillator, a coffee kiosk, a gallery. Photograph it with the new purpose clearly visible inside.',
      'hint', 'Repurposed boxes cluster in Covent Garden, South Kensington, and Shoreditch.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find a red K2 or K6 telephone box with original interior fittings surviving — the shelf, the coin box housing, the ventilation grille. Photograph the interior detail alongside the domed exterior.',
      'hint', 'Working or semi-maintained boxes on quieter streets in Bloomsbury and Chelsea retain more original fittings than tourist-area boxes that have been stripped.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find a red telephone box with its original cast-iron Crown emblem above the door — not painted over, not replaced — and photograph the emblem close enough that the specific crown design is identifiable. St Edward''s Crown means post-1953. Anything earlier means you found something rare.',
      'hint', 'The emblem is above the door on all four sides; look for intact examples on quieter residential streets.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "object", "target": "red telephone box", "confidence": 0.90}, {"type": "label", "target": "crown emblem cast iron", "confidence": 0.70}]',
    '2026-06-13 06:00:00+00', '2026-06-13 23:00:00+00'
  );

  -- 2026-06-14  social
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-14', 'social', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Speakers'' Corner has been running since 1872. Every Sunday, strangers stand on boxes and argue. The crowd is the point. Without the crowd it is just a man on a ladder.',
      'title', 'Go to Speakers'' Corner in Hyde Park. Photograph the scene — a speaker, some audience, enough of the park to show where you are. You don''t have to agree with anyone.',
      'hint', 'Most active Sunday mornings between 10am and 2pm; on weekdays, photograph whoever is there.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'At Speakers'' Corner, introduce yourself to a stranger and ask why they came today. Then photograph the two of you with the speaking scene visible behind you.',
      'hint', 'People at Speakers'' Corner are more talkative than most London crowds; the audience tends to be friendlier than the speakers.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'At Speakers'' Corner, assemble six strangers — none who knew each other before today — for a group photograph with a speaker or platform visible behind you. Every face must be visible. One hour.',
      'hint', 'Approach people during pauses between speakers; come early when the crowd is building and still in a good mood.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "outdoor public crowd gathering", "confidence": 0.78}, {"type": "label", "target": "people group", "confidence": 0.75}]',
    '2026-06-14 06:00:00+00', '2026-06-14 23:00:00+00'
  );

  -- 2026-06-15  detail
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-15', 'detail', 'ai_vision',
    jsonb_build_object(
      'challenge_narrative', 'Edward Johnston designed the Underground roundel in 1916. It has been on every sign, every platform, every map since. One of the most looked-at things in Britain. Almost nobody has actually looked at it.',
      'title', 'Find a London Underground roundel and photograph it in close-up so that Johnston''s letterforms are clearly legible — the distinctive lowercase proportions, the circular ''o'', the slightly condensed capitals.',
      'hint', 'Every station entrance has at least one; enamel roundels on older stations are more photogenic than modern vinyl versions.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Find an Underground roundel at a station opened before 1940 — a Leslie Green oxblood-tile station or a Holden inter-war station — and photograph it against the building''s original tilework. Station name must be legible.',
      'hint', 'Leslie Green stations (dark red terracotta): Covent Garden, Russell Square, Goodge Street. Holden stations: Arnos Grove, Southgate, Bounds Green.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Find an Underground roundel in its original cast-enamel form — not vinyl, not modern print — and photograph it close enough that the slight three-dimensional depth of the enamel is distinguishable from flat reproduction. Station name must be legible.',
      'hint', 'Original enamel roundels have a gloss and depth vinyl cannot replicate; look at the least-altered stations — Baker Street, Aldgate, some Northern line platforms.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "object", "target": "London Underground roundel sign", "confidence": 0.88}, {"type": "text", "target": "station name text", "confidence": 0.82}]',
    '2026-06-15 06:00:00+00', '2026-06-15 23:00:00+00'
  );

  -- 2026-06-16  condition_lock
  insert into challenges (id, city_id, date, archetype, verification_method,
      easy, medium, hard, legend, vision_checks, condition_type, condition_config,
      active_from, active_until)
  values (
    gen_random_uuid(), ldn_id, '2026-06-16', 'condition_lock', 'combined',
    jsonb_build_object(
      'challenge_narrative', 'Between 7 and 9 this morning, the Underground carries more than a million people. The platforms are where London is most itself: patient, compressed, reading something, pretending not to notice anyone else.',
      'title', 'Between 7 and 9 this morning, photograph any Tube platform during rush hour — a crowd, a train, the gap. The platform must be busy. This is not a quiet station photograph.',
      'hint', 'Central, Northern, Jubilee, and Victoria lines through Zone 1 are the busiest; avoid the ends of platforms where it thins out.',
      'time_limit_mins', 90, 'radius_m', 600, 'points', 100
    ),
    jsonb_build_object(
      'title', 'Between 7 and 9, photograph a rush-hour platform with three elements visible: a crowd, a train with its line colour identifiable, and a sign showing the station name or next train.',
      'hint', 'Stand at the far end toward the tunnel — you get the full crowd, the indicator board, and the approaching train in one composition.',
      'time_limit_mins', 60, 'radius_m', 400, 'points', 200
    ),
    jsonb_build_object(
      'title', 'Between 7 and 9, at a station opened before 1940, photograph the rush-hour platform so that the original Victorian or inter-war architecture is visible behind the modern crowd. Station name must be legible in the frame.',
      'hint', 'Baker Street, Aldgate, and Moorgate show Victorian ironwork behind the crowds; Covent Garden and Russell Square have the most intact Leslie Green interiors.',
      'time_limit_mins', 30, 'radius_m', 200, 'points', 400
    ),
    null,
    '[{"type": "label", "target": "subway metro platform crowd", "confidence": 0.85}, {"type": "label", "target": "train transit", "confidence": 0.80}]',
    'time_window',
    '{"start_hour": 7, "end_hour": 9, "description": "Only unlocked during morning rush hour 07:00–09:00 local time"}',
    '2026-06-16 06:00:00+00', '2026-06-16 23:00:00+00'
  );

end $$;
