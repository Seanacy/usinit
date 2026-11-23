import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SITE_URL, SUPABASE_URL, money, supabase, useSession, useStats } from '../lib/supabase'
import { getRef } from '../lib/ref'
import AuthBox from '../components/AuthBox'
import ShareQR from '../components/ShareQR'
import { Notice, Spinner } from '../components/Layout'
import { GoalTracker } from './Home'
import { boxStyle } from '../lib/boxStyles'

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
        <Link to="/launch" className="btn-outline">See the beta goal</Link>
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
      {links.map(([label, url], i) => { const st = boxStyle(i); return (
        <div key={url} className={`flex items-center justify-between gap-2 rounded-xl p-3 ${st.box}`}>
          <div className="min-w-0"><p className="text-sm font-bold">{label}</p><p className={`truncate text-xs ${st.sub}`}>{url.replace(/^https?:\/\//, '')}</p></div>
          <button className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${st.btn}`} onClick={() => { navigator.clipboard?.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500) }}>{copied === url ? 'Copied!' : 'Copy'}</button>
        </div>
      ) })}
    </div>
  )
}

// Two meters at the top of an Ambassador's own page:
// 1) shared: the $5,000 launch goal before launch (setting `launched` false), the Community Fund after.
// 2) personal: what came in through their links this month, plus a list of recent sign-ups/gifts (no names).
const RECENT = {
  supporter: (c) => `Someone gave ${money(c)} through your link`,
  gift: (c) => `Someone dropped ${money(c)} through your link`,
  business: (c) => (c > 0 ? `A business added ${money(c)} for ads through your link` : 'A business signed up through your link'),
  holder: () => 'A new holder signed up through your link',
  ambassador: () => 'A new Ambassador joined through your link',
}
const ago = (t) => {
  const d = Math.floor((Date.now() - new Date(t).getTime()) / 86400000)
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
}
function Meters() {
  const [m, setM] = useState(null)
  useEffect(() => { supabase.rpc('my_amb_meters').then(({ data }) => setM(data)) }, [])
  if (!m) return null
  const bar = (pct, color = 'bg-orange') => (
    <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className={`h-4 rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
  )
  const zone = m.fund_cents < m.low_cents ? ['Low', 'bg-red-500', 'Holders need a boost. Now is the best time to share your support link.']
    : m.fund_cents >= m.high_cents ? ['Strong', 'bg-green-500', 'The fund is strong. Great time to bring in businesses and holders.']
    : ['OK', 'bg-orange', 'Holders are getting paid. Keep sharing.']
  const mine = m.my_fund_cents + m.my_ad_cents
  const share = m.all_fund_month_cents > 0 ? Math.round((m.my_fund_cents / m.all_fund_month_cents) * 100) : 0
  return (
    <div className="space-y-4">
      {m.launched ? (
        <div className="card">
          <p className="font-bold">Community Fund right now</p>
          <p className="text-3xl font-extrabold">{money(m.fund_cents)} <span className="text-base">· {zone[0]}</span></p>
          {bar((m.fund_cents / m.high_cents) * 100, zone[1])}
          <div className="muted mt-1 flex justify-between text-xs"><span>Low under {money(m.low_cents)}</span><span>Strong at {money(m.high_cents)}</span></div>
          <p className="mt-2 text-sm">{zone[2]}</p>
        </div>
      ) : (
        <div className="card">
          <p className="font-bold">Launch goal</p>
          <p className="text-3xl font-extrabold">{money(m.launch_raised_cents)} <span className="text-base font-bold">of {money(m.launch_goal_cents)}</span></p>
          {bar((m.launch_raised_cents / Math.max(m.launch_goal_cents, 1)) * 100)}
          <p className="mt-2 text-sm">When we hit the goal, holders start getting paid. Every share gets us closer.</p>
        </div>
      )}
      <div className="card">
        <p className="font-bold">You this month</p>
        <p className="text-3xl font-extrabold">{money(mine)} <span className="text-base font-bold">brought in</span></p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>💛 {money(m.my_fund_cents)} from supporters → <b>Community Fund</b></li>
          <li>🏪 {money(m.my_ad_cents)} from businesses → <b>Ad Fund</b></li>
        </ul>
        {m.my_fund_cents > 0 && <p className="muted mt-2 text-sm">That's {share}% of all the money given to the Community Fund this month.</p>}
        <p className="mt-4 font-bold">What came in through your links</p>
        {m.recent.length === 0 ? <p className="muted mt-1 text-sm">Nothing yet. Share one of your links below to get your first one.</p> : (
          <ul className="mt-1 divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
            {m.recent.map((r, i) => <li key={i} className="flex justify-between gap-2 py-2"><span>{(RECENT[r.kind] || (() => 'Something came in through your link'))(r.cents)}</span><span className="muted shrink-0">{ago(r.at)}</span></li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

// Ready-to-send messages for Ambassadors, with their own links filled in.
function readyMessages(name, code) {
  const support = `${SITE_URL}/support?ref=${code}`
  const drop = `${SITE_URL}/2?ref=${code}`
  const biz = `${SITE_URL}/advertise?ref=${code}`
  return [
    { title: 'Social media post', where: 'Facebook, Instagram, Nextdoor', text:
`I'm helping launch something in Minneapolis called Us In It.

People going through hard times carry a QR code. When you scan it, a local business message shows up, and the person holding the code gets paid. Not a handout. A paycheck.

We're in beta. Before businesses come on board, we need neighbors to fund the first scans.

You can help two ways:
💛 Give once or weekly (as little as $5 a week)
💸 Do a $2 Drop. That's 4 paid scans for someone on our streets: ${drop}

Every dollar shows up on the public Fund page, so you can watch it grow.

For-Profit, For People.
👉 ${support}` },
    { title: 'Text or DM to people you know', where: 'Texts, Messenger, Instagram DMs', text:
`Hey [name], I'm helping launch something called Us In It.

People going through hard times carry a QR code. Every time someone scans it, they get paid. Local businesses will pay for the scans. We're in beta, so neighbors are funding the first scans so they pay right away.

Would you help? Even $2 pays for 4 scans. Weekly starts at $5.

${support}

And if you can't give, sharing it helps just as much. 🙏` },
    { title: 'The $50 business ask', where: 'Email, DM, or read it in person', text:
`Subject: 100 neighbors, $50, your business name in front of them

Hi [owner name],

I'm ${name}, an Ambassador for Us In It here in Minneapolis.

People going through hard times carry a QR code. When someone scans it, your message shows up on their phone, and the person holding the code gets paid for that scan.

$50 = 100 scans. That means 100 local people see your business, and $40 of it goes straight to people working our streets.

You pick your area, so your message only shows near you. You can see your scans live on your own page.

Would you be one of the first 100 businesses? It takes about 5 minutes to sign up:
${biz}

${name}
Ambassador, Us In It · For-Profit, For People` },
  ]
}

function ReadyMessages({ name, code }) {
  const [copied, setCopied] = useState(null)
  const [open, setOpen] = useState(null)
  const msgs = readyMessages(name, code)
  return (
    <div className="card space-y-3">
      <p className="font-bold">Ready-to-send messages</p>
      <p className="rounded-lg bg-orange/15 p-3 text-sm"><b>From Jermaine:</b> I wrote these for you to send out on my behalf. When you send one, you're speaking for Us In It, so please keep it kind and honest and don't promise anything that isn't in the message.</p>
      <p className="muted text-sm">Your links are already in them. Copy, paste, and send. Fill in anything in [brackets].</p>
      {msgs.map((m, i) => { const st = boxStyle(i); return (
        <div key={m.title} className={`space-y-2 rounded-xl p-3 ${st.box}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="font-bold">{m.title}</p><p className={`text-xs ${st.sub}`}>{m.where}</p></div>
            <button className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${st.btn}`} onClick={() => { navigator.clipboard?.writeText(m.text); setCopied(i); setTimeout(() => setCopied(null), 1500) }}>{copied === i ? 'Copied!' : 'Copy'}</button>
          </div>
          <button className="text-sm font-bold underline" onClick={() => setOpen(open === i ? null : i)}>{open === i ? 'Hide message' : 'Read message'}</button>
          {open === i && <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-ink">{m.text}</p>}
        </div>
      ) })}
    </div>
  )
}

// Pictures for social media: the Us In It square picture and banner (same ones on the Cash App / Venmo profiles).
const PICS = [
  { file: '/kit/usinit-square.png', name: 'usinit-square.png', label: 'Square picture: posts, profile pictures' },
  { file: '/kit/usinit-banner.png', name: 'usinit-banner.png', label: 'Banner: Facebook, X, or LinkedIn cover photo' },
]
function SocialPictures() {
  async function save(p) {
    try {
      const blob = await (await fetch(p.file)).blob()
      const file = new File([blob], p.name, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return }
    } catch { /* fall back to download */ }
    const a = document.createElement('a'); a.href = p.file; a.download = p.name; a.click()
  }
  return (
    <div className="card space-y-3">
      <p className="font-bold">Pictures for social media</p>
      <p className="muted text-sm">Use these with your posts. On a phone, tap Save picture, then tap Save Image.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {PICS.map((p, i) => { const st = boxStyle(i); return (
          <div key={p.file} className={`flex flex-col gap-2 rounded-xl p-3 ${st.box}`}>
            <img src={p.file} alt={p.label} className="w-full rounded-lg" />
            <p className={`text-xs ${st.sub}`}>{p.label}</p>
            <button className={`mt-auto w-full rounded-xl px-4 py-3 text-sm font-bold ${st.btn}`} onClick={() => save(p)}>Save picture</button>
          </div>
        ) })}
      </div>
    </div>
  )
}

// Team Lead view: everyone on the Team Lead's team, side by side, this month. Only Team Leads see it.
function MyTeam() {
  const [t, setT] = useState(undefined)
  const [prog, setProg] = useState(null)
  useEffect(() => {
    supabase.rpc('my_team').then(({ data }) => setT(data || null))
    supabase.rpc('amb_progress_all').then(({ data }) => setProg(data))
  }, [])
  if (!t) return null
  const total = t.members.reduce((s, m) => s + m.month_cents, 0)
  const quietDays = (m) => Math.floor((Date.now() - new Date(m.last_active).getTime()) / 86400000)
  return (
    <div className="card space-y-3 border-2 border-orange">
      <p className="h2">⭐ My team: {TEAMS[t.team] || t.team}</p>
      <p className="text-sm">{t.members.length} Ambassador{t.members.length === 1 ? '' : 's'} · <b>{money(total)}</b> brought in this month together</p>
      <p className="muted text-xs">Most brought in this month is first. Reach out to anyone who's been quiet for 2 weeks or more.</p>
      {t.members.map((m, i) => { const st = boxStyle(i); const q = quietDays(m); return (
        <div key={m.slug} className={`space-y-2 rounded-xl p-3 ${st.box}`}>
          <div className="flex items-center gap-3">
            <Avatar a={m} size="h-12 w-12" text="text-xl" />
            <div className="min-w-0 flex-1">
              <Link to={`/ambassadors/${m.slug}`} className="font-extrabold underline">{m.name}{m.me ? ' (you)' : ''}</Link>
              <p className={`text-xs ${st.sub}`}>{m.weeks_active} weeks active · {q <= 0 ? 'active today' : `last active ${q} day${q === 1 ? '' : 's'} ago`}{q >= 14 ? ' · 👋 check in' : ''}</p>
            </div>
            <p className="text-right text-lg font-extrabold">{money(m.month_cents)}</p>
          </div>
          <p className={`text-xs ${st.sub}`}>💛 {money(m.month_fund_cents)} Community Fund · 🏪 {money(m.month_ad_cents)} Ad Fund · 🙋 {m.month_people} sign-ups and gifts</p>
          {prog?.[m.slug] && <GoalBar p={prog[m.slug]} />}
        </div>
      ) })}
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
      {(me.status === 'active' || me.status === 'hidden') && <><Meters />{me.status === 'active' && <MyTeam />}<MyLinks code={me.ref_code} /><ReadyMessages name={me.name} code={me.ref_code} /></>}
      {me.status !== 'denied' && <ProfileBody a={me} mine />}
      {(me.status === 'active' || me.status === 'hidden') && <SocialPictures />}
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
      <h1 className="h1">Beta goal</h1>
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
