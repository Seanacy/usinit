import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SITE_URL, money, supabase } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const toInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const randCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

// Shown on the scan screen when a student campaign pays for the scan
export function CampaignCard({ c }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-ink dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
      <div className="bg-ink px-4 py-1 text-xs font-bold tracking-wide text-orange">{String(c.school || '').toUpperCase()} · {String(c.title || '').toUpperCase()}</div>
      {c.photo_url && <img src={c.photo_url} alt="" className="max-h-72 w-full object-cover" />}
      <div className="p-5">
        <p className="text-3xl font-extrabold leading-snug">Vote {c.name}</p>
        {c.slogan && <p className="mt-2 text-lg">{c.slogan}</p>}
        <p className="muted mt-4 text-xs">A student campaign at {c.school}. Every scan helps someone on our streets.</p>
      </div>
    </div>
  )
}

// ================= Public school page: /school/:slug =================
function CampaignForm({ election }) {
  const [f, setF] = useState({ name: '', slogan: '', photo: '', photo_ok: false, parent_name: '', parent_email: '', parent_ok: false })
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function send(e) {
    e.preventDefault(); setErr(null)
    const { error } = await supabase.rpc('submit_school_campaign', { p_election: election.id, p_name: f.name, p_slogan: f.slogan, p_photo: f.photo, p_photo_ok: f.photo_ok,
      p_parent_name: f.parent_name, p_parent_email: f.parent_email, p_parent_ok: f.parent_ok })
    if (error) return setErr(error.message)
    setDone(true)
  }
  if (done) return <Notice kind="ok">Sent! The school's adviser and Us In It check every campaign. Online payment is coming soon; we'll email the parent to pay (up to {money(election.cap_cents)}).</Notice>
  return (
    <form onSubmit={send} className="space-y-3 rounded-xl border border-neutral-300 p-3 dark:border-neutral-600">
      <p className="font-bold">Start a campaign (parent or guardian fills this out)</p>
      <input className="input" maxLength={32} placeholder="Student's first name and last initial, like Jordan M." value={f.name} onChange={set('name')} />
      <input className="input" maxLength={80} placeholder="Slogan, like Jordan for King!" value={f.slogan} onChange={set('slogan')} />
      <input className="input" placeholder="Photo link (optional)" value={f.photo} onChange={set('photo')} />
      {f.photo && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.photo_ok} onChange={set('photo_ok')} /><span>As the parent or guardian, I OK showing this photo. (Without this, no photo shows.)</span></label>}
      <input className="input" placeholder="Parent or guardian name" value={f.parent_name} onChange={set('parent_name')} />
      <input className="input" type="email" placeholder="Parent or guardian email" value={f.parent_email} onChange={set('parent_email')} />
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.parent_ok} onChange={set('parent_ok')} />
        <span>I'm the student's parent or guardian. I approve this campaign and I'll pay for it. Every candidate in this election has the same spending cap: {money(election.cap_cents)}.</span></label>
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full">Send for approval</button>
    </form>
  )
}

export function SchoolPage() {
  const { slug } = useParams()
  const [s, setS] = useState(undefined)
  const [open, setOpen] = useState(null)
  useEffect(() => { supabase.rpc('get_school', { p_slug: slug }).then(({ data }) => setS(data || null)) }, [slug])
  if (s === undefined) return <Spinner />
  if (!s) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">This school page isn't open.</h1></div>
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div><p className="muted text-sm font-bold uppercase tracking-wide">School campaigns</p><h1 className="h1">{s.name}</h1>
        <p className="muted mt-2">Student campaign messages show only when someone scans an Us In It code at this school. Every scan pays a person on our streets.</p></div>
      {s.elections.length === 0 && <p className="muted">No open elections right now.</p>}
      {s.elections.map((e) => (
        <div key={e.id} className="card space-y-3">
          <h2 className="h2">{e.title}</h2>
          <p className="muted text-sm">Open until {day(e.ends_at)} · spending cap {money(e.cap_cents)} per candidate</p>
          {e.candidates.length === 0 ? <p className="muted">No approved candidates yet.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">{e.candidates.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                {c.photo_url ? <img src={c.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange text-xl font-extrabold text-ink">{c.name[0]}</div>}
                <div><p className="font-extrabold">{c.name}</p>{c.slogan && <p className="muted text-sm">{c.slogan}</p>}</div>
              </div>))}</div>
          )}
          {open === e.id ? <CampaignForm election={e} /> : <button className="btn-black w-full" onClick={() => setOpen(e.id)}>Start a campaign</button>}
        </div>
      ))}
      {s.kindness.map((k) => <Link key={k.slug} to={`/kindness/${k.slug}`} className="card block hover:border-orange"><p className="font-extrabold">💛 {k.name}</p><p className="muted text-sm">See the Kindness Campaign leaderboard</p></Link>)}
    </div>
  )
}

// ================= Kindness Campaign leaderboard: /kindness/:slug =================
export function KindnessPage() {
  const { slug } = useParams()
  const [k, setK] = useState(undefined)
  useEffect(() => { supabase.rpc('get_kindness', { p_slug: slug }).then(({ data }) => setK(data || null)) }, [slug])
  if (k === undefined) return <Spinner />
  if (!k) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">This Kindness Campaign isn't open.</h1></div>
  const total = k.teams.reduce((a, t) => a + t.scans, 0)
  const top = Math.max(1, ...k.teams.map((t) => t.scans))
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <div><p className="muted text-sm font-bold uppercase tracking-wide">Kindness Campaign{k.school ? ` · ${k.school}` : ''}</p><h1 className="h1">{k.name}</h1>
        <p className="muted mt-2">Teams compete to bring the most scans for people on our streets. {day(k.starts_at)} – {day(k.ends_at)}.</p></div>
      <div className="rounded-2xl bg-ink p-5 text-white"><p className="text-4xl font-extrabold">{total.toLocaleString()}</p><p className="text-neutral-300">scans so far for people on our streets 💛</p></div>
      <div className="space-y-3">
        {k.teams.map((t, i) => (
          <div key={t.name}>
            <div className="flex justify-between font-bold"><span>{i + 1}. {t.name}</span><span>{t.scans.toLocaleString()}</span></div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 rounded-full bg-orange" style={{ width: `${(t.scans / top) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="card space-y-2">
        <p className="font-extrabold">Join your team</p>
        <p className="text-sm">1. Get your team code from your team leader. 2. <Link to="/champion" className="font-bold underline">Become a Champion</Link> and pick a holder. 3. Type your team code on your Champion page. Every scan of your Champion code counts for your team.</p>
      </div>
    </div>
  )
}

// ================= Admin: Schools tab =================
export function AdminSchools() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const [sf, setSf] = useState({ name: '', zone_id: '', adviser_name: '', adviser_title: '', adviser_email: '', adviser_approved: false })
  const [ef, setEf] = useState({ school_id: '', title: '', cap: '25', start: toInput(new Date()), end: toInput(new Date(Date.now() + 14 * 864e5)) })
  const [kf, setKf] = useState({ name: '', school_id: '', start: toInput(new Date()), end: toInput(new Date(Date.now() + 30 * 864e5)) })
  const [team, setTeam] = useState({})
  const load = async () => {
    const [s, z, e, c, k, t] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('advertising_zones').select('id,name').is('advertiser_id', null).order('name'),
      supabase.from('school_elections').select('*').order('created_at', { ascending: false }),
      supabase.from('school_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('kindness_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('kindness_teams').select('*').order('created_at'),
    ])
    setD({ schools: s.data || [], zones: z.data || [], elections: e.data || [], campaigns: c.data || [], kind: k.data || [], teams: t.data || [] })
  }
  useEffect(() => { load() }, [])
  const done = (error, msg) => { setOk(null); setErr(error ? error.message : null); if (!error) { setOk(msg); load() } }
  if (!d) return <Spinner />
  const sName = (id) => d.schools.find((s) => s.id === id)?.name || '?'
  const eTitle = (id) => d.elections.find((e) => e.id === id)?.title || '?'

  async function addSchool(e) {
    e.preventDefault()
    if (!sf.name.trim()) return setErr('Add the school name.')
    const { error } = await supabase.from('schools').insert({ ...sf, name: sf.name.trim(), slug: slugify(sf.name), zone_id: sf.zone_id || null })
    done(error, 'School added.'); if (!error) setSf({ name: '', zone_id: '', adviser_name: '', adviser_title: '', adviser_email: '', adviser_approved: false })
  }
  async function addElection(e) {
    e.preventDefault()
    if (!ef.school_id || !ef.title.trim()) return setErr('Pick a school and add a title.')
    const { error } = await supabase.from('school_elections').insert({ school_id: ef.school_id, title: ef.title.trim(), cap_cents: Math.round(Number(ef.cap || 0) * 100),
      starts_at: new Date(ef.start + 'T00:00').toISOString(), ends_at: new Date(ef.end + 'T23:59').toISOString() })
    done(error, 'Election added.')
  }
  async function addKind(e) {
    e.preventDefault()
    if (!kf.name.trim()) return setErr('Name the Kindness Campaign.')
    const { error } = await supabase.from('kindness_campaigns').insert({ name: kf.name.trim(), slug: slugify(kf.name), school_id: kf.school_id || null,
      starts_at: new Date(kf.start + 'T00:00').toISOString(), ends_at: new Date(kf.end + 'T23:59').toISOString() })
    done(error, 'Kindness Campaign added.')
  }
  async function addTeam(k) {
    const name = (team[k.id] || '').trim(); if (!name) return
    const { error } = await supabase.from('kindness_teams').insert({ campaign_id: k.id, name, join_code: randCode() })
    done(error, 'Team added.'); if (!error) setTeam({ ...team, [k.id]: '' })
  }
  const setCampaign = async (c, status) => done((await supabase.from('school_campaigns').update({ status }).eq('id', c.id)).error, 'Saved.')
  async function pay(c) {
    const v = prompt('How many dollars did the parent pay? (Online payment comes with Stripe.)'); if (!v) return
    const { error } = await supabase.rpc('admin_campaign_payment', { p_id: c.id, p_cents: Math.round(Number(v) * 100) }); done(error, 'Payment recorded.')
  }
  const toggleSchool = async (s) => done((await supabase.from('schools').update({ adviser_approved: !s.adviser_approved }).eq('id', s.id)).error, 'Saved.')

  return (
    <div className="space-y-8">
      <p className="muted">School Campaigns: students running for prom king or queen, student body, and more. Their message shows only on scans inside the school's zone during the election, and every scan pays a holder. Rules: the school adviser approves first, every candidate has the same spending cap, a parent pays and approves, first name and last initial only, and a photo only with the parent's OK.</p>
      {err && <Notice kind="error">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <section className="space-y-3">
        <h2 className="h2">Schools</h2>
        <form onSubmit={addSchool} className="card space-y-2">
          <input className="input" placeholder="School name" value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} />
          <select className="input" value={sf.zone_id} onChange={(e) => setSf({ ...sf, zone_id: e.target.value })}>
            <option value="">Pick the school's zone (make it first in Admin → Zones)</option>
            {d.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" placeholder="Adviser name" value={sf.adviser_name} onChange={(e) => setSf({ ...sf, adviser_name: e.target.value })} />
            <input className="input" placeholder="Title, like Student council adviser" value={sf.adviser_title} onChange={(e) => setSf({ ...sf, adviser_title: e.target.value })} />
            <input className="input" placeholder="Adviser email" value={sf.adviser_email} onChange={(e) => setSf({ ...sf, adviser_email: e.target.value })} />
          </div>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={sf.adviser_approved} onChange={(e) => setSf({ ...sf, adviser_approved: e.target.checked })} /><span>The school adviser approved (the school page stays hidden until this is checked)</span></label>
          <button className="btn-black w-full">Add school</button>
        </form>
        {d.schools.map((s) => (
          <div key={s.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span><b>{s.name}</b> · {s.adviser_approved ? 'approved' : 'waiting for adviser'} · {s.zone_id ? 'zone set' : 'NO ZONE'} · <a className="underline" href={`${SITE_URL}/school/${s.slug}`} target="_blank" rel="noreferrer">school page</a></span>
            <button className="btn-outline py-2" onClick={() => toggleSchool(s)}>{s.adviser_approved ? 'Hide school' : 'Adviser approved'}</button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="h2">Elections</h2>
        <form onSubmit={addElection} className="card space-y-2">
          <select className="input" value={ef.school_id} onChange={(e) => setEf({ ...ef, school_id: e.target.value })}><option value="">Pick a school…</option>{d.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="input" placeholder="Title, like Prom King & Queen 2027" value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm font-bold">Cap per candidate ($)<input className="input" inputMode="decimal" value={ef.cap} onChange={(e) => setEf({ ...ef, cap: e.target.value.replace(/[^0-9.]/g, '') })} /></label>
            <label className="text-sm font-bold">Starts<input type="date" className="input" value={ef.start} onChange={(e) => setEf({ ...ef, start: e.target.value })} /></label>
            <label className="text-sm font-bold">Ends<input type="date" className="input" value={ef.end} onChange={(e) => setEf({ ...ef, end: e.target.value })} /></label>
          </div>
          <button className="btn-black w-full">Add election</button>
        </form>
        {d.elections.map((e) => (
          <div key={e.id} className="card space-y-2">
            <p className="font-bold">{e.title} <span className="muted text-sm font-normal">· {sName(e.school_id)} · {day(e.starts_at)}–{day(e.ends_at)} · cap {money(e.cap_cents)}</span></p>
            {d.campaigns.filter((c) => c.election_id === e.id).map((c) => (
              <div key={c.id} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700">
                <p><b>{c.display_name}</b> · "{c.slogan || ''}" · {c.status}{c.photo_url ? (c.photo_ok ? ' · photo OK' : '') : ''}</p>
                <p className="muted">Parent: {c.parent_name} ({c.parent_email}) · paid {money(c.budget_cents)} · used {money(c.spent_cents)} · {c.views} scans</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.status !== 'approved' && <button className="btn-orange py-2" onClick={() => setCampaign(c, 'approved')}>Approve</button>}
                  {c.status !== 'rejected' && <button className="btn-outline py-2" onClick={() => setCampaign(c, 'rejected')}>{c.status === 'approved' ? 'Take down' : 'Reject'}</button>}
                  <button className="btn-outline py-2" onClick={() => pay(c)}>Record parent payment</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="h2">Kindness Campaigns</h2>
        <form onSubmit={addKind} className="card space-y-2">
          <input className="input" placeholder="Name, like Spring Kindness Challenge" value={kf.name} onChange={(e) => setKf({ ...kf, name: e.target.value })} />
          <select className="input" value={kf.school_id} onChange={(e) => setKf({ ...kf, school_id: e.target.value })}><option value="">No school (open to anyone)</option>{d.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-bold">Starts<input type="date" className="input" value={kf.start} onChange={(e) => setKf({ ...kf, start: e.target.value })} /></label>
            <label className="text-sm font-bold">Ends<input type="date" className="input" value={kf.end} onChange={(e) => setKf({ ...kf, end: e.target.value })} /></label>
          </div>
          <button className="btn-black w-full">Add Kindness Campaign</button>
        </form>
        {d.kind.map((k) => (
          <div key={k.id} className="card space-y-2">
            <p className="font-bold">{k.name} <span className="muted text-sm font-normal">· {day(k.starts_at)}–{day(k.ends_at)} · <a className="underline" href={`${SITE_URL}/kindness/${k.slug}`} target="_blank" rel="noreferrer">leaderboard</a></span></p>
            {d.teams.filter((t) => t.campaign_id === k.id).map((t) => <p key={t.id} className="text-sm">{t.name} · team code <b>{t.join_code}</b></p>)}
            <div className="flex gap-2"><input className="input" placeholder="Team name, like Student Council" value={team[k.id] || ''} onChange={(e) => setTeam({ ...team, [k.id]: e.target.value })} /><button className="btn-outline shrink-0" onClick={() => addTeam(k)}>Add team</button></div>
          </div>
        ))}
      </section>
    </div>
  )
}
