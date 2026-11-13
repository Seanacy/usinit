import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, useSession } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import AuthBox from '../components/AuthBox'

function StarButton({ h, code, onChange }) {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [askAccount, setAskAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const pending = useRef(params.get('star') === '1')

  async function toggle() {
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('toggle_star', { p_code: code })
    setBusy(false)
    if (error) return setErr(error.message)
    onChange(data)
  }
  // After someone makes an account or logs in to star, finish the star for them.
  useEffect(() => {
    if (!session || h.is_me) return
    if (pending.current) {
      pending.current = false; setAskAccount(false)
      if (params.get('star')) { params.delete('star'); setParams(params, { replace: true }) }
      if (!h.starred_by_me) toggle()
    }
  }, [session]) // eslint-disable-line

  if (h.is_me) return <p className="mt-4 font-bold">⭐ {h.stars} {h.stars === 1 ? 'person is' : 'people are'} rooting for you</p>
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={() => (session ? toggle() : (pending.current = true, setAskAccount(true)))}
          className={h.starred_by_me ? 'btn-black' : 'btn-orange'}>{h.starred_by_me ? `⭐ Starred` : `⭐ Star ${h.first_name}`}</button>
        <span className="font-bold">{h.stars} {h.stars === 1 ? 'person is' : 'people are'} rooting for {h.first_name}</span>
      </div>
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      {askAccount && !session && (
        <div className="mt-4">
          <AuthBox title={`Create a free account to star ${h.first_name}`} intro="Scanning and giving never need an account. An account just lets you star holders and keep your list." redirectPath={`/p/${code}?star=1`} role="supporter" />
          <button className="mt-2 w-full py-2 font-bold text-neutral-500" onClick={() => { pending.current = false; setAskAccount(false) }}>Not now</button>
        </div>
      )}
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
      <StarButton h={h} code={code} onChange={(r) => setH({ ...h, starred_by_me: r.starred, stars: r.stars })} />
    </div>
  )
}

export function MyStars() {
  const session = useSession()
  const [list, setList] = useState(null)
  useEffect(() => { if (session) supabase.rpc('my_stars').then(({ data }) => setList(data || [])) }, [session])
  if (session === undefined) return <Spinner />
  if (!session) return <div className="px-4 py-8"><AuthBox title="Log in" allowSignup={false} redirectPath="/me" /></div>
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="h1">My stars</h1>
      <p className="muted mt-2">The holders you're rooting for. Tap one to see their story or help again.</p>
      <div className="mt-5 space-y-3">
        {list === null ? <Spinner /> : list.length === 0 ? (
          <p className="muted">No stars yet. When you scan a holder's code, tap "Meet" and then "⭐ Star" to add them here.</p>
        ) : list.map((x) => (
          <Link key={x.code} to={`/p/${x.code}`} className="card flex items-center gap-4 hover:border-orange">
            {x.photo_url
              ? <img src={x.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange text-2xl font-extrabold text-ink">{x.first_name?.[0]}</div>}
            <div><p className="text-lg font-extrabold">{x.first_name}</p><p className="muted text-sm">#{x.code}{x.general_area ? ` · ${x.general_area}` : ''}</p></div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Profile() {
  const { code } = useParams()
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ProfileCard code={code} />
      <Link to={`/s/${code}`} className="btn-orange mt-4 w-full">Scan to help</Link>
    </div>
  )
}
