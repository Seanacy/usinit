import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KEY, SUPABASE_URL, money, supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import { Avatar, TEAMS } from '../pages/Ambassadors'

const DAY = 86400000
const quietDays = (a) => {
  const last = a.stats.last_active ? new Date(a.stats.last_active).getTime() : new Date(a.joined).getTime()
  return Math.floor((Date.now() - last) / DAY)
}
const Bar = ({ value, goal }) => (
  <div className="mt-1 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 bg-orange" style={{ width: `${Math.min(100, Math.round((value / Math.max(goal, 1)) * 100))}%` }} /></div>
)

function Row({ a, reload, setMsg }) {
  const [open, setOpen] = useState(false)
  async function set(field, value) {
    const { error } = await supabase.rpc('admin_ambassador_set', { p_id: a.id, p_field: field, p_value: String(value) })
    setMsg(error?.message || null); reload()
  }
  async function shout() {
    const m = prompt(`Shout-out for ${a.name} (shows on their page):`)
    if (!m) return
    const { error } = await supabase.from('ambassador_shoutouts').insert({ ambassador_id: a.id, message: m.slice(0, 280) })
    setMsg(error?.message || `Shout-out added to ${a.name}'s page.`); reload()
  }
  return (
    <div className="card space-y-2">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(!open)}>
        <Avatar a={a} size="h-12 w-12" text="text-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{a.name}{a.status === 'hidden' ? ' (hidden)' : ''}{a.is_team_lead ? ' ⭐' : ''}{a.nonprofit_org ? ' 💚' : ''}</p>
          <p className="muted text-xs">{a.team ? TEAMS[a.team] : 'No team'} · {money(a.stats.raised_cents)} · {a.stats.supporters} supporters · {a.stats.weeks_active} wks · {quietDays(a)}d since last</p>
        </div>
        <span className="text-sm font-bold">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
          <p><b>Email:</b> {a.email} · <b>Code:</b> {a.ref_code} · <Link className="font-bold underline" to={`/ambassadors/${a.slug}`}>Public page</Link></p>
          <p><b>Brought in:</b> {a.stats.businesses} businesses · {a.stats.holders} holders · {a.stats.ambassadors} Ambassadors</p>
          <label className="block"><b>Team</b>
            <select className="input mt-1" value={a.team || ''} onChange={(e) => set('team', e.target.value)}>
              <option value="">No team</option>
              {Object.entries(TEAMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline px-3 py-1" onClick={() => set('team_lead', !a.is_team_lead)}>{a.is_team_lead ? 'Remove Team Lead' : 'Make Team Lead'}</button>
            <button className="btn-outline px-3 py-1" onClick={() => { const o = prompt('Nonprofit name (leave empty to remove the Nonprofit Ambassador badge):', a.nonprofit_org || ''); if (o !== null) set('nonprofit_org', o) }}>{a.nonprofit_org ? 'Edit nonprofit' : 'Mark Nonprofit Ambassador'}</button>
            <button className="btn-outline px-3 py-1" onClick={shout}>Add shout-out</button>
            <button className="btn-outline px-3 py-1" onClick={() => { const n = prompt('New display name:', a.name); if (n) set('name', n) }}>Reset name</button>
            <button className="btn-outline px-3 py-1" onClick={() => set('status', a.status === 'hidden' ? 'active' : 'hidden')}>{a.status === 'hidden' ? 'Show page' : 'Hide page'}</button>
          </div>
          {a.names.length > 0 && (
            <div><b>Name history</b><ul className="muted mt-1">{a.names.map((n, i) => <li key={i}>{new Date(n.at).toLocaleDateString()}: {n.old} → {n.new}</li>)}</ul></div>
          )}
        </div>
      )}
    </div>
  )
}

function Tree({ list }) {
  const kids = {}
  list.forEach((a) => { const k = a.recruited_by || 'root'; (kids[k] = kids[k] || []).push(a) })
  const Node = ({ a, depth }) => (
    <li>
      <p style={{ paddingLeft: depth * 16 }} className="py-1 text-sm">{depth > 0 ? '└ ' : ''}<b>{a.name}</b> <span className="muted">· {a.stats.ambassadors} brought in · {money(a.stats.raised_cents)}</span></p>
      {(kids[a.id] || []).map((c) => <Node key={c.id} a={c} depth={depth + 1} />)}
    </li>
  )
  return <ul>{(kids.root || []).map((a) => <Node key={a.id} a={a} depth={0} />)}</ul>
}

// Automatic Ambassador emails: send yourself a test copy of each one.
function EmailBox() {
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState(null)
  async function test() {
    setBusy(true); setOut(null)
    try {
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ambassador-mailer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${s?.session?.access_token}` },
        body: JSON.stringify({ action: 'test' }),
      })
      const j = await res.json().catch(() => ({}))
      setOut(res.ok ? `Sent ${j.sent} test emails to ${j.to}. Check your inbox (and spam).` : (j.error || 'Something went wrong.'))
    } catch (e) { setOut(e.message) }
    setBusy(false)
  }
  return (
    <div className="card space-y-2">
      <p className="font-extrabold">📧 Automatic emails are on</p>
      <p className="muted text-sm">Welcome, milestones, Monday 9 AM update, 2-week nudge, and Community Fund alerts (low under $500, high at $3,000). At most 2 a week per Ambassador. Change the numbers in Settings: amb_fund_low_cents, amb_fund_high_cents, amb_weekly_hour, amb_email_week_cap.</p>
      <button className="btn-black w-full py-4 text-lg" onClick={test} disabled={busy}>{busy ? 'Sending…' : 'Send me a test of every email'}</button>
      {out && <p className="text-sm font-bold">{out}</p>}
    </div>
  )
}

export default function AdminAmbassadors() {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState(null)
  const [view, setView] = useState('all')
  const load = () => supabase.rpc('admin_ambassadors').then(({ data, error }) => { setD(data); if (error) setMsg(error.message) })
  useEffect(() => { load() }, [])
  if (!d) return msg ? <Notice kind="error">{msg}</Notice> : <Spinner />

  const list = d.list
  const active = list.filter((a) => a.status === 'active')
  const quiet = active.filter((a) => quietDays(a) >= 14).sort((x, y) => quietDays(y) - quietDays(x))
  const standouts = [...active].sort((x, y) => (y.stats.weeks_active - x.stats.weeks_active) || (y.stats.raised_cents - x.stats.raised_cents)).slice(0, 10)
  const teams = Object.keys(TEAMS).map((k) => {
    const m = active.filter((a) => a.team === k)
    return { k, n: m.length, raised: m.reduce((s, a) => s + a.stats.raised_cents, 0), holders: m.reduce((s, a) => s + a.stats.holders, 0), biz: m.reduce((s, a) => s + a.stats.businesses, 0) }
  }).filter((t) => t.n > 0)
  const sc = d.scans
  const totalScans = Math.round(sc.street + sc.champion + sc.digital + sc.gifttree + sc.plug)
  const up = (now, before) => (before === 0 ? '' : now >= before ? ` ▲ from ${before}` : ` ▼ from ${before}`)

  return (
    <div className="space-y-4">
      {msg && <Notice>{msg}</Notice>}
      <EmailBox />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card"><p className="muted text-sm">Ambassadors</p><p className="text-3xl font-extrabold">{active.length}</p><p className="muted text-xs">goal 200+</p></div>
        <div className="card"><p className="muted text-sm">New this month</p><p className="text-3xl font-extrabold">{d.new_month}</p><p className="muted text-xs">{up(d.new_month, d.new_last_month).trim() || 'first month'}</p></div>
        <div className="card"><p className="muted text-sm">Active (30 days)</p><p className="text-3xl font-extrabold">{d.active_30}</p><p className="muted text-xs">{quiet.length} gone quiet</p></div>
        <div className="card"><p className="muted text-sm">Raised this month</p><p className="text-3xl font-extrabold">{money(d.raised_month)}</p><p className="muted text-xs">last month {money(d.raised_last_month)}</p></div>
      </div>

      <div className="card space-y-2">
        <p className="font-bold">Scan roadmap (paid scans a day, last 7 days)</p>
        <p className="text-sm">Now: <b>{totalScans.toLocaleString()}</b> a day</p>
        <p className="text-sm">Goal 1: {d.goal_1.toLocaleString()} a day ($300/day take-home)</p><Bar value={totalScans} goal={d.goal_1} />
        <p className="text-sm">Goal 2: {d.goal_2.toLocaleString()} a day ($500/day take-home)</p><Bar value={totalScans} goal={d.goal_2} />
        <p className="muted text-xs">Street {Math.round(sc.street)} · Champions {Math.round(sc.champion)} · Digital {Math.round(sc.digital)} · Gift Tree {Math.round(sc.gifttree)} · Plug {Math.round(sc.plug)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['all', `Everyone (${list.length})`], ['standouts', 'Stand-outs'], ['quiet', `Gone quiet (${quiet.length})`], ['teams', 'Teams'], ['tree', 'Who brought who']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-2 text-sm font-bold ${view === k ? 'bg-orange text-black' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{l}</button>
        ))}
      </div>

      {view === 'all' && (list.length === 0 ? <p className="muted">No Ambassadors yet. Share usinit.com/ambassador to get your first two.</p> : list.map((a) => <Row key={a.id} a={a} reload={load} setMsg={setMsg} />))}
      {view === 'standouts' && (
        <>
          <p className="muted text-sm">Most consistent first (weeks active), then money raised. These are your Team Lead picks.</p>
          {standouts.map((a) => <Row key={a.id} a={a} reload={load} setMsg={setMsg} />)}
        </>
      )}
      {view === 'quiet' && (
        <>
          <p className="muted text-sm">No activity in 2+ weeks. A quick check-in from you or their Team Lead helps.</p>
          {quiet.length === 0 ? <p className="muted">Nobody's gone quiet. 🎉</p> : quiet.map((a) => <Row key={a.id} a={a} reload={load} setMsg={setMsg} />)}
        </>
      )}
      {view === 'teams' && (
        <div className="card">
          {teams.length === 0 ? <p className="muted">No teams set yet. Open an Ambassador and pick a team.</p> : (
            <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
              {teams.map((t) => <li key={t.k} className="py-2"><b>{TEAMS[t.k]}</b> · {t.n} Ambassadors · {money(t.raised)} · {t.biz} businesses · {t.holders} holders</li>)}
            </ul>
          )}
        </div>
      )}
      {view === 'tree' && <div className="card">{list.length === 0 ? <p className="muted">Nobody yet.</p> : <Tree list={list} />}</div>}
    </div>
  )
}
