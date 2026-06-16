-- 005_social_mechanics.sql
-- Social and competitive mechanics for the app:
-- crews, referrals, city founders, tournaments, duels,
-- expeditions, relay chains, parallel lives, legendary events,
-- and chain unlocks.

-- ─────────────────────────────────────────────
-- USERS TABLE ADDITIONS (referral & crew fields)
-- crew_id FK added after the crews table is created below.
-- ─────────────────────────────────────────────
alter table users
  add column if not exists referred_by    uuid references users(id),
  add column if not exists champion_title text,
  add column if not exists invite_count   integer default 0,
  add column if not exists referral_code  text unique;

-- ─────────────────────────────────────────────
-- CREWS
-- ─────────────────────────────────────────────
create table crews (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  founder_id   uuid references users(id),
  city_id      uuid references cities(id),
  xp_total     integer default 0,
  member_count integer default 1,
  created_at   timestamptz default now()
);

create table crew_members (
  crew_id              uuid references crews(id) on delete cascade,
  user_id              uuid references users(id) on delete cascade,
  role                 text default 'member' check (role in ('founder','member')),
  weekly_contribution  integer default 0,
  total_contribution   integer default 0,
  joined_at            timestamptz default now(),
  primary key (crew_id, user_id)
);

-- Add crew_id FK to users now that the crews table exists.
alter table users
  add column if not exists crew_id uuid references crews(id);

-- ─────────────────────────────────────────────
-- REFERRALS
-- ─────────────────────────────────────────────
create table referrals (
  id                  uuid primary key default gen_random_uuid(),
  referrer_id         uuid references users(id) on delete cascade,
  referred_id         uuid references users(id) on delete cascade unique,
  status              text default 'pending'
                        check (status in ('pending','first_challenge','rewarded')),
  first_challenge_at  timestamptz,
  rewarded_at         timestamptz,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CITY FOUNDERS
-- Permanent record of who built each city.
-- Tiers: builder (10 invites), architect (25), legend_maker (50).
-- ─────────────────────────────────────────────
create table city_founders (
  user_id      uuid references users(id) on delete cascade,
  city_id      uuid references cities(id) on delete cascade,
  invite_count integer default 0,
  founder_tier text default 'builder'
                 check (founder_tier in ('builder','architect','legend_maker')),
  primary key (user_id, city_id)
);

-- ─────────────────────────────────────────────
-- TOURNAMENTS
-- ─────────────────────────────────────────────
create table tournaments (
  id                        uuid primary key default gen_random_uuid(),
  type                      text not null
                              check (type in ('city_championship','sprint','crew_wars','photo_slam')),
  status                    text default 'upcoming'
                              check (status in ('upcoming','registration','active','completed')),
  city_id                   uuid references cities(id),             -- host city / city 1
  challenger_city_id        uuid references cities(id),             -- city 2 (city_championship)
  winner_city_id            uuid references cities(id),
  city_score                integer default 0,
  challenger_city_score     integer default 0,
  registration_opens_at     timestamptz not null,
  registration_closes_at    timestamptz not null,
  starts_at                 timestamptz not null,
  ends_at                   timestamptz not null,
  max_participants          integer,
  prize_description         text,
  created_at                timestamptz default now()
);

create table tournament_participants (
  tournament_id       uuid references tournaments(id) on delete cascade,
  user_id             uuid references users(id) on delete cascade,
  crew_id             uuid references crews(id),
  city_id             uuid references cities(id),
  total_points        integer default 0,
  rounds_completed    integer default 0,
  is_eliminated       boolean default false,
  eliminated_in_round integer,
  final_rank          integer,
  registered_at       timestamptz default now(),
  primary key (tournament_id, user_id)
);

create table tournament_rounds (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references tournaments(id) on delete cascade,
  round_number    integer not null,
  challenge_id    uuid references challenges(id),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  survivors_count integer,   -- how many advance (elimination format)
  status          text default 'pending'
                    check (status in ('pending','active','scoring','completed'))
);

create table tournament_submissions (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid references tournaments(id) on delete cascade,
  round_id            uuid references tournament_rounds(id) on delete cascade,
  user_id             uuid references users(id) on delete cascade,
  submission_id       uuid references submissions(id),
  points_earned       integer default 0,
  rank_in_round       integer,
  advanced_to_next    boolean default false,
  submitted_at        timestamptz default now(),
  unique (round_id, user_id)
);

-- ─────────────────────────────────────────────
-- DUELS
-- ─────────────────────────────────────────────
create table duels (
  id                          uuid primary key default gen_random_uuid(),
  challenge_id                uuid references challenges(id),
  challenger_id               uuid references users(id) on delete cascade,
  opponent_id                 uuid references users(id) on delete cascade,
  challenger_submission_id    uuid references submissions(id),
  opponent_submission_id      uuid references submissions(id),
  status                      text default 'pending'
                                check (status in ('pending','active','voting','completed','cancelled')),
  winner_id                   uuid references users(id),
  votes_challenger            integer default 0,
  votes_opponent              integer default 0,
  points_stake                integer default 100,
  initiated_via               text default 'matchmaking'
                                check (initiated_via in ('matchmaking','friend_challenge','invite')),
  created_at                  timestamptz default now()
);

create table duel_votes (
  id         uuid primary key default gen_random_uuid(),
  duel_id    uuid references duels(id) on delete cascade,
  voter_id   uuid references users(id) on delete cascade,
  voted_for  uuid references users(id),
  created_at timestamptz default now(),
  unique (duel_id, voter_id)
);

-- ─────────────────────────────────────────────
-- EXPEDITIONS
-- ─────────────────────────────────────────────
create table expeditions (
  id             uuid primary key default gen_random_uuid(),
  planter_id     uuid references users(id) on delete cascade,
  city_id        uuid references cities(id),
  submission_id  uuid references submissions(id),
  clue_text      text not null,
  clue_photo_url text,
  lat            float not null,
  lng            float not null,
  radius_m       integer default 150,
  points_stake   integer default 200,
  status         text default 'active'
                   check (status in ('active','found','expired')),
  expires_at     timestamptz not null,
  found_by       uuid references users(id),
  found_at       timestamptz,
  hint_unlocked  boolean default false,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- RELAY CHAINS
-- ─────────────────────────────────────────────
create table relay_chains (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id),
  city_id      uuid references cities(id),
  date         date not null,
  link_count   integer default 0,
  created_at   timestamptz default now(),
  unique (challenge_id, city_id)
);

create table relay_links (
  id               uuid primary key default gen_random_uuid(),
  chain_id         uuid references relay_chains(id) on delete cascade,
  submission_id    uuid references submissions(id),
  user_id          uuid references users(id) on delete cascade,
  position         integer not null,
  prompt_received  text not null,  -- what this user was shown from the previous photo
  prompt_extracted text,           -- what was extracted from this photo for the next user
  created_at       timestamptz default now(),
  unique (chain_id, position)
);

-- ─────────────────────────────────────────────
-- PARALLEL LIVES MATCHES
-- ─────────────────────────────────────────────
create table parallel_lives (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid references challenges(id),
  user_1_id       uuid references users(id) on delete cascade,
  city_1_id       uuid references cities(id),
  submission_1_id uuid references submissions(id),
  user_2_id       uuid references users(id) on delete cascade,
  city_2_id       uuid references cities(id),
  submission_2_id uuid references submissions(id),
  revealed        boolean default false,
  revealed_at     timestamptz,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- LEGENDARY EVENTS
-- ─────────────────────────────────────────────
create table legendary_events (
  id                uuid primary key default gen_random_uuid(),
  challenge_id      uuid references challenges(id),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,  -- 30-minute window
  status            text default 'upcoming'
                      check (status in ('upcoming','active','completed')),
  participant_count integer default 0,
  badge_id          text references badge_definitions(id),
  created_at        timestamptz default now()
);

create table legendary_completions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references legendary_events(id) on delete cascade,
  user_id       uuid references users(id) on delete cascade,
  submission_id uuid references submissions(id),
  completed_at  timestamptz default now(),
  unique (event_id, user_id)
);

-- ─────────────────────────────────────────────
-- CHAIN UNLOCKS
-- Bonus challenge unlocked by completing the daily challenge.
-- ─────────────────────────────────────────────
create table chain_unlocks (
  id                 uuid primary key default gen_random_uuid(),
  challenge_id       uuid references challenges(id),  -- the daily challenge that unlocks this
  bonus_challenge_id uuid references challenges(id),  -- the bonus challenge
  date               date not null,
  city_id            uuid references cities(id),
  unique (challenge_id, city_id)
);

create table chain_unlock_completions (
  id              uuid primary key default gen_random_uuid(),
  chain_unlock_id uuid references chain_unlocks(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  submission_id   uuid references submissions(id),
  completed_at    timestamptz default now(),
  unique (chain_unlock_id, user_id)
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index idx_tournaments_city               on tournaments(city_id);
create index idx_tournaments_status             on tournaments(status);
create index idx_tournament_participants_user   on tournament_participants(user_id);
create index idx_duels_challenger               on duels(challenger_id);
create index idx_duels_opponent                 on duels(opponent_id);
create index idx_duels_status                   on duels(status);
create index idx_expeditions_city               on expeditions(city_id);
create index idx_expeditions_status             on expeditions(status);
create index idx_relay_chains_challenge         on relay_chains(challenge_id);
create index idx_relay_links_chain              on relay_links(chain_id);
create index idx_referrals_referrer             on referrals(referrer_id);
create index idx_crew_members_user              on crew_members(user_id);
create index idx_parallel_lives_challenge       on parallel_lives(challenge_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table crews                    enable row level security;
alter table crew_members             enable row level security;
alter table referrals                enable row level security;
alter table city_founders            enable row level security;
alter table tournaments              enable row level security;
alter table tournament_participants  enable row level security;
alter table tournament_rounds        enable row level security;
alter table tournament_submissions   enable row level security;
alter table duels                    enable row level security;
alter table duel_votes               enable row level security;
alter table expeditions              enable row level security;
alter table relay_chains             enable row level security;
alter table relay_links              enable row level security;
alter table parallel_lives           enable row level security;
alter table legendary_events         enable row level security;
alter table legendary_completions    enable row level security;
alter table chain_unlocks            enable row level security;
alter table chain_unlock_completions enable row level security;

-- Public read policies (writes handled by server-side functions / service role)
create policy "crews_read_all"                   on crews                   for select using (true);
create policy "crew_members_read_all"            on crew_members            for select using (true);
create policy "city_founders_read_all"           on city_founders           for select using (true);
create policy "tournaments_read_all"             on tournaments             for select using (true);
create policy "tournament_participants_read_all" on tournament_participants for select using (true);
create policy "tournament_rounds_read_all"       on tournament_rounds       for select using (true);
create policy "tournament_submissions_read_all"  on tournament_submissions  for select using (true);
create policy "duels_read_all"                   on duels                   for select using (true);
create policy "duel_votes_read_all"              on duel_votes              for select using (true);
create policy "expeditions_read_all"             on expeditions             for select using (true);
create policy "relay_chains_read_all"            on relay_chains            for select using (true);
create policy "relay_links_read_all"             on relay_links             for select using (true);
create policy "parallel_lives_read_all"          on parallel_lives          for select using (true);
create policy "legendary_events_read_all"        on legendary_events        for select using (true);
create policy "legendary_completions_read_all"   on legendary_completions   for select using (true);
create policy "chain_unlocks_read_all"           on chain_unlocks           for select using (true);
create policy "chain_unlock_completions_read_all" on chain_unlock_completions for select using (true);

-- Users can read their own referral records
create policy "referrals_read_own" on referrals
  for select using (
    referrer_id = auth.uid() or referred_id = auth.uid()
  );

-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table tournament_participants;
alter publication supabase_realtime add table duels;
alter publication supabase_realtime add table duel_votes;
alter publication supabase_realtime add table expeditions;
alter publication supabase_realtime add table relay_links;
alter publication supabase_realtime add table legendary_events;
