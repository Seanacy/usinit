-- One code per holder: the street code (/s/####) works everywhere.
-- Scans near a street area (with location) go through process_scan (zone ads, Community Fund).
-- Scans with no location or far away are handled as online scans (online ads only, never the Community Fund).
insert into public.settings(key, value) values
  ('street_radius_m', '48280'::jsonb),          -- 30 miles
  ('street_center_lat', '44.9778'::jsonb),       -- downtown Minneapolis
  ('street_center_lng', '-93.2650'::jsonb)
on conflict (key) do nothing;

create or replace function public.process_any_scan(p_code text, p_lat double precision, p_lng double precision, p_device text,
  p_champ text default null, p_acc double precision default null, p_geo text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare h public.holders; v_r double precision := public.setting_int('street_radius_m'); v_street boolean; r jsonb;
begin
  select * into h from public.holders where holder_code = p_code and status = 'active';
  if not found then return jsonb_build_object('error','not_found'); end if;
  v_street := p_lat is not null and p_lng is not null and (
    public.dist_m((select (value #>> '{}')::double precision from public.settings where key='street_center_lat'),
                  (select (value #>> '{}')::double precision from public.settings where key='street_center_lng'), p_lat, p_lng) <= v_r
    or exists (select 1 from public.advertising_zones z where z.active and not z.admin_off and public.dist_m(z.lat, z.lng, p_lat, p_lng) <= v_r));
  if v_street or p_champ is not null or h.digital_code is null then
    return public.process_scan(p_code, p_lat, p_lng, p_device, p_champ, p_acc) || jsonb_build_object('online', false);
  end if;
  r := public.process_digital_scan(h.digital_code, p_device, p_geo);
  return jsonb_build_object('scan_id', null, 'status', 'ONLINE', 'earned', coalesce((r->>'earned')::boolean, false), 'verified', false,
    'holder', jsonb_build_object('first_name', h.first_name, 'code', h.holder_code, 'photo_url', h.photo_url),
    'content', r->'content', 'opener', null, 'online', true);
end $$;

create or replace function public.holder_code_for_digital(p_code text)
returns text language sql stable security definer set search_path to 'public' as $$
  select holder_code from public.holders where digital_code = upper(trim(p_code)) and status = 'active'
$$;

revoke all on function public.process_any_scan(text,double precision,double precision,text,text,double precision,text) from public;
grant execute on function public.process_any_scan(text,double precision,double precision,text,text,double precision,text) to anon, authenticated;
revoke all on function public.holder_code_for_digital(text) from public;
grant execute on function public.holder_code_for_digital(text) to anon, authenticated;
