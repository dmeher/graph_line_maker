create index if not exists email_otp_attempts_ip_created_idx
  on image_to_graph.email_otp_attempts ((metadata ->> 'ip'), created_at desc)
  where purpose = 'app_login';

create or replace function image_to_graph.get_project_summaries(
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

create or replace function image_to_graph.create_login_otp_attempt(
  p_app_user_id uuid,
  p_email text,
  p_otp_hash text,
  p_expires_at timestamptz,
  p_ip text,
  p_user_agent text,
  p_now timestamptz default now()
)
returns table (
  result text,
  retry_after_seconds integer,
  attempt_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  normalized_ip text := left(coalesce(nullif(btrim(p_ip), ''), 'unknown'), 128);
  window_start timestamptz := p_now - interval '15 minutes';
  email_count integer;
  ip_count integer;
  oldest_email_hit timestamptz;
  oldest_ip_hit timestamptz;
  new_attempt_id uuid;
begin
  if not exists (
    select 1
    from image_to_graph.app_users as app_user
    where app_user.id = p_app_user_id
      and app_user.email = normalized_email
      and app_user.status = 'active'
  ) then
    return query select 'not_allowed'::text, 0, null::uuid;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('graph-pixel-otp-email:' || normalized_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('graph-pixel-otp-ip:' || normalized_ip, 0));

  select count(*)::integer, min(otp_attempt.created_at)
  into email_count, oldest_email_hit
  from image_to_graph.email_otp_attempts as otp_attempt
  where otp_attempt.email = normalized_email
    and otp_attempt.purpose = 'app_login'
    and otp_attempt.created_at >= window_start;

  if email_count >= 5 then
    return query
      select
        'email_limited'::text,
        greatest(1, ceil(extract(epoch from (oldest_email_hit + interval '15 minutes' - p_now)))::integer),
        null::uuid;
    return;
  end if;

  select count(*)::integer, min(otp_attempt.created_at)
  into ip_count, oldest_ip_hit
  from image_to_graph.email_otp_attempts as otp_attempt
  where otp_attempt.purpose = 'app_login'
    and otp_attempt.metadata ->> 'ip' = normalized_ip
    and otp_attempt.created_at >= window_start;

  if ip_count >= 20 then
    return query
      select
        'ip_limited'::text,
        greatest(1, ceil(extract(epoch from (oldest_ip_hit + interval '15 minutes' - p_now)))::integer),
        null::uuid;
    return;
  end if;

  insert into image_to_graph.email_otp_attempts (
    app_user_id,
    email,
    otp_hash,
    purpose,
    expires_at,
    metadata,
    created_at
  )
  values (
    p_app_user_id,
    normalized_email,
    p_otp_hash,
    'app_login',
    p_expires_at,
    jsonb_build_object('userAgent', left(coalesce(p_user_agent, ''), 512), 'ip', normalized_ip),
    p_now
  )
  returning id into new_attempt_id;

  return query select 'ok'::text, 0, new_attempt_id;
end;
$$;

revoke all on function image_to_graph.create_login_otp_attempt(uuid, text, text, timestamptz, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function image_to_graph.create_login_otp_attempt(uuid, text, text, timestamptz, text, text, timestamptz)
  to service_role;
