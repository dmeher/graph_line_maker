-- Card thumbnails for the projects dashboard.
--
-- The dashboard rendered `processed_image_path` — the full editor canvas PNG —
-- as its card image, up to 25 cards per page. Storage moved to Cloudflare R2 so
-- that egress is free, but it is still tens of megabytes across the wire per
-- page view, so the editor now uploads a bounded WebP derivative alongside the
-- processed image and the dashboard renders that instead.
--
-- Nullable with no backfill: projects saved before this exists keep falling back
-- to the full-size image until their next save regenerates a thumbnail.

alter table image_to_graph.projects
  add column if not exists processed_thumb_path text;

comment on column image_to_graph.projects.processed_thumb_path is
  'Bounded WebP derivative of processed_image_path used by dashboard cards. Null for projects saved before derivatives existed.';

-- Re-declare the summaries function with the new column. `create or replace`
-- cannot change a function''s result type, so drop the old signature first.
drop function if exists image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer);

create function image_to_graph.get_project_summaries(
  p_user_id uuid,
  p_query text default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 26
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
  palette_preview jsonb
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
    coalesce(palette.palette_preview, '[]'::jsonb)
  from image_to_graph.projects as project
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
  where project.user_id = p_user_id
    and (
      nullif(btrim(p_query), '') is null
      or project.title ilike ('%' || btrim(p_query) || '%')
    )
    and (
      p_cursor_updated_at is null
      or p_cursor_id is null
      or (project.updated_at, project.id) < (p_cursor_updated_at, p_cursor_id)
    )
  order by project.updated_at desc, project.id desc
  limit greatest(1, least(coalesce(p_limit, 26), 101));
$$;

revoke all on function image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function image_to_graph.get_project_summaries(uuid, text, timestamptz, uuid, integer)
  to service_role;
