-- Migration 002: Functions, triggers, and RPC helpers

-- ---------------------------------------------------------------------------
-- 1. Leaderboard RPC (called by useLeaderboard hook)
-- ---------------------------------------------------------------------------
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
    and s.verification_status in ('approved', 'community_review')
  order by s.total_points desc nulls last, s.submitted_at asc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- 2. User stats RPC (called by profile screen)
-- ---------------------------------------------------------------------------
create or replace function get_user_stats(p_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'total_submissions', count(*),
    'approved_count',    count(*) filter (where verification_status = 'approved'),
    'rank_1_count',      count(*) filter (where city_rank = 1),
    'total_xp',          coalesce(sum(total_points) filter (where verification_status = 'approved'), 0),
    'avg_city_rank',     round(avg(city_rank) filter (where city_rank is not null))
  ) into result
  from submissions
  where user_id = p_user_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Challenge lookup helper for the webhook handler (Lambda handler.ts)
--    Webhook secret validation is handled in Lambda via shared secret header.
-- ---------------------------------------------------------------------------
create or replace function get_challenge_for_submission(p_submission_id uuid)
returns json
language sql
security definer
as $$
  select json_build_object(
    'id',                  c.id,
    'archetype',           c.archetype,
    'verification_method', c.verification_method,
    'vision_checks',       c.vision_checks,
    'ocr_pattern',         c.ocr_pattern,
    'active_from',         c.active_from,
    'active_until',        c.active_until,
    'easy',                c.easy,
    'medium',              c.medium,
    'hard',                c.hard,
    'city_lat',            ci.lat,
    'city_lng',            ci.lng,
    'city_name',           ci.name
  )
  from submissions s
  join challenges c  on c.id  = s.challenge_id
  join cities     ci on ci.id = c.city_id
  where s.id = p_submission_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. pg_cron schedule notes
--    Enable the pg_cron extension via Supabase project settings (Database →
--    Extensions), then run the cron.schedule() calls below once manually or
--    via a setup script.  They are commented out here so this migration is
--    idempotent on projects that don't yet have pg_cron enabled.
--
--    challenge-generator  : daily at 05:00 UTC (7 am for UTC+2, covers most
--                           target timezones before the day starts)
--    midnight-ceremony     : 21:30 UTC and 22:30 UTC cover midnight for
--                           UTC+2 (Tel Aviv) and UTC+1 (London) respectively
-- ---------------------------------------------------------------------------

-- select cron.schedule(
--   'challenge-generator',
--   '0 5 * * *',
--   $$select net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/challenge-generator',
--       headers := ('{"Authorization":"Bearer ' || current_setting('app.service_role_key') || '","Content-Type":"application/json"}')::jsonb,
--       body    := '{}'::jsonb
--   )$$
-- );

-- select cron.schedule(
--   'midnight-ceremony',
--   '30 21,22 * * *',
--   $$select net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/midnight-ceremony',
--       headers := ('{"Authorization":"Bearer ' || current_setting('app.service_role_key') || '","Content-Type":"application/json"}')::jsonb,
--       body    := '{}'::jsonb
--   )$$
-- );

comment on table challenges is
  'pg_cron setup: Enable extension in project settings, then schedule '
  'challenge-generator at "0 5 * * *" and midnight-ceremony at "30 21,22 * * *".';

-- ---------------------------------------------------------------------------
-- 5. updated_at column + trigger for submissions
-- ---------------------------------------------------------------------------
alter table submissions add column if not exists updated_at timestamptz default now();

create trigger submissions_updated_at
  before update on submissions
  for each row execute function update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Vote aggregation trigger — keeps votes_valid / votes_invalid in sync
-- ---------------------------------------------------------------------------
create or replace function sync_vote_counts()
returns trigger as $$
begin
  update submissions
  set
    votes_valid   = (select count(*) from votes
                     where submission_id = coalesce(new.submission_id, old.submission_id)
                       and vote = 'valid'),
    votes_invalid = (select count(*) from votes
                     where submission_id = coalesce(new.submission_id, old.submission_id)
                       and vote = 'invalid')
  where id = coalesce(new.submission_id, old.submission_id);

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger votes_sync_counts
  after insert or delete on votes
  for each row execute function sync_vote_counts();

-- ---------------------------------------------------------------------------
-- 7. Community override logic
--    >= 10 total votes AND valid > invalid * 2  → auto-approve a rejection
--    >= 10 total votes AND invalid > valid * 2  → auto-reject an approval
-- ---------------------------------------------------------------------------
create or replace function check_community_override()
returns trigger as $$
declare
  total_votes integer;
begin
  total_votes := new.votes_valid + new.votes_invalid;

  if total_votes >= 10 then
    if new.votes_valid > new.votes_invalid * 2
       and new.verification_status = 'rejected' then
      update submissions
      set verification_status = 'approved',
          community_override  = true
      where id = new.id;

    elsif new.votes_invalid > new.votes_valid * 2
          and new.verification_status = 'approved' then
      update submissions
      set verification_status = 'rejected',
          community_override  = true
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger submissions_community_override
  after update of votes_valid, votes_invalid on submissions
  for each row execute function check_community_override();
