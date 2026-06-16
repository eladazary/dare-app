-- Migration 004: Amazing Race-style multi-leg challenges
-- Upgrades the challenge system to support sequential legs with partial completion scoring.

-- ============================================================
-- 1. submission_legs table
-- ============================================================

create table submission_legs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade not null,
  leg_order integer not null check (leg_order >= 1),
  photo_url text not null,
  photo_thumb_url text,
  photo_taken_at timestamptz not null,
  lat float not null,
  lng float not null,
  location_valid boolean,
  verification_status text default 'pending' check (verification_status in ('pending','approved','rejected')),
  vision_confidence float,
  ai_verdict text,
  points_earned integer default 0,
  submitted_at timestamptz default now(),
  unique(submission_id, leg_order)
);

-- ============================================================
-- 2. New columns on submissions
-- ============================================================

alter table submissions
  add column if not exists total_legs integer not null default 1,
  add column if not exists legs_completed integer not null default 0,
  add column if not exists is_partial boolean not null default false,
  add column if not exists narrative_arc text; -- the challenge's story

-- ============================================================
-- 3. Indexes on submission_legs
-- ============================================================

create index idx_submission_legs_submission on submission_legs(submission_id);
create index idx_submission_legs_status on submission_legs(verification_status);

-- ============================================================
-- 4. RLS on submission_legs
-- ============================================================

alter table submission_legs enable row level security;

create policy "submission_legs_read_all" on submission_legs
  for select using (true);

create policy "submission_legs_insert_own" on submission_legs
  for insert with check (
    auth.uid() = (
      select u.auth_id
      from users u
      join submissions s on s.user_id = u.id
      where s.id = submission_id
    )
  );

-- ============================================================
-- 5. Realtime
-- ============================================================

alter publication supabase_realtime add table submission_legs;

-- ============================================================
-- 6. Document the updated challenge JSONB structure
-- ============================================================

comment on column challenges.easy is '
Multi-leg challenge tier (2 legs for easy). Structure:
{
  "total_time_mins": 90,
  "total_points": 400,
  "completion_bonus": 100,
  "legs": [
    {
      "order": 1,
      "title": "The First Clue",
      "clue": "Evocative narrative clue — hints at location without GPS. 2-3 sentences.",
      "target": "Specific thing to photograph, one sentence",
      "hint": "Practical tip for finding it",
      "center_hint": "Neighborhood or district name (shown as starting area)",
      "radius_m": 600,
      "points": 150,
      "vision_checks": [{"type": "object|text|label|color", "target": "...", "confidence": 0.80}]
    },
    {
      "order": 2,
      "title": "The Second Clue",
      "clue": "This clue references the result of leg 1 — e.g. from that fountain, head towards...",
      "target": "...",
      "hint": "...",
      "center_hint": "...",
      "radius_m": 400,
      "points": 150,
      "vision_checks": [...]
    }
  ]
}
';

-- ============================================================
-- 7. Leaderboard RPC — ranks by full completion, then points, then speed
-- ============================================================

create or replace function get_city_leaderboard(
  p_city_id uuid,
  p_date date,
  p_limit integer default 50
)
returns table (
  submission_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  streak_current integer,
  difficulty text,
  total_points integer,
  legs_completed integer,
  total_legs integer,
  is_partial boolean,
  city_rank integer,
  verification_status text,
  photo_thumb_url text,
  ai_verdict text,
  submitted_at timestamptz
)
language sql
security definer
as $$
  select
    s.id as submission_id,
    s.user_id,
    u.username,
    u.avatar_url,
    u.streak_current,
    s.difficulty,
    s.total_points,
    s.legs_completed,
    s.total_legs,
    s.is_partial,
    s.city_rank,
    s.verification_status,
    s.photo_thumb_url,
    s.ai_verdict,
    s.submitted_at
  from submissions s
  join users u on u.id = s.user_id
  join challenges c on c.id = s.challenge_id
  where c.city_id = p_city_id
    and c.date = p_date
    and s.legs_completed > 0
  order by
    (case when s.legs_completed = s.total_legs then 0 else 1 end),
    s.total_points desc nulls last,
    s.submitted_at asc
  limit p_limit;
$$;

-- ============================================================
-- 8. Seed comment — actual seed data uses old format, re-seed after this migration
-- ============================================================

comment on table challenges is 'See migrations/004_amazing_race.sql for updated JSONB structure with multi-leg legs[] array';
