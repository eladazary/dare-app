-- ─────────────────────────────────────────────
-- 008: Attempt validation — failures + streak break
-- ─────────────────────────────────────────────

-- Record when a user exhausts all attempts on a trace (full failure)
create table if not exists trace_failures (
  id         uuid primary key default gen_random_uuid(),
  trace_id   uuid references traces(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(trace_id, user_id)
);

create index if not exists trace_failures_user_idx on trace_failures(user_id, created_at desc);

-- Break streak on full failure (called client-side when attempts reach 0)
create or replace function break_streak(p_user_id uuid)
returns void
language sql security definer as $$
  update users
  set streak_days = 0,
      streak_last_activity = now()
  where id = p_user_id;
$$;

-- Record a failure and break streak atomically
create or replace function record_trace_failure(
  p_trace_id uuid,
  p_user_id  uuid
)
returns void
language plpgsql security definer as $$
begin
  insert into trace_failures (trace_id, user_id)
  values (p_trace_id, p_user_id)
  on conflict (trace_id, user_id) do nothing;

  update users
  set streak_days = 0,
      streak_last_activity = now()
  where id = p_user_id;
end;
$$;
