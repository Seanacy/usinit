-- Creator gift code: approved creators can opt in to a $3 gift code.
-- Each $3 gift: $2 to the Community Fund, $1 to the creator. Donor pays the card fee on top.

alter table public.creators add column if not exists gift_code text unique;
alter table public.creators add column if not exists gift_on_at timestamptz;
alter table public.creators add column if not exists gift_disclosure_ok boolean not null default false;

alter table public.creator_ledger drop constraint if exists creator_ledger_kind_check;
alter table public.creator_ledger add constraint creator_ledger_kind_check
  check (kind = any (array['scan','cashout','adjustment','gift']));

create table if not exists public.creator_gifts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  stripe_session_id text not null unique,
  gross_cents integer not null,
  base_cents integer not null,
  creator_cents integer not null,
  fund_cents integer not null,
  donor_name text,
  created_at timestamptz not null default now()
);
alter table public.creator_gifts enable row level security;

insert into public.settings(key, value) values
  ('creator_gift_on', 'true'::jsonb),
  ('creator_gift_cents', '300'::jsonb),
  ('creator_gift_creator_cents', '100'::jsonb)
on conflict (key) do nothing;

-- Creator turns on their gift code (must agree to tell followers they get paid: FTC)
create or replace function public.creator_turn_on_gift(p_agree boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare me public.creators; v text;
begin
  select * into me from public.creators where user_id = auth.uid();
  if me.id is null then raise exception 'Make your creator profile first.'; end if;
  if me.status <> 'approved' then raise exception 'Your creator profile has to be approved first.'; end if;
  if not coalesce(p_agree, false) then raise exception 'Check the box first: you must tell followers you get paid from each gift.'; end if;
  if me.gift_code is not null then return me.gift_code; end if;
  loop v := public.rand_code('G'); exit when not exists (select 1 from public.creators where gift_code = v); end loop;
  update public.creators set gift_code = v, gift_on_at = now(), gift_disclosure_ok = true where id = me.id;
  return v;
end $$;
grant execute on function public.creator_turn_on_gift(boolean) to authenticated;

-- Public: what a gift code page shows
create or replace function public.get_creator_gift(p_code text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when c.id is null then null else jsonb_build_object(
    'name', c.name,
    'on', coalesce((select (value)::text::boolean from public.settings where key = 'creator_gift_on'), true) and c.status = 'approved',
    'give_cents', public.setting_int('creator_gift_cents'),
    'creator_cents', public.setting_int('creator_gift_creator_cents'),
    'gifts', (select count(*) from public.creator_gifts g where g.creator_id = c.id),
    'fund_cents', (select coalesce(sum(fund_cents),0) from public.creator_gifts g where g.creator_id = c.id)) end
  from (select 1) x left join public.creators c on upper(c.gift_code) = upper(trim(p_code))
$$;
grant execute on function public.get_creator_gift(text) to anon, authenticated;

-- Creator dashboard: add the gift code block
create or replace function public.creator_dashboard()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with me as (select * from public.creators where user_id = auth.uid())
  select case when not exists (select 1 from me) then null else (select jsonb_build_object(
    'name', me.name, 'links', me.links, 'status', me.status, 'own_code', me.own_code,
    'balance_cents', (select coalesce(sum(amount_cents),0) from public.creator_ledger l where l.creator_id = me.id),
    'min_cashout_cents', public.setting_int('creator_min_cashout_cents'),
    'pending_cashout', (select amount_cents from public.creator_cashouts c where c.creator_id = me.id and c.status = 'pending' limit 1),
    'own', jsonb_build_object('scans_today', (select count(*) from public.digital_scans d where d.code = me.own_code and d.day = public.central_today()),
                              'scans_total', (select count(*) from public.digital_scans d where d.code = me.own_code),
                              'earned_cents', (select coalesce(sum(creator_cents),0) from public.digital_scans d where d.code = me.own_code)),
    'gift', jsonb_build_object('code', me.gift_code,
                               'give_cents', public.setting_int('creator_gift_cents'),
                               'creator_cents', public.setting_int('creator_gift_creator_cents'),
                               'gifts', (select count(*) from public.creator_gifts g where g.creator_id = me.id),
                               'earned_cents', (select coalesce(sum(creator_cents),0) from public.creator_gifts g where g.creator_id = me.id),
                               'fund_cents', (select coalesce(sum(fund_cents),0) from public.creator_gifts g where g.creator_id = me.id)),
    'collabs', coalesce((select jsonb_agg(jsonb_build_object('id', co.id, 'code', co.code, 'keep_cut', co.keep_cut, 'first_name', h.first_name, 'holder_code', h.holder_code,
        'scans_total', (select count(*) from public.digital_scans d where d.collab_id = co.id),
        'holder_cents', (select coalesce(sum(holder_cents),0) from public.digital_scans d where d.collab_id = co.id),
        'creator_cents', (select coalesce(sum(creator_cents),0) from public.digital_scans d where d.collab_id = co.id)) order by co.created_at desc)
      from public.creator_collabs co join public.holders h on h.id = co.holder_id where co.creator_id = me.id), '[]'::jsonb)) from me) end
$function$;

-- Admin: add gift totals per creator
create or replace function public.admin_creators()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when not public.is_admin() then null else jsonb_build_object(
    'creators', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'links', c.links, 'status', c.status, 'own_code', c.own_code,
        'gift_code', c.gift_code,
        'gifts', (select count(*) from public.creator_gifts g where g.creator_id = c.id),
        'gift_creator_cents', (select coalesce(sum(creator_cents),0) from public.creator_gifts g where g.creator_id = c.id),
        'gift_fund_cents', (select coalesce(sum(fund_cents),0) from public.creator_gifts g where g.creator_id = c.id),
        'email', (select email from auth.users u where u.id = c.user_id),
        'scans', (select count(*) from public.digital_scans d where d.creator_id = c.id),
        'balance_cents', (select coalesce(sum(amount_cents),0) from public.creator_ledger l where l.creator_id = c.id)) order by c.created_at desc) from public.creators c), '[]'::jsonb),
    'gift_totals', jsonb_build_object('gifts', (select count(*) from public.creator_gifts),
        'fund_cents', (select coalesce(sum(fund_cents),0) from public.creator_gifts),
        'creator_cents', (select coalesce(sum(creator_cents),0) from public.creator_gifts)),
    'cashouts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', c.name, 'amount_cents', x.amount_cents, 'status', x.status, 'created_at', x.created_at) order by x.created_at desc)
        from public.creator_cashouts x join public.creators c on c.id = x.creator_id), '[]'::jsonb)) end
$function$;
