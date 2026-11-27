-- Busy spot nudge (soft rule). Never blocks or holds pay.
-- A holder is "active" at a spot after 3+ verified scans in the last 15 minutes.
-- If a newer active holder is within 20 ft of an earlier active holder, only the newer one gets a nudge.
-- Holders who keep crowding others on 3+ days in 14 days show in Admin.

insert into public.settings(key, value) values
  ('crowd_ft', '20'::jsonb),
  ('crowd_min_scans', '3'::jsonb),
  ('crowd_window_min', '15'::jsonb),
  ('crowd_flag_days', '3'::jsonb)
on conflict (key) do nothing;

create table if not exists public.crowd_events (
  id uuid primary key default gen_random_uuid(),
  holder_id uuid not null references public.holders(id) on delete cascade,      -- the newcomer
  near_holder_id uuid not null references public.holders(id) on delete cascade, -- the holder who was there first
  day date not null default public.central_today(),
  created_at timestamptz not null default now(),
  unique (holder_id, near_holder_id, day)
);
alter table public.crowd_events enable row level security;

-- Where a holder is active right now (internal only; never returned to the public)
create or replace function public.holder_spot(p_holder uuid,
  out active boolean, out lat double precision, out lng double precision, out since timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_win interval := make_interval(mins => public.setting_int('crowd_window_min'));
  v_n int; r record; v_prev timestamptz;
begin
  select count(*), avg(s.lat), avg(s.lng) into v_n, lat, lng from public.scans s
   where s.holder_id = p_holder and s.verified and s.lat is not null and s.created_at > now() - v_win;
  active := v_n >= public.setting_int('crowd_min_scans');
  if not active then lat := null; lng := null; return; end if;
  -- Start of the current streak: walk back until a gap longer than the window
  for r in select s.created_at from public.scans s where s.holder_id = p_holder and s.verified and s.lat is not null
           and s.created_at > now() - interval '24 hours' order by s.created_at desc loop
    if v_prev is not null and v_prev - r.created_at > v_win then exit; end if;
    v_prev := r.created_at;
  end loop;
  since := v_prev;
end $$;
revoke all on function public.holder_spot(uuid) from public, anon, authenticated;

-- After each verified scan, log crowding (the newer holder only). Never affects the scan.
create or replace function public.log_crowding() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record; o record; oid uuid; v_m double precision := public.setting_int('crowd_ft') * 0.3048;
begin
  begin
    select * into me from public.holder_spot(new.holder_id);
    if not me.active then return new; end if;
    for oid in select distinct s.holder_id from public.scans s
      where s.holder_id <> new.holder_id and s.verified and s.lat is not null
        and s.created_at > now() - make_interval(mins => public.setting_int('crowd_window_min'))
        and public.dist_m(s.lat, s.lng, me.lat, me.lng) <= v_m * 3 loop
      select * into o from public.holder_spot(oid);
      if o.active and public.dist_m(o.lat, o.lng, me.lat, me.lng) <= v_m then
        if o.since <= me.since then
          insert into public.crowd_events(holder_id, near_holder_id) values (new.holder_id, oid) on conflict do nothing;
        else
          insert into public.crowd_events(holder_id, near_holder_id) values (oid, new.holder_id) on conflict do nothing;
        end if;
      end if;
    end loop;
  exception when others then null; -- a crowding check must never break a scan
  end;
  return new;
end $$;

drop trigger if exists scans_log_crowding on public.scans;
create trigger scans_log_crowding after insert on public.scans
  for each row when (new.verified and new.lat is not null) execute function public.log_crowding();

-- Holder's own nudge: true only if they are the newer active holder within 20 ft. No locations returned.
create or replace function public.my_crowd_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h public.holders; me record; o record; oid uuid; v_m double precision := public.setting_int('crowd_ft') * 0.3048;
begin
  select * into h from public.holders where user_id = auth.uid();
  if not found then return jsonb_build_object('crowded', false); end if;
  select * into me from public.holder_spot(h.id);
  if not me.active then return jsonb_build_object('crowded', false); end if;
  for oid in select distinct s.holder_id from public.scans s
    where s.holder_id <> h.id and s.verified and s.lat is not null
      and s.created_at > now() - make_interval(mins => public.setting_int('crowd_window_min'))
      and public.dist_m(s.lat, s.lng, me.lat, me.lng) <= v_m * 3 loop
    select * into o from public.holder_spot(oid);
    if o.active and o.since <= me.since and public.dist_m(o.lat, o.lng, me.lat, me.lng) <= v_m then
      return jsonb_build_object('crowded', true);
    end if;
  end loop;
  return jsonb_build_object('crowded', false);
end $$;
grant execute on function public.my_crowd_status() to authenticated;

-- Admin: holders who crowded others on 3+ different days in the last 14 days
create or replace function public.admin_crowders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(x order by x.days desc, x.last_day desc) from (
    select h.id, h.first_name, h.holder_code, count(distinct e.day) as days, max(e.day) as last_day
    from public.crowd_events e join public.holders h on h.id = e.holder_id
    where e.day > public.central_today() - 14
    group by h.id, h.first_name, h.holder_code
    having count(distinct e.day) >= public.setting_int('crowd_flag_days')) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_crowders() to authenticated;

-- Public Champion rules numbers for the Champion page
create or replace function public.champion_rules() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ft', public.setting_int('champ_circle_ft'), 'max', public.setting_int('champ_circle_max'), 'hrs', public.setting_int('champ_cooldown_hours'));
$$;
grant execute on function public.champion_rules() to anon, authenticated;
