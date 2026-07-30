-- Admin visibility over every project.
--
-- `get_project_summaries` was hard-scoped to `p_user_id`, so an admin could only
-- ever see their own dashboard. Admins now manage the workspace allowlist, so
-- they also need to open and support any member's project. The scope stays an
-- explicit parameter rather than an implicit role lookup: authorization is
-- decided in the Next.js server (service-role only), and the function keeps a
-- single, auditable switch.
--
-- The owner columns are new, so the previous signature is dropped first —
-- `create or replace` cannot change a function's result type — and adding the
-- parameter to the same signature would leave two overloads PostgREST could
-- resolve ambiguously.

-- The owner-scoped index cannot serve the all-owners ordering.
create index if not exists projects_updated_id_idx
  on image_to_graph.projects (updated_at desc, id desc);

drop function if exists image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer);

create function image_to_graph.get_project_summaries(
  p_user_id uuid,
  p_query text default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 26,
  p_include_all_owners boolean default false
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  original_image_path text,
  processed_image_path text,
  processed_thumb_path text,
  width integer,
  height integer,
  pixel_size integer,
  grid_cell_size integer,
  color_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  palette_preview jsonb,
  owner_email text,
  owner_display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    project.id,
    project.user_id,
    project.title,
    project.description,
    project.original_image_path,
    project.processed_image_path,
    project.processed_thumb_path,
    project.width,
    project.height,
    project.pixel_size,
    project.grid_cell_size,
    project.color_count,
    project.created_at,
    project.updated_at,
    coalesce(palette.palette_preview, '[]'::jsonb),
    project_owner.email,
    project_owner.display_name
  from image_to_graph.projects as project
  join image_to_graph.app_users as project_owner on project_owner.id = project.user_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', swatch.id,
        'color_name', swatch.color_name,
        'hex_code', swatch.hex_code,
        'locked', swatch.locked,
        'cell_count', swatch.cell_count,
        'sort_order', swatch.sort_order
      )
      order by swatch.sort_order
    ) as palette_preview
    from (
      select
        project_palette.id,
        project_palette.color_name,
        project_palette.hex_code,
        project_palette.locked,
        project_palette.cell_count,
        project_palette.sort_order
      from image_to_graph.project_palettes as project_palette
      where project_palette.project_id = project.id
      order by project_palette.sort_order
      limit 6
    ) as swatch
  ) as palette on true
  where (coalesce(p_include_all_owners, false) or project.user_id = p_user_id)
    and (
      nullif(btrim(p_query), '') is null
      or project.title ilike ('%' || btrim(p_query) || '%')
      -- Searching the owner is only meaningful once other people's projects are
      -- in scope; it would otherwise match every one of the caller's own rows.
      or (coalesce(p_include_all_owners, false) and project_owner.email ilike ('%' || btrim(p_query) || '%'))
    )
    and (
      p_cursor_updated_at is null
      or p_cursor_id is null
      or (project.updated_at, project.id) < (p_cursor_updated_at, p_cursor_id)
    )
  order by project.updated_at desc, project.id desc
  limit greatest(1, least(coalesce(p_limit, 26), 101));
$$;

revoke all on function image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer, boolean)
  to service_role;
