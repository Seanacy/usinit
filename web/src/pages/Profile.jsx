import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase, useSession } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import AuthBox from '../components/AuthBox'

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`
  if (s < 86400 * 7) return `${Math.round(s / 86400)} day${Math.round(s / 86400) === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const people = (n, rest) => `${n} ${n === 1 ? 'person' : 'people'}${rest}`

// Star and Follow both need a free account. Tapping either one while logged out asks for it,
// then finishes the action after they log in or confirm their email.
function SupportButtons({ h, code, onChange, onReload }) {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [ask, setAsk] = useState(null) // null | 'star' | 'follow'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const pending = useRef(params.get('star') === '1' ? 'star' : params.get('follow') === '1' ? 'follow' : null)

  async function run(action) {
    setBusy(true); setErr(null)
    const fn = { star: 'toggle_star', follow: 'toggle_follow', sponsor: 'toggle_sponsor' }[action]
    const { data, error } = await supabase.rpc(fn, { p_code: code })
    setBusy(false)
    if (error) return setErr(error.message)
    if (action === 'sponsor') return onReload()
    onChange(action === 'star' ? { starred_by_me: data.starred, stars: data.stars } : { following: data.following, followers: data.followers })
  }
  useEffect(() => {
    if (!session || h.is_me || !pending.current) return
    const a = pending.current
    pending.current = null; setAsk(null)
    if (params.get(a)) { params.delete(a); setParams(params, { replace: true }) }
    if (a === 'star' ? !h.starred_by_me : !h.following) run(a)
  }, [session]) // eslint-disable-line

  if (h.is_me) return (
    <p className="mt-4 font-bold">⭐ {people(h.stars, ' rooting for you')} · {people(h.followers, ' following you')}</p>
  )
  const tap = (a) => (session ? run(a) : (pending.current = a, setAsk(a)))
  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => tap('star')} className={h.starred_by_me ? 'btn-black' : 'btn-orange'}>{h.starred_by_me ? '⭐ Starred' : `⭐ Star ${h.first_name}`}</button>
        <button disabled={busy} onClick={() => tap('follow')} className={h.following ? 'btn-black' : 'btn-outline'}>{h.following ? '✓ Following' : `Follow ${h.first_name}`}</button>
        {h.can_sponsor && <button disabled={busy} onClick={() => run('sponsor')} className={h.sponsoring ? 'btn-black' : 'btn-outline'}>{h.sponsoring ? '✓ Sponsoring' : `Sponsor ${h.first_name}`}</button>}
      </div>
      {h.can_sponsor && !h.sponsoring && <p className="muted text-xs">Sponsoring is free. It shows "Supported by" with your business name on {h.first_name}'s page.</p>}
      <p className="text-sm font-bold">{people(h.stars, ' rooting for')} {h.first_name} · {people(h.followers, ' following')}</p>
      {err && <Notice kind="error">{err}</Notice>}
      {ask && !session && (
        <div className="pt-2">
          <AuthBox title={`Create a free account to ${ask} ${h.first_name}`}
            intro={ask === 'follow' ? `Following lets you see ${h.first_name}'s updates. Scanning and giving never need an account.` : 'Scanning and giving never need an account. An account just lets you star holders and keep your list.'}
            redirectPath={`/p/${code}?${ask}=1`} role="supporter" />
          <button className="mt-2 w-full py-2 font-bold text-neutral-500" onClick={() => { pending.current = null; setAsk(null) }}>Not now</button>
        </div>
      )}
    </div>
  )
}

function Updates({ list, name }) {
  if (!list?.length) return null
  return (
    <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <p className="text-lg font-extrabold">Updates from {name}</p>
      {list.map((u) => (
        <div key={u.id} className={u.kind === 'milestone' ? 'rounded-xl bg-orange/15 p-3' : ''}>
          <p className="muted text-xs">{u.kind === 'milestone' ? 'Milestone · ' : ''}{ago(u.created_at)}</p>
          <p className={`whitespace-pre-line ${u.kind === 'milestone' ? 'font-extrabold' : ''}`}>{u.body}</p>
          {u.photo_url && <img src={u.photo_url} alt="" className="mt-2 max-h-72 rounded-xl object-cover" />}
        </div>
      ))}
    </div>
  )
}

export function ProfileCard({ code }) {
  const session = useSession()
  const [h, setH] = useState(undefined)
  const load = () => supabase.rpc('get_public_holder', { p_code: code }).then(({ data }) => setH(data || null))
  useEffect(() => { load() }, [code, session?.user?.id]) // eslint-disable-line
  if (h === undefined) return <Spinner />
  if (!h) return <p className="muted">This profile isn't available.</p>
  return (
    <div className="card">
      <div className="flex items-center gap-4">
        {h.photo_url
          ? <img src={h.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange text-3xl font-extrabold text-ink">{h.first_name?.[0]}</div>}
        <div>
          <p className="text-2xl font-extrabold">{h.first_name}</p>
          <p className="muted text-sm">Holder #{h.code}{h.general_area ? ` · Usually around ${h.general_area}` : ''}</p>
          <p className="text-sm font-bold">{h.count_today} scan{h.count_today === 1 ? '' : 's'} today</p>
        </div>
      </div>
      {h.story && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed">{h.story}</p>}
      {h.sponsors?.length > 0 && <p className="mt-4 text-sm"><span className="font-bold">Supported by:</span> {h.sponsors.map((x) => x.name).join(', ')}</p>}
      <SupportButtons h={h} code={code} onChange={(r) => setH({ ...h, ...r })} onReload={load} />
      <Updates list={h.updates} name={h.first_name} />
    </div>
  )
}

function PersonRow({ x }) {
  return (
    <Link to={`/p/${x.code}`} className="card flex items-center gap-4 hover:border-orange">
      {x.photo_url
        ? <img src={x.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange text-2xl font-extrabold text-ink">{x.first_name?.[0]}</div>}
      <div><p className="text-lg font-extrabold">{x.first_name}</p><p className="muted text-sm">#{x.code}{x.general_area ? ` · ${x.general_area}` : ''}</p></div>
    </Link>
  )
}

// Supporter's "My account" page: updates from people they follow, who they follow, who they starred.
export function MyStars() {
  const session = useSession()
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!session) return
    Promise.all([supabase.rpc('my_feed'), supabase.rpc('my_following'), supabase.rpc('my_stars')])
      .then(([f, fo, st]) => setD({ feed: f.data || [], following: fo.data || [], stars: st.data || [] }))
  }, [session])
  if (session === undefined) return <Spinner />
  if (!session) return <div className="px-4 py-8"><AuthBox title="Log in" allowSignup={false} redirectPath="/me" /></div>
  if (!d) return <Spinner />
  return (
    <div className="mx-auto max-w-md space-y-8 px-4 py-8">
      <h1 className="h1">My account</h1>

      <section className="space-y-3">
        <h2 className="h2">Updates</h2>
        {d.feed.length === 0 ? <p className="muted">No updates yet. Follow a holder to see their updates here.</p> : d.feed.map((u) => (
          <Link key={u.id} to={`/p/${u.code}`} className="card block hover:border-orange">
            <p className="font-extrabold">{u.first_name} <span className="muted text-xs font-normal">· {u.kind === 'milestone' ? 'Milestone · ' : ''}{ago(u.created_at)}</span></p>
            <p className={`mt-1 whitespace-pre-line ${u.kind === 'milestone' ? 'font-extrabold text-orange' : ''}`}>{u.body}</p>
            {u.photo_url && <img src={u.photo_url} alt="" className="mt-2 max-h-60 rounded-xl object-cover" />}
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="h2">Following</h2>
        {d.following.length === 0 ? <p className="muted">You're not following anyone yet.</p> : d.following.map((x) => <PersonRow key={x.code} x={x} />)}
      </section>

      <section className="space-y-3">
        <h2 className="h2">My stars</h2>
        {d.stars.length === 0 ? <p className="muted">No stars yet. When you scan a holder's code, tap "Meet" and then "⭐ Star".</p> : d.stars.map((x) => <PersonRow key={x.code} x={x} />)}
      </section>
    </div>
  )
}

export default function Profile() {
  const { code } = useParams()
  const nav = useNavigate()
  const back = () => (window.history.state?.idx > 0 ? nav(-1) : nav('/'))
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button onClick={back} className="mb-4 font-bold underline">← Back</button>
      <ProfileCard code={code} />
      <Link to={`/s/${code}`} className="btn-orange mt-4 w-full">Scan to help</Link>
    </div>
  )
}
