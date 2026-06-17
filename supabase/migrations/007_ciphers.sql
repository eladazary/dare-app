-- 007_ciphers.sql
-- Core Cipher mechanic: location-based clue hunting.
-- Walk around → Cipher appears nearby → decode clue → find the place → selfie.
-- Everything else (taunt, live race, rescue, territory, bounty) is the social layer on top.

-- PostGIS for proximity queries
create extension if not exists postgis;

-- ─────────────────────────────────────────────
-- CIPHERS — the core content unit
-- A Cipher is a riddle about a real place. The user must
-- decode the clue, walk to that place, and take a selfie there.
-- The place_name is never revealed until the user solves it.
-- ─────────────────────────────────────────────
create table ciphers (
  id                     uuid primary key default gen_random_uuid(),
  arena_id               uuid references cities(id),
  location               geography(Point, 4326) not null,
  place_name             text not null,          -- never shown until solved
  clue                   text not null,          -- the riddle shown to user
  hint                   text,                   -- secondary clue; rescuers share this
  difficulty             text not null check (difficulty in ('easy', 'medium', 'hard', 'legendary')),
  solve_radius_meters    integer not null,        -- GPS must be within this to count as solved
  notify_radius_meters   integer not null,        -- notification fires when user is this close
  max_attempts           integer not null default 3,
  reference_photo_url    text,                   -- shown to user after solving
  created_by             uuid references users(id),  -- null = system/AI generated
  is_active              boolean default true,
  is_legendary           boolean default false,
  solve_count            integer default 0,
  created_at             timestamptz default now()
);

-- difficulty → default radii
-- easy:      solve 30m,  notify 100m
-- medium:    solve 50m,  notify 300m
-- hard:      solve 100m, notify 600m
-- legendary: solve 200m, notify 1000m

create index ciphers_location_idx   on ciphers using gist(location);
create index ciphers_arena_active_idx on ciphers(arena_id, is_active);

-- ─────────────────────────────────────────────
-- CIPHER ATTEMPTS — each guess a user makes
-- ─────────────────────────────────────────────
create table cipher_attempts (
  id               uuid primary key default gen_random_uuid(),
  cipher_id        uuid references ciphers(id) on delete cascade,
  user_id          uuid references users(id) on delete cascade,
  challenge_id     uuid,               -- set if part of a taunt/live race
  attempt_number   integer not null,
  selfie_url       text,
  user_location    geography(Point, 4326),
  distance_meters  double precision,   -- computed at submit time
  success          boolean default false,
  created_at       timestamptz default now()
);

create index cipher_attempts_user_cipher_idx on cipher_attempts(user_id, cipher_id);

-- ─────────────────────────────────────────────
-- CIPHER SOLVES — successful finds (denormalised for fast reads)
-- ─────────────────────────────────────────────
create table cipher_solves (
  id                    uuid primary key default gen_random_uuid(),
  cipher_id             uuid references ciphers(id) on delete cascade,
  user_id               uuid references users(id) on delete cascade,
  challenge_id          uuid,
  time_to_solve_seconds integer,
  attempts_used         integer not null,
  selfie_url            text not null,
  created_at            timestamptz default now(),
  unique(cipher_id, user_id)
);

create index cipher_solves_user_idx   on cipher_solves(user_id, created_at desc);
create index cipher_solves_cipher_idx on cipher_solves(cipher_id);

-- ─────────────────────────────────────────────
-- CIPHER EXTRA ATTEMPTS — monetisation
-- Users can buy 3 more attempts when they run out.
-- ─────────────────────────────────────────────
create table cipher_extra_attempts (
  id                  uuid primary key default gen_random_uuid(),
  cipher_id           uuid references ciphers(id) on delete cascade,
  user_id             uuid references users(id) on delete cascade,
  attempts_purchased  integer not null default 3,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CIPHER CHALLENGES — taunt + live race
-- taunt:     challenger solved it, sends benchmark time; challenged has 48h
-- live_race: both start simultaneously, first selfie wins
-- ─────────────────────────────────────────────
create table cipher_challenges (
  id                        uuid primary key default gen_random_uuid(),
  cipher_id                 uuid references ciphers(id) on delete cascade,
  challenger_id             uuid references users(id) on delete cascade,
  challenged_id             uuid references users(id) on delete cascade,
  type                      text not null check (type in ('taunt', 'live_race')),
  challenger_time_seconds   integer,     -- taunt benchmark; null for live_race
  expires_at                timestamptz not null,
  status                    text not null default 'pending'
                              check (status in ('pending', 'active', 'completed', 'expired')),
  winner_id                 uuid references users(id),
  created_at                timestamptz default now()
);

create index cipher_challenges_challenged_idx on cipher_challenges(challenged_id, status);
create index cipher_challenges_challenger_idx on cipher_challenges(challenger_id, status);

-- ─────────────────────────────────────────────
-- CIPHER RESCUES
-- When a friend is on their last attempt, you can rescue them
-- by sending the hint. Your streak is credited ONLY if they succeed.
-- ─────────────────────────────────────────────
create table cipher_rescues (
  id                       uuid primary key default gen_random_uuid(),
  cipher_id                uuid references ciphers(id) on delete cascade,
  rescuer_id               uuid references users(id) on delete cascade,
  rescued_id               uuid references users(id) on delete cascade,
  hint                     text not null,
  rescued_success          boolean,       -- updated when rescued user solves or fails
  rescuer_streak_credited  boolean default false,
  expires_at               timestamptz not null,
  created_at               timestamptz default now()
);

create index cipher_rescues_rescuer_idx on cipher_rescues(rescuer_id);
create index cipher_rescues_rescued_idx on cipher_rescues(rescued_id, expires_at);

-- ─────────────────────────────────────────────
-- TERRITORIES — zone ownership
-- Whoever solves the most Ciphers in a zone owns it.
-- Squads can collectively defend territory.
-- ─────────────────────────────────────────────
create table territories (
  id              uuid primary key default gen_random_uuid(),
  arena_id        uuid references cities(id),
  name            text not null,
  center          geography(Point, 4326) not null,
  radius_meters   integer not null default 300,
  owner_id        uuid references users(id),
  squad_id        uuid,
  solve_count     integer default 0,
  claimed_at      timestamptz,
  updated_at      timestamptz default now()
);

create index territories_location_idx on territories using gist(center);
create index territories_arena_idx    on territories(arena_id);

-- ─────────────────────────────────────────────
-- BOUNTY BOARD
-- Users stake XP on unsolved Ciphers. First solver claims the pot.
-- ─────────────────────────────────────────────
create table bounties (
  id          uuid primary key default gen_random_uuid(),
  cipher_id   uuid references ciphers(id) on delete cascade,
  posted_by   uuid references users(id) on delete cascade,
  xp_stake    integer not null check (xp_stake > 0),
  claimed_by  uuid references users(id),
  claimed_at  timestamptz,
  expires_at  timestamptz not null,
  status      text not null default 'active' check (status in ('active', 'claimed', 'expired')),
  created_at  timestamptz default now()
);

create index bounties_cipher_idx on bounties(cipher_id, status);
create index bounties_active_idx on bounties(status, expires_at);

-- ─────────────────────────────────────────────
-- GHOST TRAIL
-- After solving, a blurred pin is visible to friends for 24h.
-- Friends can tap it to receive the same Cipher.
-- ─────────────────────────────────────────────
create table ghost_trails (
  id              uuid primary key default gen_random_uuid(),
  cipher_id       uuid references ciphers(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  approx_location geography(Point, 4326) not null,  -- fuzzed ±50m from actual
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  created_at      timestamptz default now()
);

create index ghost_trails_location_idx on ghost_trails using gist(approx_location);
create index ghost_trails_expiry_idx   on ghost_trails(expires_at);

-- ─────────────────────────────────────────────
-- USER TABLE ADDITIONS
-- ─────────────────────────────────────────────
alter table users
  add column if not exists streak_days            integer default 0,
  add column if not exists streak_last_activity   timestamptz,
  add column if not exists total_ciphers_solved   integer default 0,
  add column if not exists territory_count        integer default 0;

-- ─────────────────────────────────────────────
-- STREAK TRIGGER — fires on every solve
-- Streak continues if last activity < 3 days ago.
-- ─────────────────────────────────────────────
create or replace function update_streak_on_solve()
returns trigger as $$
begin
  update users
  set
    streak_days = case
      when streak_last_activity is not null
        and streak_last_activity > now() - interval '3 days'
      then streak_days + 1
      else 1
    end,
    streak_last_activity  = now(),
    total_ciphers_solved  = total_ciphers_solved + 1
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger cipher_solved_streak
  after insert on cipher_solves
  for each row execute function update_streak_on_solve();

-- ─────────────────────────────────────────────
-- RESCUE STREAK TRIGGER
-- Credits rescuer's streak ONLY when rescued_success flips to true.
-- ─────────────────────────────────────────────
create or replace function credit_rescuer_streak()
returns trigger as $$
begin
  if new.rescued_success = true
    and (old.rescued_success is null or old.rescued_success = false)
    and new.rescuer_streak_credited = false
  then
    update users
    set
      streak_days = case
        when streak_last_activity is not null
          and streak_last_activity > now() - interval '3 days'
        then streak_days + 1
        else 1
      end,
      streak_last_activity = now()
    where id = new.rescuer_id;

    update cipher_rescues
    set rescuer_streak_credited = true
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger rescue_success_streak
  after update of rescued_success on cipher_rescues
  for each row execute function credit_rescuer_streak();

-- ─────────────────────────────────────────────
-- SOLVE COUNT TRIGGER
-- ─────────────────────────────────────────────
create or replace function increment_cipher_solve_count()
returns trigger as $$
begin
  update ciphers set solve_count = solve_count + 1 where id = new.cipher_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger cipher_solve_count
  after insert on cipher_solves
  for each row execute function increment_cipher_solve_count();

-- ─────────────────────────────────────────────
-- GHOST TRAIL TRIGGER — auto-create on solve
-- ─────────────────────────────────────────────
create or replace function create_ghost_trail()
returns trigger as $$
declare
  cipher_loc geography(Point, 4326);
begin
  select location into cipher_loc from ciphers where id = new.cipher_id;
  insert into ghost_trails(cipher_id, user_id, approx_location)
  values (
    new.cipher_id,
    new.user_id,
    -- fuzz location by ±50m in a random direction
    ST_Translate(
      cipher_loc::geometry,
      (random() - 0.5) * 0.001,
      (random() - 0.5) * 0.001
    )::geography
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger cipher_ghost_trail
  after insert on cipher_solves
  for each row execute function create_ghost_trail();

-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table cipher_challenges;
alter publication supabase_realtime add table cipher_rescues;
alter publication supabase_realtime add table territories;
alter publication supabase_realtime add table bounties;
alter publication supabase_realtime add table ghost_trails;
