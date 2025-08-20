-- New table for plugin usage logs
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event text not null,
  created_at timestamptz default now()
);

-- New table for subscriptions
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  plan text not null,
  status text not null check (status in ('active', 'expired', 'canceled')),
  license_key uuid not null unique,
  started_at timestamptz default now(),
  expires_at timestamptz
);

-- Function to activate subscription after payment
create or replace function activate_subscription(uid uuid, plan_name text, period_days int)
returns void as $$
declare
  new_key uuid := gen_random_uuid();
begin
  insert into subscriptions(user_id, plan, status, license_key, expires_at)
  values(uid, plan_name, 'active', new_key, now() + (period_days || ' days')::interval);
end;
$$ language plpgsql security definer;
