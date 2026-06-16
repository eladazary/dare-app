-- CITIES (must come first — referenced by others)
create table cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  timezone text not null,
  lat float not null,
  lng float not null,
  active boolean default true,
  user_count integer default 0,
  created_at timestamptz default now()
);

-- USERS
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) on delete cascade,
  username text unique not null,
  city_id uuid references cities(id),
  level text default 'wanderer' check (level in ('wanderer','scout','explorer','chronicler','keeper','legend')),
  xp integer default 0,
  streak_current integer default 0,
  streak_best integer default 0,
  streak_last_date date,
  streak_shields integer default 0,
  gone_plus boolean default false,
  gone_pro boolean default false,
  push_token text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CHALLENGE TYPES
create type challenge_archetype as enum (
  'detective', 'sprint', 'hyperlocal', 'narrative', 'social', 'detail', 'condition_lock'
);

create type verification_method as enum (
  'ai_vision', 'community', 'gps_only', 'combined'
);

-- CHALLENGES
create table challenges (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references cities(id),
  date date not null,
  archetype challenge_archetype not null,
  verification_method verification_method not null,
  easy jsonb not null,
  medium jsonb not null,
  hard jsonb not null,
  legend jsonb,
  vision_checks jsonb,
  ocr_pattern text,
  condition_type text,
  condition_config jsonb,
  active_from timestamptz not null,
  active_until timestamptz not null,
  created_at timestamptz default now(),
  unique(city_id, date)
);

-- SUBMISSIONS
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  challenge_id uuid references challenges(id),
  city_id uuid references cities(id),
  difficulty text not null check (difficulty in ('easy','medium','hard','legend')),
  photo_url text not null,
  photo_thumb_url text,
  photo_taken_at timestamptz not null,
  lat float not null,
  lng float not null,
  location_valid boolean,
  verification_status text default 'pending' check (verification_status in ('pending','approved','rejected','community_review')),
  vision_confidence float,
  vision_checks_passed jsonb,
  ai_verdict text,
  votes_valid integer default 0,
  votes_invalid integer default 0,
  community_override boolean,
  base_points integer default 0,
  bonus_points integer default 0,
  total_points integer default 0,
  speed_multiplier float default 1.0,
  streak_multiplier float default 1.0,
  weather_multiplier float default 1.0,
  city_rank integer,
  neighborhood_rank integer,
  friend_rank integer,
  caption text,
  submitted_at timestamptz default now(),
  unique(user_id, challenge_id)
);

-- VOTES
create table votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  voter_id uuid references users(id) on delete cascade,
  vote text not null check (vote in ('valid','invalid','unsure')),
  created_at timestamptz default now(),
  unique(submission_id, voter_id)
);

-- BADGES
create table badge_definitions (
  id text primary key,
  name text not null,
  description text not null,
  emoji text not null,
  rarity text default 'common' check (rarity in ('common','rare','legendary')),
  trigger_config jsonb not null
);

create table user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  badge_id text references badge_definitions(id),
  earned_at timestamptz default now(),
  unique(user_id, badge_id)
);

-- STREAK EVENTS
create table streak_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  event_type text check (event_type in ('increment','break','shield_used','reset')),
  streak_value integer,
  created_at timestamptz default now()
);

-- LEAGUES
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references users(id),
  city_id uuid references cities(id),
  week_start date not null,
  week_end date not null,
  pot_amount integer default 0,
  created_at timestamptz default now()
);

create table league_members (
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  weekly_points integer default 0,
  rank integer,
  primary key (league_id, user_id)
);

-- NOTIFICATIONS LOG
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  sent_at timestamptz default now(),
  read_at timestamptz
);

-- INDEXES
create index idx_submissions_challenge_city on submissions(challenge_id, city_id);
create index idx_submissions_user on submissions(user_id);
create index idx_submissions_status on submissions(verification_status);
create index idx_votes_submission on votes(submission_id);
create index idx_challenges_city_date on challenges(city_id, date);
create index idx_users_city on users(city_id);
create index idx_users_xp on users(xp desc);

-- ROW LEVEL SECURITY
alter table users enable row level security;
alter table submissions enable row level security;
alter table votes enable row level security;

create policy "users_own_profile" on users for all using (auth.uid() = auth_id);
create policy "submissions_read_all" on submissions for select using (true);
create policy "submissions_insert_own" on submissions for insert with check (
  auth.uid() = (select auth_id from users where id = user_id)
);
create policy "votes_read_all" on votes for select using (true);
create policy "votes_insert_own" on votes for insert with check (
  auth.uid() = (select auth_id from users where id = voter_id)
);

-- UPDATED_AT TRIGGER
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on users
  for each row execute function update_updated_at();
