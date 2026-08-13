-- Rbabikerentals.com Phase 1 schema
-- Scope: Bengaluru-only operations in Phase 1.

create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

do $$ begin
  create type role_type as enum ('customer', 'partner_investor', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type kyc_status_type as enum ('not_started', 'in_progress', 'verified', 'manual_review', 'failed', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type booking_status_type as enum ('draft', 'pending_kyc', 'admin_review', 'payment_pending', 'confirmed', 'ongoing', 'extension_requested', 'extended', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type booking_status_type add value if not exists 'admin_review' after 'pending_kyc';
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  create type payment_status_type as enum ('created', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_status_type as enum ('queued', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner_application_status_type as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- Better Auth persistence tables.
-- These are used by the server-side Better Auth Postgres adapter when
-- SUPABASE_DB_URL or DATABASE_URL is configured.
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "phoneNumber" text unique,
  "phoneNumberVerified" boolean,
  role text
);
alter table if exists "user" add column if not exists "phoneNumber" text;
alter table if exists "user" add column if not exists "phoneNumberVerified" boolean;
alter table if exists "user" add column if not exists role text;
create unique index if not exists idx_better_auth_user_email on "user"(email);
create unique index if not exists idx_better_auth_user_phone_number on "user"("phoneNumber");

create table if not exists session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"(id) on delete cascade
);
create unique index if not exists idx_better_auth_session_token on session(token);
create index if not exists idx_better_auth_session_user_id on session("userId");

create table if not exists account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);
create index if not exists idx_better_auth_account_user_id on account("userId");

create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);
create index if not exists idx_better_auth_verification_identifier on verification(identifier);

create table if not exists app_users (
  id text primary key,
  role role_type not null,
  name text not null,
  city text not null default 'bengaluru',
  kyc_status kyc_status_type not null default 'not_started',
  email text,
  phone text,
  pan_number text,
  date_of_birth date,
  cibil_consent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_city_check check (city = 'bengaluru')
);
alter table if exists app_users add column if not exists email text;
alter table if exists app_users add column if not exists phone text;
alter table if exists app_users add column if not exists pan_number text;
alter table if exists app_users add column if not exists date_of_birth date;
alter table if exists app_users add column if not exists cibil_consent_at timestamptz;
alter table if exists app_users add column if not exists deleted_at timestamptz;
alter table if exists app_users add column if not exists partner_application_status partner_application_status_type;
alter table if exists app_users add column if not exists partner_applied_at timestamptz;
alter table if exists app_users add column if not exists partner_reviewed_at timestamptz;
alter table if exists app_users add column if not exists partner_reviewed_by text references app_users(id);
alter table if exists app_users add column if not exists partner_rejection_reason text;
alter table if exists app_users add column if not exists partner_business_name text;

create index if not exists idx_app_users_partner_pending
  on app_users(partner_application_status)
  where partner_application_status = 'pending';

create table if not exists vehicles (
  id text primary key,
  owner_id text not null references app_users(id),
  city text not null default 'bengaluru',
  category text not null,
  brand text not null,
  model text not null,
  registration_number text,
  chassis_number text,
  image_urls text[] not null default '{}',
  is_active boolean not null default true,
  deposit_amount integer not null,
  rate_per_hour integer not null,
  rate_per_day integer not null,
  rate_per_week integer not null,
  rate_per_month integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_city_check check (city = 'bengaluru')
);
alter table if exists vehicles add column if not exists image_urls text[] not null default '{}';
alter table if exists vehicles add column if not exists registration_number text;
alter table if exists vehicles add column if not exists chassis_number text;
alter table if exists vehicles add column if not exists catalog_vehicle_id text references vehicles(id);

create table if not exists bookings (
  id text primary key,
  user_id text not null references app_users(id),
  vehicle_id text not null references vehicles(id),
  city text not null default 'bengaluru',
  status booking_status_type not null default 'draft',
  pickup_at timestamptz not null,
  drop_at timestamptz not null,
  pickup_zone text,
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  km_limit_bucket text not null,
  km_limit_value integer not null,
  coupon_code text,
  quote jsonb not null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_city_check check (city = 'bengaluru'),
  constraint bookings_window_check check (pickup_at < drop_at)
);
alter table if exists bookings add column if not exists pickup_zone text;
alter table if exists bookings add column if not exists pickup_address text;
alter table if exists bookings add column if not exists pickup_latitude double precision;
alter table if exists bookings add column if not exists pickup_longitude double precision;
alter table if exists bookings add column if not exists requested_drop_at timestamptz;
alter table if exists bookings add column if not exists assigned_vehicle_id text references vehicles(id);
alter table if exists bookings add column if not exists assigned_at timestamptz;

create index if not exists idx_bookings_vehicle_window on bookings(vehicle_id, pickup_at, drop_at);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_user on bookings(user_id);
create index if not exists idx_bookings_status_created_at on bookings(status, created_at);

-- Fleet capacity is enforced transactionally in application logic (stockApprox per model).
-- A per-vehicle exclusion constraint only allows one unit per vehicle_id and
-- conflicts with multi-unit inventory for the same scooter model.
alter table if exists bookings drop constraint if exists bookings_vehicle_active_window_excl;

create table if not exists kyc_records (
  user_id text primary key references app_users(id),
  status kyc_status_type not null default 'not_started',
  provider text not null default 'setu_digilocker',
  request_id text unique,
  reference_id text,
  consent_scopes text[] default '{}',
  aadhaar_verified boolean not null default false,
  dl_verified boolean not null default false,
  cibil_score integer,
  cibil_risk_band text,
  cibil_checked_at timestamptz,
  pan_last4 text,
  needs_manual_review boolean not null default false,
  failure_reason text,
  updated_at timestamptz not null default now()
);
alter table if exists kyc_records add column if not exists cibil_risk_band text;
alter table if exists kyc_records add column if not exists cibil_checked_at timestamptz;
alter table if exists kyc_records add column if not exists pan_last4 text;

create table if not exists vehicle_block_windows (
  id text primary key,
  vehicle_id text not null references vehicles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_by text not null references app_users(id),
  created_at timestamptz not null default now(),
  constraint vehicle_block_window_check check (starts_at < ends_at)
);

create index if not exists idx_vehicle_block_window_vehicle on vehicle_block_windows(vehicle_id, starts_at, ends_at);

create table if not exists vehicle_live_locations (
  vehicle_id text primary key references vehicles(id),
  latitude double precision not null,
  longitude double precision not null,
  speed_kmph double precision,
  heading_deg double precision,
  source text not null default 'internal_ping',
  updated_at timestamptz not null default now(),
  constraint vehicle_live_latitude_check check (latitude >= -90 and latitude <= 90),
  constraint vehicle_live_longitude_check check (longitude >= -180 and longitude <= 180),
  constraint vehicle_live_heading_check check (heading_deg is null or (heading_deg >= 0 and heading_deg < 360)),
  constraint vehicle_live_speed_check check (speed_kmph is null or speed_kmph >= 0)
);

create index if not exists idx_vehicle_live_locations_updated_at on vehicle_live_locations(updated_at desc);

create table if not exists damage_incidents (
  id text primary key,
  booking_id text not null references bookings(id),
  vehicle_id text not null references vehicles(id),
  reported_by text not null references app_users(id),
  description text not null,
  photo_urls text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists vehicle_documents (
  id text primary key,
  vehicle_id text not null references vehicles(id),
  doc_type text not null,
  file_url text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists vehicle_documents alter column expires_at drop not null;

create index if not exists idx_vehicle_documents_expiry on vehicle_documents(expires_at);

delete from vehicle_documents d1
using vehicle_documents d2
where d1.vehicle_id = d2.vehicle_id
  and d1.doc_type = d2.doc_type
  and (
    d1.updated_at < d2.updated_at
    or (d1.updated_at = d2.updated_at and d1.id > d2.id)
  );

create unique index if not exists idx_vehicle_documents_vehicle_doc_type
  on vehicle_documents(vehicle_id, doc_type);

create table if not exists payment_orders (
  id text primary key,
  booking_id text not null references bookings(id),
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  provider_payment_id text,
  provider_refund_id text,
  amount integer not null,
  refunded_amount integer,
  currency text not null default 'INR',
  status payment_status_type not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists payment_orders add column if not exists provider_payment_id text;
alter table if exists payment_orders add column if not exists provider_refund_id text;
alter table if exists payment_orders add column if not exists refunded_amount integer;

create unique index if not exists idx_payment_orders_booking_created
on payment_orders(booking_id)
where status = 'created'::payment_status_type;

create table if not exists api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function consume_api_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row api_rate_limits%rowtype;
  now_value timestamptz := clock_timestamp();
  reset_at timestamptz;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    return query select false, 0, p_window_seconds;
    return;
  end if;
  insert into api_rate_limits(key, window_started_at, request_count, updated_at)
  values (p_key, now_value, 1, now_value)
  on conflict (key) do update set
    window_started_at = case when api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now_value then now_value else api_rate_limits.window_started_at end,
    request_count = case when api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now_value then 1 else api_rate_limits.request_count + 1 end,
    updated_at = now_value;
  select * into current_row from api_rate_limits where key = p_key;
  reset_at := current_row.window_started_at + make_interval(secs => p_window_seconds);
  return query select current_row.request_count <= p_limit, greatest(0, p_limit - current_row.request_count), greatest(1, ceil(extract(epoch from (reset_at - now_value)))::integer);
end;
$$;

grant execute on function consume_api_rate_limit(text, integer, integer) to service_role;

create table if not exists payment_events (
  id text primary key,
  provider text not null default 'razorpay',
  provider_event_id text not null unique,
  payload_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists notification_jobs (
  id text primary key,
  channel text not null,
  template_key text not null,
  recipient text not null,
  payload jsonb not null,
  status notification_status_type not null default 'queued',
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  actor_id text not null references app_users(id),
  actor_role role_type not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table if exists audit_events drop constraint if exists audit_events_actor_id_fkey;

-- RLS
alter table app_users enable row level security;
alter table vehicles enable row level security;
alter table bookings enable row level security;
alter table kyc_records enable row level security;
alter table vehicle_block_windows enable row level security;
alter table vehicle_live_locations enable row level security;
alter table damage_incidents enable row level security;
alter table vehicle_documents enable row level security;
alter table payment_orders enable row level security;
alter table payment_events enable row level security;
alter table notification_jobs enable row level security;
alter table audit_events enable row level security;

create or replace function app_current_user_id()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;

create or replace function app_current_user_role()
returns role_type
language sql
stable
as $$
  select role from app_users where id = auth.uid()::text;
$$;

drop policy if exists users_self_select on app_users;
create policy users_self_select on app_users
for select to authenticated
using (id = app_current_user_id() or app_current_user_role() = 'admin');

drop policy if exists vehicles_customer_partner_admin_select on vehicles;
create policy vehicles_customer_partner_admin_select on vehicles
for select to authenticated
using (
  app_current_user_role() in ('customer', 'admin')
  or owner_id = app_current_user_id()
);

drop policy if exists bookings_customer_partner_admin_select on bookings;
create policy bookings_customer_partner_admin_select on bookings
for select to authenticated
using (
  user_id = app_current_user_id()
  or app_current_user_role() = 'admin'
  or exists (
    select 1 from vehicles v
    where v.id = bookings.vehicle_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists kyc_customer_admin_select on kyc_records;
create policy kyc_customer_admin_select on kyc_records
for select to authenticated
using (user_id = app_current_user_id() or app_current_user_role() = 'admin');

drop policy if exists kyc_admin_update on kyc_records;
create policy kyc_admin_update on kyc_records
for update to authenticated
using (app_current_user_role() = 'admin')
with check (app_current_user_role() = 'admin');

drop policy if exists block_partner_admin_select on vehicle_block_windows;
create policy block_partner_admin_select on vehicle_block_windows
for select to authenticated
using (
  app_current_user_role() = 'admin'
  or exists (
    select 1 from vehicles v
    where v.id = vehicle_block_windows.vehicle_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists incidents_customer_partner_admin_select on damage_incidents;
create policy incidents_customer_partner_admin_select on damage_incidents
for select to authenticated
using (
  reported_by = app_current_user_id()
  or app_current_user_role() = 'admin'
  or exists (
    select 1 from vehicles v
    where v.id = damage_incidents.vehicle_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists tracking_partner_admin_select on vehicle_live_locations;
create policy tracking_partner_admin_select on vehicle_live_locations
for select to authenticated
using (
  app_current_user_role() = 'admin'
  or exists (
    select 1 from vehicles v
    where v.id = vehicle_live_locations.vehicle_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists docs_partner_admin_select on vehicle_documents;
create policy docs_partner_admin_select on vehicle_documents
for select to authenticated
using (
  app_current_user_role() = 'admin'
  or exists (
    select 1 from vehicles v
    where v.id = vehicle_documents.vehicle_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists payment_orders_customer_partner_admin_select on payment_orders;
create policy payment_orders_customer_partner_admin_select on payment_orders
for select to authenticated
using (
  app_current_user_role() = 'admin'
  or exists (
    select 1 from bookings b where b.id = payment_orders.booking_id and b.user_id = app_current_user_id()
  )
  or exists (
    select 1 from bookings b
    join vehicles v on v.id = b.vehicle_id
    where b.id = payment_orders.booking_id and v.owner_id = app_current_user_id()
  )
);

drop policy if exists audit_admin_only_select on audit_events;
create policy audit_admin_only_select on audit_events
for select to authenticated
using (app_current_user_role() = 'admin');

-- Writes for domain tables are server-only in Phase 1 (service role).
