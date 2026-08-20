-- Editable Design documents and immutable workspace image libraries.
-- All access remains service-role-only; the Next.js server applies member/admin
-- authorization before issuing database or R2 operations.

create table if not exists image_to_graph.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references image_to_graph.app_users(id) on delete cascade,
  kind text not null default 'document' check (kind in ('document', 'template')),
  title text not null check (char_length(title) between 1 and 160),
  document_version integer not null default 1 check (document_version > 0),
  document jsonb not null,
  canvas_width integer not null check (canvas_width between 1 and 24000),
  canvas_height integer not null check (canvas_height between 1 and 24000),
  revision bigint not null default 1 check (revision > 0),
  preview_path text,
  preview_thumb_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((canvas_width::bigint * canvas_height::bigint) <= 16000000),
  check (octet_length(document::text) <= 4194304)
);

create table if not exists image_to_graph.design_files (
  id uuid primary key,
  design_id uuid not null references image_to_graph.designs(id) on delete cascade,
  user_id uuid not null references image_to_graph.app_users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  path text not null unique,
  thumb_path text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width integer not null check (width between 1 and 24000),
  height integer not null check (height between 1 and 24000),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now(),
  check ((width::bigint * height::bigint) <= 16000000)
);

create table if not exists image_to_graph.design_library_items (
  id uuid primary key,
  user_id uuid not null references image_to_graph.app_users(id) on delete cascade,
  kind text not null check (kind in ('design', 'clipart')),
  title text not null check (char_length(title) between 1 and 160),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 20),
  path text not null unique,
  thumb_path text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width integer not null check (width between 1 and 24000),
  height integer not null check (height between 1 and 24000),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  source_design_id uuid references image_to_graph.designs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((width::bigint * height::bigint) <= 16000000)
);

create index if not exists designs_owner_kind_updated_idx
  on image_to_graph.designs (user_id, kind, updated_at desc, id desc);
create index if not exists designs_kind_updated_idx
  on image_to_graph.designs (kind, updated_at desc, id desc);
create index if not exists design_files_design_created_idx
  on image_to_graph.design_files (design_id, created_at, id);
create index if not exists design_library_kind_updated_idx
  on image_to_graph.design_library_items (kind, updated_at desc, id desc);
create index if not exists design_library_owner_updated_idx
  on image_to_graph.design_library_items (user_id, updated_at desc, id desc);
create index if not exists design_library_tags_idx
  on image_to_graph.design_library_items using gin (tags);
create index if not exists design_library_title_trgm_idx
  on image_to_graph.design_library_items using gin (title extensions.gin_trgm_ops);
create index if not exists app_users_email_trgm_idx
  on image_to_graph.app_users using gin (email extensions.gin_trgm_ops);

drop trigger if exists designs_touch_updated_at on image_to_graph.designs;
create trigger designs_touch_updated_at
before update on image_to_graph.designs
for each row execute function image_to_graph.touch_updated_at();

drop trigger if exists design_library_items_touch_updated_at on image_to_graph.design_library_items;
create trigger design_library_items_touch_updated_at
before update on image_to_graph.design_library_items
for each row execute function image_to_graph.touch_updated_at();

alter table image_to_graph.designs enable row level security;
alter table image_to_graph.design_files enable row level security;
alter table image_to_graph.design_library_items enable row level security;

revoke all on image_to_graph.designs, image_to_graph.design_files, image_to_graph.design_library_items
  from public, anon, authenticated;
grant all privileges on image_to_graph.designs, image_to_graph.design_files, image_to_graph.design_library_items
  to service_role;

create or replace function image_to_graph.get_design_library_summaries(
  p_query text default null,
  p_kind text default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 49
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  title text,
  tags text[],
  path text,
  thumb_path text,
  mime_type text,
  width integer,
  height integer,
  size_bytes bigint,
  source_design_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  owner_email text,
  owner_display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    item.id, item.user_id, item.kind, item.title, item.tags, item.path,
    item.thumb_path, item.mime_type, item.width, item.height, item.size_bytes,
    item.source_design_id, item.created_at, item.updated_at,
    owner.email, owner.display_name
  from image_to_graph.design_library_items as item
  join image_to_graph.app_users as owner on owner.id = item.user_id
  where (p_kind is null or item.kind = p_kind)
    and (
      nullif(btrim(p_query), '') is null
      or item.title ilike ('%' || btrim(p_query) || '%')
      or owner.email ilike ('%' || btrim(p_query) || '%')
      or exists (
        select 1 from unnest(item.tags) as tag
        where tag ilike ('%' || btrim(p_query) || '%')
      )
    )
    and (
      p_cursor_updated_at is null
      or p_cursor_id is null
      or (item.updated_at, item.id) < (p_cursor_updated_at, p_cursor_id)
    )
  order by item.updated_at desc, item.id desc
  limit greatest(1, least(coalesce(p_limit, 49), 101));
$$;

revoke all on function image_to_graph.get_design_library_summaries(text, text, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function image_to_graph.get_design_library_summaries(text, text, timestamptz, uuid, integer)
  to service_role;

notify pgrst, 'reload schema';
