-- Atomic rate limit upsert: insert-or-increment in a single operation.
-- Eliminates the SELECT + UPDATE race condition in the application layer.
-- Returns { blocked: bool, attempt_count: int }.

alter table public.auth_rate_limits
  drop constraint if exists auth_rate_limits_ip_key;
alter table public.auth_rate_limits
  add constraint auth_rate_limits_ip_key unique (ip);

create or replace function public.upsert_rate_limit(
  p_ip text,
  p_max_attempts int,
  p_window_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_attempt_count int;
  v_blocked boolean;
begin
  v_reset_at := v_now + (p_window_ms || ' milliseconds')::interval;

  insert into public.auth_rate_limits (ip, attempt_count, reset_at)
  values (p_ip, 1, v_reset_at)
  on conflict (ip) do update
    set
      attempt_count = case
        when public.auth_rate_limits.reset_at <= v_now then 1
        when public.auth_rate_limits.attempt_count >= p_max_attempts then public.auth_rate_limits.attempt_count
        else public.auth_rate_limits.attempt_count + 1
      end,
      reset_at = case
        when public.auth_rate_limits.reset_at <= v_now then v_reset_at
        else public.auth_rate_limits.reset_at
      end
  returning attempt_count, (attempt_count >= p_max_attempts) as blocked
  into v_attempt_count, v_blocked;

  return jsonb_build_object(
    'attempt_count', v_attempt_count,
    'blocked', v_blocked
  );
end;
$$;

revoke all on function public.upsert_rate_limit(text, int, bigint) from anon;
revoke all on function public.upsert_rate_limit(text, int, bigint) from authenticated;
grant execute on function public.upsert_rate_limit(text, int, bigint) to service_role;
