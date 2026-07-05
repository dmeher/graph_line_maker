create schema if not exists image_to_graph;

create extension if not exists pgcrypto with schema extensions;

revoke all on schema image_to_graph from public;
grant usage on schema image_to_graph to service_role;

create or replace function image_to_graph.touch_updated_at()
returns trigger
language plpgsql
set search_path = image_to_graph, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists image_to_graph.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  invited_by_id uuid references image_to_graph.app_users(id) on delete set null,
  invited_by_email text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_key
  on image_to_graph.app_users (email);

create table if not exists image_to_graph.email_otp_attempts (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid references image_to_graph.app_users(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  otp_hash text not null,
  purpose text not null default 'app_login' check (purpose = 'app_login'),
  consumed_at timestamptz,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists image_to_graph.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references image_to_graph.app_users(id) on delete cascade,
  title text not null,
  description text,
  original_image_path text,
  processed_image_path text,
  settings jsonb not null default '{}'::jsonb,
  width integer not null default 0 check (width >= 0),
  height integer not null default 0 check (height >= 0),
  pixel_size integer not null default 12 check (pixel_size > 0),
  grid_cell_size integer not null default 12 check (grid_cell_size > 0),
  color_count integer not null default 0 check (color_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists image_to_graph.project_palettes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references image_to_graph.projects(id) on delete cascade,
  color_name text not null,
  hex_code text not null check (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  locked boolean not null default false,
  cell_count integer not null default 0 check (cell_count >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_otp_attempts_email_purpose_created_idx
  on image_to_graph.email_otp_attempts (email, purpose, created_at desc);

create index if not exists email_otp_attempts_expires_at_idx
  on image_to_graph.email_otp_attempts (expires_at);

create index if not exists projects_user_updated_idx
  on image_to_graph.projects (user_id, updated_at desc);

create index if not exists projects_title_search_idx
  on image_to_graph.projects using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

create index if not exists project_palettes_project_sort_idx
  on image_to_graph.project_palettes (project_id, sort_order);

drop trigger if exists app_users_touch_updated_at on image_to_graph.app_users;
create trigger app_users_touch_updated_at
before update on image_to_graph.app_users
for each row execute function image_to_graph.touch_updated_at();

drop trigger if exists projects_touch_updated_at on image_to_graph.projects;
create trigger projects_touch_updated_at
before update on image_to_graph.projects
for each row execute function image_to_graph.touch_updated_at();

drop trigger if exists project_palettes_touch_updated_at on image_to_graph.project_palettes;
create trigger project_palettes_touch_updated_at
before update on image_to_graph.project_palettes
for each row execute function image_to_graph.touch_updated_at();

alter table image_to_graph.app_users enable row level security;
alter table image_to_graph.email_otp_attempts enable row level security;
alter table image_to_graph.projects enable row level security;
alter table image_to_graph.project_palettes enable row level security;

revoke all on all tables in schema image_to_graph from anon, authenticated;
revoke all on all sequences in schema image_to_graph from anon, authenticated;
revoke all on schema image_to_graph from anon, authenticated;
revoke execute on all functions in schema image_to_graph from anon, authenticated;
grant all privileges on all tables in schema image_to_graph to service_role;
grant usage on all sequences in schema image_to_graph to service_role;
grant usage on schema image_to_graph to service_role;
grant execute on all functions in schema image_to_graph to service_role;

revoke execute on function image_to_graph.touch_updated_at() from public;
grant execute on function image_to_graph.touch_updated_at() to service_role;

insert into image_to_graph.app_users (email, display_name, role, status)
values ('dmeher1996@gmail.com', 'Debendra Meher', 'admin', 'active')
on conflict (email) do update
set role = 'admin',
    status = 'active',
    display_name = coalesce(image_to_graph.app_users.display_name, excluded.display_name),
    updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'graph-pixel-original-images',
    'graph-pixel-original-images',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
  ),
  (
    'graph-pixel-processed-images',
    'graph-pixel-processed-images',
    false,
    10485760,
    array['image/png', 'application/pdf']::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  current_schemas text;
  next_schemas text;
begin
  select split_part(setting, '=', 2)
    into current_schemas
  from pg_roles
  cross join unnest(coalesce(rolconfig, array[]::text[])) as setting
  where rolname = 'authenticator'
    and setting like 'pgrst.db_schemas=%'
  limit 1;

  with raw_schemas as (
    select trim(value) as name, ordinality as ord
    from regexp_split_to_table(coalesce(current_schemas, 'public,storage,graphql_public'), ',') with ordinality as values(value, ordinality)
    union all
    select 'image_to_graph', 10000
  ),
  deduped_schemas as (
    select name, min(ord) as ord
    from raw_schemas
    where name <> ''
      and to_regnamespace(name) is not null
    group by name
  )
  select string_agg(name, ',' order by ord)
    into next_schemas
  from deduped_schemas;

  execute format('alter role authenticator set pgrst.db_schemas = %L', next_schemas);
end $$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
