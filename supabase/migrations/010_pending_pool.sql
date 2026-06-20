-- ─────────────────────────────────────────────
-- 010: Pending trace pool + activation pipeline
-- ─────────────────────────────────────────────

-- Status lifecycle: pending → active → cooldown → pending → ...
alter table traces add column if not exists status text
  not null default 'active'
  check (status in ('pending', 'active', 'cooldown'));

-- Backfill status from is_active
update traces set status = case
  when is_active = false then 'cooldown'
  else 'active'
end where status = 'active';  -- only update rows that haven't been touched

-- ── activate_pending_traces ────────────────────────────────────────────────
-- Promotes pending traces to active until target_active is reached.
-- Called on app open + by the generator after seeding.

create or replace function activate_pending_traces(target_active int default 80)
returns int language plpgsql security definer as $$
declare
  current_active int;
  to_activate    int;
  rec            record;
  activated      int := 0;
  ttl_hours      int;
begin
  select count(*) into current_active
  from traces
  where status = 'active'
    and (expires_at  is null or expires_at  > now())
    and (active_from is null or active_from <= now());

  to_activate := greatest(0, target_active - current_active);
  if to_activate = 0 then return 0; end if;

  for rec in
    select id, difficulty from traces
    where status = 'pending'
    order by random()
    limit to_activate
  loop
    ttl_hours := case rec.difficulty
      when 'easy'      then 6
      when 'medium'    then 12
      when 'hard'      then 18
      when 'legendary' then 24
      else 12
    end;

    update traces set
      status      = 'active',
      is_active   = true,
      active_from = null,
      expires_at  = now() + make_interval(hours => ttl_hours)
    where id = rec.id;

    activated := activated + 1;
  end loop;

  return activated;
end;
$$;

-- ── refresh_cooldown_traces ────────────────────────────────────────────────
-- Moves cooldown-complete traces back to pending so they can be reactivated.

create or replace function refresh_cooldown_traces()
returns int language plpgsql security definer as $$
declare refreshed int;
begin
  update traces set
    status    = 'pending',
    is_active = false,
    expires_at = null
  where status = 'cooldown'
    and active_from is not null
    and active_from <= now();

  get diagnostics refreshed = row_count;
  return refreshed;
end;
$$;

-- ── Update rotate_expired_traces ───────────────────────────────────────────
-- Expired active traces → cooldown. Pending traces will fill the gap.

create or replace function rotate_expired_traces()
returns int language plpgsql security definer as $$
declare
  rec     record;
  rotated int := 0;
begin
  for rec in
    select id from traces
    where status = 'active'
      and expires_at is not null
      and expires_at < now()
      and (active_from is null or active_from < now())
  loop
    update traces set
      status      = 'cooldown',
      is_active   = false,
      active_from = now() + make_interval(hours => 20 + floor(random() * 9)::int),
      expires_at  = null
    where id = rec.id;

    rotated := rotated + 1;
  end loop;

  return rotated;
end;
$$;

-- ── pending_pool_size ─────────────────────────────────────────────────────
-- Convenience function for the generator to check pool size.

create or replace function pending_pool_size()
returns int language sql stable security definer as $$
  select count(*)::int from traces where status = 'pending';
$$;
