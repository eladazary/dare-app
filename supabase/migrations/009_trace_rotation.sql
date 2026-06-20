-- ─────────────────────────────────────────────
-- 009: Trace rotation — cooldown + reactivation
-- ─────────────────────────────────────────────

-- active_from: earliest time the trace can appear again (null = always eligible)
alter table traces add column if not exists active_from timestamptz default null;

-- Update RPC to respect active_from (cooldown gate)
create or replace function get_nearby_traces(
  user_lat  double precision,
  user_lng  double precision,
  user_id   uuid    default null,
  radius_m  integer default 5000          -- increased from 2000 → 5000
)
returns table (
  id                   uuid,
  lat                  double precision,
  lng                  double precision,
  clue                 text,
  place_name           text,
  reference_photo_url  text,
  photo_caption        text,
  difficulty           text,
  solve_radius_meters  integer,
  notify_radius_meters integer,
  max_attempts         integer,
  is_legendary         boolean,
  solve_count          integer,
  distance_meters      double precision,
  already_solved       boolean,
  expires_at           timestamptz,
  xp_multiplier        integer
)
language sql stable security definer as $$
  select
    t.id,
    ST_Y(t.location::geometry)  as lat,
    ST_X(t.location::geometry)  as lng,
    t.clue,
    t.place_name,
    t.reference_photo_url,
    t.photo_caption,
    t.difficulty,
    t.solve_radius_meters,
    t.notify_radius_meters,
    t.max_attempts,
    t.is_legendary,
    t.solve_count,
    ST_Distance(t.location, ST_Point(user_lng, user_lat)::geography) as distance_meters,
    (exists (
      select 1 from trace_solves ts
      where ts.trace_id = t.id and ts.user_id = get_nearby_traces.user_id
    )) as already_solved,
    t.expires_at,
    coalesce(t.xp_multiplier, 1) as xp_multiplier
  from traces t
  where
    t.is_active = true
    and ST_DWithin(t.location, ST_Point(user_lng, user_lat)::geography, radius_m)
    and (t.expires_at  is null or t.expires_at  > now())   -- not expired
    and (t.active_from is null or t.active_from <= now())  -- cooldown over
  order by distance_meters;
$$;

-- ── Rotation function ──────────────────────────────────────────────────────
-- Called hourly by cron. For each expired trace:
--   1. Set a cooldown (1–2 days, randomised)
--   2. Set a new TTL after the cooldown ends
-- The trace will disappear until active_from passes, then reappear.

create or replace function rotate_expired_traces()
returns integer language plpgsql security definer as $$
declare
  ttl_hours   integer;
  cooldown_h  integer;
  rec         record;
  rotated     integer := 0;
begin
  for rec in
    select id, difficulty
    from   traces
    where  is_active  = true
    and    expires_at is not null
    and    expires_at < now()
    and    (active_from is null or active_from < now()) -- only ones not already in cooldown
  loop
    -- TTL per difficulty
    ttl_hours := case rec.difficulty
      when 'easy'      then 6
      when 'medium'    then 12
      when 'hard'      then 18
      when 'legendary' then 24
      else 12
    end;

    -- Cooldown: 20–28 hours (randomised so traces don't all reappear at once)
    cooldown_h := 20 + floor(random() * 9)::integer;

    update traces set
      active_from = now() + make_interval(hours => cooldown_h),
      expires_at  = now() + make_interval(hours => cooldown_h + ttl_hours)
    where id = rec.id;

    rotated := rotated + 1;
  end loop;

  return rotated;
end;
$$;

-- Rotation is triggered by the rotate-traces Edge Function (called on app open).
