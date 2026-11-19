import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SITE_URL, SUPABASE_URL, money, supabase, useSession, useStats } from '../lib/supabase'
import { getRef } from '../lib/ref'
import AuthBox from '../components/AuthBox'
import ShareQR from '../components/ShareQR'
import { Notice, Spinner } from '../components/Layout'
import { GoalTracker } from './Home'

export const TEAMS = { street: 'Street Team', business: 'Business Team', event: 'Event Team', social: 'Social Team', workplace: 'Workplace Team', skyway: 'Skyway & Downtown', shop: 'Shop Team', media: 'Media Team', community: 'Community Team' }
const DISCLAIMER = "Ambassadors are volunteers who help spread the word about Us In It. They aren't owners, employees, or paid."
export const photoUrl = (p) => (p ? `${SUPABASE_URL}/storage/v1/object/public/ambassadors/${p}` : null)

export function Avatar({ a, size = 'h-20 w-20', text = 'text-3xl' }) {
  const url = photoUrl(a.photo_path)
  return url
    ? <img src={url} alt={a.name} className={`${size} shrink-0 rounded-full object-cover`} />
    : <div className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-orange font-extrabold text-black`} aria-hidden="true">{(a.name || '?').slice(0, 1).toUpperCase()}</div>
}

function Badges({ list }) {
  if (!list?.length) return null
  return <div className="flex flex-wrap gap-2">{list.map((b) => <span key={b} className="rounded-full border-2 border-orange px-3 py-1 text-xs font-bold">{b === 'Nonprofit Ambassador' ? '💚 ' : b === 'Team Lead' ? '⭐ ' : '🏅 '}{b}</span>)}</div>
}

function StatRow({ st }) {
  const items = [[money(st.raised_cents || 0), 'raised'], [st.supporters || 0, 'supporters'], [st.weeks_active || 0, 'weeks active'], [st.ambassadors || 0, 'Ambassadors brought in']]
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {items.map(([v, l]) => <div key={l}><p className="text-xl font-extrabold">{v}</p><p className="muted text-xs leading-tight">{l}</p></div>)}
    </div>
  )
}

// Last 12 weeks, lit up when they brought someone in.
function Streak({ weeks }) {
  const lit = new Set(weeks || [])
  const days = useMemo(() => {
    const out = []
    const now = new Date(); const day = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
    for (let i = 11; i >= 0; i--) { const d = new Date(monday); d.setDate(d.getDate() - i * 7); out.push(d.toISOString().slice(0, 10)) }
    return out
  }, [])
  return (
    <div>
      <p className="muted text-xs">Last 12 weeks</p>
      <div className="mt-1 flex gap-1">{days.map((d) => <span key={d} title={d} className={`h-4 flex-1 rounded ${lit.has(d) ? 'bg-orange' : 'bg-neutral-200 dark:bg-neutral-700'}`} />)}</div>
    </div>
  )
}

// ================= /ambassadors =================
function GoalBar({ p }) {
  return (
    <div className="w-full space-y-1">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly goal">
        <div className="h-2.5 bg-orange" style={{ width: `${p.pct}%` }} />
      </div>
      <p className="text-xs font-bold">{p.pct}% · {p.new_amb ? '👥✅' : '👥'} {p.brought ? '💚✅' : '💚'} 🔗{p.weeks_hit}/{p.weeks}</p>
    </div>
  )
}

export function AmbassadorsDirectory() {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [prog, setProg] = useState(null)
  const session = useSession()
  useEffect(() => { supabase.rpc('ambassadors_list').then(({ data }) => setList(data || [])) }, [])
  // Monthly goal bars: only signed-in Ambassadors get this data back
  useEffect(() => { if (session) supabase.rpc('amb_progress_all').then(({ data }) => setProg(data || null)); else setProg(null) }, [session])
  if (!list) return <Spinner />
  const shown = list.filter((a) => !q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="h1">Ambassadors</h1>
      <p className="muted mt-2">The people helping Us In It grow: finding supporters, businesses, and holders, and spreading the word.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/ambassador" className="btn-orange">Become an Ambassador</Link>
        <Link to="/launch" className="btn-outline">See the launch goal</Link>
      </div>
      {prog && <p className="mt-4 rounded-xl bg-orange/15 p-3 text-sm"><b>Monthly goal bars (only Ambassadors see these):</b> 👥 bring 1 new Ambassador · 💚 bring in 1 supporter, business, gift, or holder · 🔗 your link gets used every week.</p>}
      <input className="input mt-6" placeholder="Search Ambassadors by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Ambassadors" />
      {shown.length === 0 ? <p className="muted mt-6">{list.length === 0 ? 'Be the first Ambassador!' : 'Nobody by that name.'}</p> : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((a) => (
            <Link key={a.slug} to={`/ambassadors/${a.slug}`} className="card flex flex-col items-center gap-2 text-center hover:border-orange">
              <Avatar a={a} />
              <p className="font-extrabold">{a.name}</p>
              {(a.is_team_lead || a.nonprofit_org) && <p className="text-xs font-bold">{a.is_team_lead ? '⭐ Team Lead' : '💚 Nonprofit'}</p>}
              <p className="muted text-xs">{a.stats.weeks_active || 0} weeks active</p>
              {prog?.[a.slug] && <GoalBar p={prog[a.slug]} />}
            </Link>
          ))}
        </div>
      )}
      <p className="muted mt-8 text-xs">{DISCLAIMER}</p>
    </div>
  )
}

// ================= /ambassadors/:slug =================
function ProfileBody({ a, mine }) {
  const link = `${SITE_URL}/support?ref=${a.ref_code}`
  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4">
        <Avatar a={a} size="h-24 w-24" text="text-4xl" />
        <div className="min-w-0">
          <h1 className="h2 break-words">{a.name}</h1>
          {a.nonprofit_org && <p className="text-sm font-bold">💚 Nonprofit Ambassador · {a.nonprofit_org}</p>}
          {a.team && <p className="text-sm font-bold">{a.is_team_lead ? '⭐ Leads the ' : ''}{TEAMS[a.team]}</p>}
          {a.bio && <p className="mt-1">{a.bio}</p>}
          {a.recruiter && <p className="muted mt-1 text-sm">Brought in by <Link className="font-bold underline" to={`/ambassadors/${a.recruiter.slug}`}>{a.recruiter.name}</Link></p>}
        </div>
      </div>
      <div className="card space-y-4">
        <StatRow st={a.stats} />
        <Streak weeks={a.stats.weeks} />
        <Badges list={a.badges} />
      </div>
      {a.shoutouts?.length > 0 && (
        <div className="card space-y-2">
          <p className="font-bold">Shout-outs from Us In It</p>
          {a.shoutouts.map((s, i) => <p key={i} className="rounded-xl bg-orange/15 p-3">"{s.message}" <span className="muted text-xs">· {new Date(s.created_at).toLocaleDateString()}</span></p>)}
        </div>
      )}
      {a.ref_code && a.status !== 'pending' && <ShareQR inline url={link} heading={mine ? 'Your support link' : `Support Us In It with ${a.name}`} label="Full screen" />}
      <p className="muted text-xs">{DISCLAIMER}</p>
    </div>
  )
}

export function AmbassadorProfile() {
  const { slug } = useParams()
  const [a, setA] = useState(undefined)
  useEffect(() => { supabase.rpc('ambassador_page', { p_slug: slug }).then(({ data }) => setA(data || null)) }, [slug])
  if (a === undefined) return <Spinner />
  if (!a) return <div className="mx-auto max-w-xl px-4 py-12 text-center"><p className="h2">Ambassador not found</p><Link to="/ambassadors" className="btn-outline mt-4">See all Ambassadors</Link></div>
  return <div className="mx-auto max-w-xl px-4 py-8"><ProfileBody a={a} /><Link to="/ambassadors" className="mt-4 inline-block font-bold underline">← All Ambassadors</Link></div>
}

// ================= /ambassador (my page) =================
function Editor({ me, onDone }) {
  const session = useSession()
  const [name, setName] = useState(me?.name || '')
  const [bio, setBio] = useState(me?.bio || '')
  const [photo, setPhoto] = useState(me?.photo_path || '')
  const [showRec, setShowRec] = useState(me ? me.show_recruiter !== false : true)
  const [emails, setEmails] = useState(me ? me.email_updates !== false : true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function upload(file) {
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return setErr('That picture is too big. Pick one under 3 MB.')
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${session.user.id}/${Date.now()}.${ext}`
    setBusy(true)
    const { error } = await supabase.storage.from('ambassadors').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return setErr(error.message)
    setPhoto(path)
  }
  async function save(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = me
      ? await supabase.rpc('ambassador_update', { p_name: name, p_bio: bio, p_photo: photo, p_show_recruiter: showRec, p_email_updates: emails })
      : await supabase.rpc('ambassador_join', { p_name: name, p_bio: bio, p_ref: getRef() })
    if (!error && !me && photo) await supabase.rpc('ambassador_update', { p_name: name, p_bio: bio, p_photo: photo, p_show_recruiter: true, p_email_updates: true })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="h2">{me ? 'Edit my Ambassador page' : 'Become an Ambassador'}</h2>
      {!me && <p className="muted text-sm">Help us find supporters, businesses, and holders. Your page tracks everything you bring in. It's free and you can quit anytime.</p>}
      <label className="block"><span className="font-bold">Your name on the site</span>
        <input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Any name you like" required />
        <span className="muted text-xs">Use a nickname or your real name. You can change it anytime and keep all your credit.</span>
      </label>
      <label className="block"><span className="font-bold">Why I'm in (optional)</span>
        <input className="input mt-1" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about why you're helping" />
      </label>
      <div>
        <span className="font-bold">Picture (optional)</span>
        <div className="mt-2 flex items-center gap-3">
          <Avatar a={{ name: name || '?', photo_path: photo }} size="h-16 w-16" text="text-2xl" />
          <label className="btn-outline cursor-pointer py-2">{photo ? 'Change picture' : 'Add picture'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
          {photo && <button type="button" className="text-sm font-bold underline" onClick={() => setPhoto('')}>Remove</button>}
        </div>
      </div>
      {me && (
        <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showRec} onChange={(e) => setShowRec(e.target.checked)} /> Show who brought me in</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={emails} onChange={(e) => setEmails(e.target.checked)} /> Email me updates and thank-yous</label>
        </>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full" disabled={busy}>{busy ? 'Saving…' : me ? 'Save' : 'Join as an Ambassador'}</button>
      {me && <button type="button" className="btn-outline w-full" onClick={onDone}>Cancel</button>}
      <p className="muted text-xs">{DISCLAIMER}</p>
    </form>
  )
}

function MyLinks({ code }) {
  const links = [
    ['Support link (give monthly or once)', `${SITE_URL}/support?ref=${code}`],
    ['$2 Drop link', `${SITE_URL}/2?ref=${code}`],
    ['Business link (send to businesses)', `${SITE_URL}/advertise?ref=${code}`],
    ['Holder sign-up link', `${SITE_URL}/holder?ref=${code}`],
    ['Bring in a new Ambassador', `${SITE_URL}/ambassador?ref=${code}`],
  ]
  const [copied, setCopied] = useState(null)
  return (
    <div className="card space-y-3">
      <p className="font-bold">Your links</p>
      <p className="muted text-sm">Everything that comes in through these links is credited to you.</p>
      {links.map(([label, url]) => (
        <div key={url} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-300 p-2 dark:border-neutral-700">
          <div className="min-w-0"><p className="text-sm font-bold">{label}</p><p className="muted truncate text-xs">{url.replace(/^https?:\/\//, '')}</p></div>
          <button className="btn-outline shrink-0 px-3 py-1 text-sm" onClick={() => { navigator.clipboard?.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500) }}>{copied === url ? 'Copied!' : 'Copy'}</button>
        </div>
      ))}
    </div>
  )
}

export function MyAmbassador() {
  const session = useSession()
  const [me, setMe] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const load = () => supabase.rpc('my_ambassador').then(({ data }) => setMe(data || null))
  useEffect(() => { if (session) load() }, [session?.user?.id]) // eslint-disable-line
  if (session === undefined) return <Spinner />
  if (!session) return (
    <div className="mx-auto max-w-xl px-4 py-8 space-y-4">
      <div className="card"><h1 className="h2">Become an Ambassador</h1><p className="mt-2">Help Us In It grow. Find supporters, businesses, and holders, and get credit for everything you bring in. Free, unpaid, and you can quit anytime.</p></div>
      <AuthBox title="Sign up or log in" redirectPath="/ambassador" role="ambassador" />
    </div>
  )
  if (me === undefined) return <Spinner />
  if (!me || editing) return <div className="mx-auto max-w-xl px-4 py-8"><Editor me={me} onDone={() => { setEditing(false); load() }} /></div>
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <p className="muted text-sm">{me.status === 'pending' ? 'Your page goes live after approval:' : 'Your public page:'} <Link className="font-bold underline" to={`/ambassadors/${me.slug}`}>usinit.com/ambassadors/{me.slug}</Link></p>
        <button className="btn-outline px-3 py-1 text-sm" onClick={() => setEditing(true)}>Edit</button>
      </div>
      {me.status === 'hidden' && <Notice>Your page is hidden right now. Message Us In It if you have questions.</Notice>}
      {me.status === 'pending' && (
        <div className="card space-y-2 border-orange">
          <p className="h2">⏳ Waiting for approval</p>
          <p>Thanks for signing up, {me.name}! Us In It checks every new Ambassador first.</p>
          <p>We'll email you when you're approved. Then your links and your public page turn on.</p>
        </div>
      )}
      {me.status === 'denied' && <Notice>Your Ambassador sign-up wasn't approved. Message Us In It if you have questions.</Notice>}
      {(me.status === 'active' || me.status === 'hidden') && <MyLinks code={me.ref_code} />}
      {me.status !== 'denied' && <ProfileBody a={me} mine />}
    </div>
  )
}

// ================= /launch =================
export function Launch() {
  const stats = useStats()
  const [b, setB] = useState(null)
  useEffect(() => { supabase.rpc('launch_board').then(({ data }) => setB(data)) }, [])
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="h1">Launch goal</h1>
      <GoalTracker stats={stats} />
      <div className="flex flex-wrap gap-3">
        <Link to="/support" className="btn-orange">Support the launch</Link>
        <Link to="/ambassador" className="btn-outline">Become an Ambassador</Link>
      </div>
      <div className="card">
        <p className="font-bold">Top Ambassadors</p>
        {!b ? <Spinner /> : b.top.length === 0 ? <p className="muted mt-2 text-sm">No Ambassador support yet. Yours could be first.</p> : (
          <ol className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-700">
            {b.top.slice(0, 10).map((a, i) => (
              <li key={a.slug} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right font-extrabold">{i + 1}</span>
                <Avatar a={a} size="h-10 w-10" text="text-lg" />
                <Link to={`/ambassadors/${a.slug}`} className="flex-1 font-bold underline">{a.name}</Link>
                <span className="text-right text-sm"><b>{money(a.stats.raised_cents)}</b><br /><span className="muted">{a.stats.supporters} supporters</span></span>
              </li>
            ))}
          </ol>
        )}
        {b && <p className="muted mt-3 text-sm">You're part of a team of {b.count} Ambassador{b.count === 1 ? '' : 's'}.</p>}
      </div>
      <p className="muted text-xs">{DISCLAIMER}</p>
    </div>
  )
}
