-- "Give $3 only" mode: a main switch for every holder plus a per-holder setting.
-- Give-only scans show just the $3 ask (no ad, no scan pay). $3 gift = $2 holder, $1 Community Fund.
insert into public.settings(key, value) values ('scan_give_only', 'false'::jsonb) on conflict (key) do nothing;

alter table public.holders add column if not exists give_mode text not null default 'follow';
alter table public.holders drop constraint if exists holders_give_mode_check;
alter table public.holders add constraint holders_give_mode_check check (give_mode in ('follow','always','never'));

create or replace function public.holder_give_only(h public.holders)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case h.give_mode
    when 'always' then true
    when 'never' then false
    else coalesce((select (value)::text::boolean from public.settings where key = 'scan_give_only'), false) end
$$;

create or replace function public.get_public_holder(p_code text)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
 select jsonb_build_object('first_name', first_name, 'code', holder_code, 'photo_url', photo_url, 'story', story, 'answers', answers - 'phone' - 'starter', 'perspective', case when perspective_at > now() - interval '3 days' then perspective_label(perspective) end, 'general_area', general_area,
   'give_only', public.holder_give_only(h),
   'give_hidden', h.give_mode = 'never',
   'count_today', (select count(*) from public.scans s where s.holder_id = h.id and s.day = public.central_today() and s.verified),
   'stars', (select count(*) from public.holder_stars st where st.holder_id = h.id),
   'starred_by_me', exists (select 1 from public.holder_stars st where st.holder_id = h.id and st.user_id = auth.uid()),
   'followers', (select count(*) from public.holder_follows f where f.holder_id = h.id),
   'following', exists (select 1 from public.holder_follows f where f.holder_id = h.id and f.user_id = auth.uid()),
   'is_me', h.user_id = auth.uid(),
   'share_milestones', case when h.user_id = auth.uid() then h.share_milestones end,
   'can_sponsor', exists (select 1 from public.advertisers a where a.user_id = auth.uid() and a.status = 'approved'),
   'sponsoring', exists (select 1 from public.holder_sponsors sp join public.advertisers a on a.id = sp.advertiser_id where sp.holder_id = h.id and a.user_id = auth.uid()),
   'sponsors', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.business_name) order by sp.created_at)
      from public.holder_sponsors sp join public.advertisers a on a.id = sp.advertiser_id where sp.holder_id = h.id and a.status = 'approved'), '[]'::jsonb),
   'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'body', u.body, 'photo_url', u.photo_url, 'created_at', u.created_at) order by u.created_at desc)
      from (select * from public.holder_updates u where u.holder_id = h.id and not u.hidden order by created_at desc limit 20) u), '[]'::jsonb))
 from public.holders h where holder_code = p_code and status = 'active'
$function$;
