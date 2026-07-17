create extension if not exists pg_trgm with schema extensions;

create index if not exists projects_user_updated_id_idx
  on image_to_graph.projects (user_id, updated_at desc, id desc);

create index if not exists projects_title_trgm_idx
  on image_to_graph.projects using gin (title extensions.gin_trgm_ops);

create unique index if not exists project_palettes_project_sort_unique_idx
  on image_to_graph.project_palettes (project_id, sort_order);

create index if not exists email_otp_attempts_active_idx
  on image_to_graph.email_otp_attempts (email, purpose, created_at desc)
  where consumed_at is null;

create or replace function image_to_graph.save_project_state(
  p_project_id uuid,
  p_user_id uuid,
  p_title text,
  p_description text,
  p_settings jsonb,
  p_width integer,
  p_height integer,
  p_pixel_size integer,
  p_grid_cell_size integer,
  p_color_count integer,
  p_palettes jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update image_to_graph.projects
  set title = p_title,
      description = nullif(btrim(p_description), ''),
      settings = p_settings,
      width = p_width,
      height = p_height,
      pixel_size = p_pixel_size,
      grid_cell_size = p_grid_cell_size,
      color_count = p_color_count
  where id = p_project_id
    and user_id = p_user_id;

  if not found then
    return false;
  end if;

  delete from image_to_graph.project_palettes
  where project_id = p_project_id;

  insert into image_to_graph.project_palettes (
    project_id,
    color_name,
    hex_code,
    locked,
    cell_count,
    sort_order
  )
  select
    p_project_id,
    coalesce(nullif(palette.name, ''), 'Color ' || (palette.sort_order + 1)::text),
    palette.hex,
    palette.locked,
    palette.cell_count,
    palette.sort_order
  from jsonb_to_recordset(coalesce(p_palettes, '[]'::jsonb)) as palette(
    name text,
    hex text,
    locked boolean,
    cell_count integer,
    sort_order integer
  )
  order by palette.sort_order;

  return true;
end;
$$;

revoke all on function image_to_graph.save_project_state(
  uuid, uuid, text, text, jsonb, integer, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;
grant execute on function image_to_graph.save_project_state(
  uuid, uuid, text, text, jsonb, integer, integer, integer, integer, integer, jsonb
) to service_role;

create or replace function image_to_graph.verify_login_otp(
  p_email text,
  p_otp_hash text,
  p_now timestamptz default now()
)
returns table (
  result text,
  user_id uuid,
  user_email text,
  user_role text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_user image_to_graph.app_users%rowtype;
  attempt image_to_graph.email_otp_attempts%rowtype;
begin
  select app_user.*
  into active_user
  from image_to_graph.app_users as app_user
  where app_user.email = lower(btrim(p_email))
    and app_user.status = 'active'
  limit 1;

  if not found then
    return query select 'not_allowed'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select otp_attempt.*
  into attempt
  from image_to_graph.email_otp_attempts as otp_attempt
  where otp_attempt.email = active_user.email
    and otp_attempt.app_user_id = active_user.id
    and otp_attempt.purpose = 'app_login'
    and otp_attempt.consumed_at is null
  order by otp_attempt.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if attempt.expires_at <= p_now then
    return query select 'expired'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if attempt.attempt_count >= 5 then
    return query select 'too_many'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if attempt.otp_hash <> p_otp_hash then
    update image_to_graph.email_otp_attempts
    set attempt_count = attempt_count + 1
    where id = attempt.id;
    return query select 'invalid'::text, null::uuid, null::text, null::text;
    return;
  end if;

  update image_to_graph.email_otp_attempts
  set attempt_count = attempt_count + 1,
      consumed_at = p_now
  where id = attempt.id;

  update image_to_graph.app_users
  set last_login_at = p_now
  where id = active_user.id;

  return query select 'ok'::text, active_user.id, active_user.email, active_user.role::text;
end;
$$;

revoke all on function image_to_graph.verify_login_otp(text, text, timestamptz) from public, anon, authenticated;
grant execute on function image_to_graph.verify_login_otp(text, text, timestamptz) to service_role;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/x-pdf'
    ]::text[]
where id = 'graph-pixel-original-images';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/png', 'application/pdf']::text[]
where id = 'graph-pixel-processed-images';
