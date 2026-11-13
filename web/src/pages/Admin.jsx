import { useEffect, useState } from 'react'
import { money, supabase, useSession } from '../lib/supabase'
import AuthBox from '../components/AuthBox'
import MapPicker, { AddressSearch, FT_PER_M, describeRadius } from '../components/MapPicker'
import Printables from '../components/Printables'
import { Notice, Spinner } from '../components/Layout'

const TABS = ['Overview', 'Holders', 'Zones', 'Ads', 'Fund', 'House messages', 'Openers', 'Payouts', 'Scans', 'Supporters', 'Settings']
const when = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function useTable(table, order = 'created_at', deps = []) {
  const [rows, setRows] = useState(null)
  const load = () => supabase.from(table).select('*').order(order, { ascending: false }).limit(300).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, deps) // eslint-disable-line
  return [rows, load]
}

function Overview() {
  const [o, setO] = useState(null)
  useEffect(() => { supabase.rpc('admin_overview').then(({ data }) => setO(data)) }, [])
  if (!o) return <Spinner />
  const box = (l, v) => <div className="card"><p className="muted text-sm">{l}</p><p className="text-2xl font-extrabold">{v}</p></div>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {box('Community Fund', money(o.fund_balance_cents))}
        {box('Scans today', o.scans_today)}
        {box('Verified today', o.verified_today)}
        {box('Paid to holders today', money(o.paid_today_cents))}
        {box('Platform earned (all time)', money(o.platform_total_cents))}
        {box('Holders waiting', o.pending_holders)}
        {box('Ads waiting', o.pending_ads)}
        {box('Advertisers waiting', o.pending_advertisers)}
      </div>
      <div className="card"><p className="font-bold">Scans today by status</p><pre className="mt-2 whitespace-pre-wrap text-sm">{JSON.stringify(o.status_today, null, 1)}</pre></div>
      <div className="card"><p className="font-bold">"What's next" taps (all time)</p><pre className="mt-2 text-sm">{JSON.stringify(o.taps, null, 1)}</pre></div>
      {o.open_flags > 0 && <Notice kind="error">{o.open_flags} fraud flag(s) to review on the Scans tab.</Notice>}
    </div>
  )
}

function Holders() {
  const [rows, load] = useTable('holders')
  const [printing, setPrinting] = useState(null)
  const [msg, setMsg] = useState(null)
  if (printing) return <div><button className="no-print mb-3 font-bold underline" onClick={() => setPrinting(null)}>← Back</button><Printables holder={printing} /></div>
  if (!rows) return <Spinner />
  async function approve(h) { const { data, error } = await supabase.rpc('approve_holder', { p_holder: h.id }); setMsg(error ? { k: 'error', t: error.message } : { k: 'ok', t: `${h.first_name} approved as #${data}` }); load() }
  async function setStatus(h, status) { await supabase.from('holders').update({ status }).eq('id', h.id); load() }
  async function setGoal(h) { const g = prompt(`Daily scan goal for ${h.first_name} (blank = default)`, h.daily_goal ?? ''); if (g === null) return; await supabase.from('holders').update({ daily_goal: g ? Number(g) : null }).eq('id', h.id); load() }
  return (
    <div className="space-y-3">
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
      {rows.length === 0 && <p className="muted">No holders yet.</p>}
      {rows.map((h) => (
        <div key={h.id} className="card flex flex-wrap items-center gap-3">
          {h.photo_url ? <img src={h.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-neutral-200" />}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{h.first_name} {h.holder_code ? `#${h.holder_code}` : ''} <span className="pill bg-neutral-200 text-neutral-800">{h.status}</span></p>
            <p className="muted truncate text-sm">{h.general_area} · joined {when(h.created_at)}</p>
            {h.story && <p className="mt-1 line-clamp-2 text-sm">{h.story}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {h.status !== 'active' && <button className="btn-orange py-2" onClick={() => approve(h)}>Approve</button>}
            {h.status === 'active' && <button className="btn-outline py-2" onClick={() => setPrinting(h)}>Print</button>}
            {h.status === 'active' && <button className="btn-outline py-2" onClick={() => setGoal(h)}>Goal</button>}
            {h.status !== 'deactivated' && <button className="btn-outline py-2" onClick={() => setStatus(h, 'deactivated')}>Turn off</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

const PRESETS = [[100, 'ft'], [300, 'ft'], [500, 'ft'], [1000, 'ft'], [0.5, 'mi'], [1, 'mi'], [3, 'mi'], [10, 'mi']]
const toMeters = (n, unit) => (unit === 'mi' ? n * 1609.34 : n / FT_PER_M)

function Zones() {
  const [rows, load] = useTable('advertising_zones')
  const [point, setPoint] = useState(null)
  const [name, setName] = useState('')
  const [size, setSize] = useState('300')
  const [unit, setUnit] = useState('ft')
  const [err, setErr] = useState(null)
  const radiusM = toMeters(Number(size) || 0, unit)
  function picked(p) {
    setPoint(p)
    if (p.label && !name) setName(p.label.split(',').slice(0, 2).join(',').trim())
  }
  async function add() {
    setErr(null)
    if (!point) return setErr('Search an address or tap the map to place the zone.')
    if (!name.trim()) return setErr('Give the zone a name.')
    if (!(radiusM >= 15)) return setErr('Make the zone at least 50 feet across.')
    if (radiusM > 50000) return setErr('That zone is too big. Keep it under 30 miles.')
    const { error } = await supabase.from('advertising_zones').insert({ name: name.trim(), lat: point.lat, lng: point.lng, radius_m: Math.round(radiusM) })
    if (error) return setErr(error.message)
    setPoint(null); setName(''); load()
  }
  async function toggle(z) { await supabase.from('advertising_zones').update({ active: !z.active }).eq('id', z.id); load() }
  async function del(z) { if (confirm(`Delete zone "${z.name}"?`)) { await supabase.from('advertising_zones').delete().eq('id', z.id); load() } }
  return (
    <div className="space-y-4">
      <p className="muted">A scan only pays when the person scanning is inside an active zone. Search an address or tap the map, then pick how far the zone reaches from that spot.</p>
      <AddressSearch onPick={picked} />
      <MapPicker point={point} radius={radiusM} onPick={setPoint} circles={(rows || []).filter((z) => z.active)} height={380} />
      <div>
        <p className="label">Zone size (distance from the center to the edge)</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([n, u]) => (
            <button key={`${n}${u}`} type="button" onClick={() => { setSize(String(n)); setUnit(u) }}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${Number(size) === n && unit === u ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{n} {u}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input w-32" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Zone size" />
          <select className="input w-32" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="ft">feet</option><option value="mi">miles</option></select>
        </div>
        <p className="muted mt-1 text-xs">Tip: GPS on phones can be off by 30 to 100 feet, so very small zones (under 150 ft) may miss some real scans.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder="Zone name, like Lake St and Hennepin" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-orange" onClick={add}>Add zone</button>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {(rows || []).map((z) => (
        <div key={z.id} className="card flex flex-wrap items-center justify-between gap-2">
          <button className="text-left font-bold underline-offset-2 hover:underline" onClick={() => setPoint({ lat: z.lat, lng: z.lng })}>{z.name} · {describeRadius(z.radius_m)} {z.active ? '' : '(off)'}</button>
          <span className="flex gap-2"><button className="btn-outline py-2" onClick={() => toggle(z)}>{z.active ? 'Turn off' : 'Turn on'}</button><button className="btn-outline py-2" onClick={() => del(z)}>Delete</button></span>
        </div>
      ))}
    </div>
  )
}

function Ads() {
  const [ads, loadAds] = useTable('ads')
  const [advs, loadAdvs] = useTable('advertisers')
  if (!ads || !advs) return <Spinner />
  const advName = (id) => advs.find((a) => a.id === id)?.business_name || '?'
  async function adStatus(a, status) { await supabase.from('ads').update({ status }).eq('id', a.id); loadAds() }
  async function advStatus(a, status) { await supabase.from('advertisers').update({ status }).eq('id', a.id); loadAdvs() }
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="h2">Advertisers</h2>
        {advs.length === 0 && <p className="muted">No advertisers yet.</p>}
        {advs.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span><b>{a.business_name}</b> · {a.contact_name} {a.phone} · balance {money(a.balance_cents)} · <i>{a.status}</i></span>
            <span className="flex gap-2">
              {a.status !== 'approved' && <button className="btn-orange py-2" onClick={() => advStatus(a, 'approved')}>Approve</button>}
              {a.status !== 'suspended' && <button className="btn-outline py-2" onClick={() => advStatus(a, 'suspended')}>Suspend</button>}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">Ads</h2>
        {ads.length === 0 && <p className="muted">No ads yet.</p>}
        {ads.map((a) => (
          <div key={a.id} className="card">
            <p className="font-extrabold">{a.headline} <span className="pill bg-neutral-200 text-neutral-800">{a.ad_type}</span> <span className="pill bg-orange/20">{a.status}</span></p>
            <p className="text-sm">{a.body}</p>
            <p className="muted text-sm">{advName(a.advertiser_id)} · {(a.radius_m / 1609.34).toFixed(0)} mi · {a.views} scans · {a.clicks} taps · {a.button_url}</p>
            {a.ad_type === 'political' && <p className="text-sm font-bold">Disclaimer: Prepared and paid for by the {a.political_committee}, {a.political_address}. Reg: {a.political_registration || 'none'}</p>}
            <div className="mt-2 flex gap-2">
              {a.status !== 'active' && <button className="btn-orange py-2" onClick={() => adStatus(a, 'active')}>Approve and run</button>}
              {a.status === 'active' && <button className="btn-outline py-2" onClick={() => adStatus(a, 'paused')}>Pause</button>}
              {a.status !== 'rejected' && <button className="btn-outline py-2" onClick={() => adStatus(a, 'rejected')}>Reject</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Fund() {
  const [rows, load] = useTable('community_fund_transactions')
  const [amt, setAmt] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  const bal = (rows || []).reduce((a, r) => a + r.amount_cents, 0)
  async function deposit() {
    setErr(null)
    const cents = Math.round(Number(amt) * 100)
    if (!cents) return setErr('Enter an amount.')
    const { error } = await supabase.rpc('admin_fund_deposit', { p_cents: cents, p_note: note || 'Admin deposit' })
    if (error) return setErr(error.message)
    setAmt(''); setNote(''); load()
  }
  return (
    <div className="space-y-4">
      <div className="card"><p className="muted text-sm">Balance</p><p className="text-3xl font-extrabold">{money(bal)}</p></div>
      <div className="card space-y-2">
        <p className="font-bold">Record money you added (example: your $500 launch deposit). Use a minus sign to correct a mistake.</p>
        <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
          <input className="input" inputMode="decimal" placeholder="500" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <input className="input" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-orange" onClick={deposit}>Add</button>
        </div>
        {err && <Notice kind="error">{err}</Notice>}
      </div>
      <div className="card"><ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
        {(rows || []).slice(0, 100).map((r) => <li key={r.id} className="flex justify-between py-2"><span>{r.source}{r.donor_name ? ` · ${r.donor_name}` : ''}{r.note ? ` · ${r.note}` : ''} · {when(r.created_at)}</span><b>{money(r.amount_cents)}</b></li>)}
      </ul></div>
    </div>
  )
}

function HouseMessages() {
  const [rows, load] = useTable('house_messages')
  const blank = { kind: 'positive', headline: '', body: '', image_url: '', button_text: '', button_url: '', weight: 1 }
  const [f, setF] = useState(blank)
  const [err, setErr] = useState(null)
  async function add() {
    setErr(null)
    if (!f.body.trim()) return setErr('Add the message text.')
    const { error } = await supabase.from('house_messages').insert({ ...f, headline: f.headline || null, image_url: f.image_url || null, button_text: f.button_text || null, button_url: f.button_url || null, weight: Number(f.weight) || 1 })
    if (error) return setErr(error.message)
    setF(blank); load()
  }
  async function toggle(m) { await supabase.from('house_messages').update({ active: !m.active }).eq('id', m.id); load() }
  async function del(m) { if (confirm('Delete this message?')) { await supabase.from('house_messages').delete().eq('id', m.id); load() } }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-4">
      <p className="muted">These show when the Community Fund pays for a scan. Positive messages also show to people whose scan didn't count.</p>
      <div className="card space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button className={f.kind === 'positive' ? 'btn-black' : 'btn-outline'} onClick={() => setF({ ...f, kind: 'positive' })}>Positive message</button>
          <button className={f.kind === 'project_promo' ? 'btn-black' : 'btn-outline'} onClick={() => setF({ ...f, kind: 'project_promo' })}>Promote a project</button>
        </div>
        {f.kind === 'project_promo' && <input className="input" placeholder="Headline, like Need fast cash? Try BridgeWork" value={f.headline} onChange={set('headline')} />}
        <textarea className="input" placeholder="Message text" value={f.body} onChange={set('body')} />
        {f.kind === 'project_promo' && <>
          <input className="input" placeholder="Image link (optional)" value={f.image_url} onChange={set('image_url')} />
          <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="Button text" value={f.button_text} onChange={set('button_text')} /><input className="input" placeholder="Button link https://…" value={f.button_url} onChange={set('button_url')} /></div>
        </>}
        <label className="text-sm font-bold">How often (weight)<input className="input" type="number" min="1" value={f.weight} onChange={set('weight')} /></label>
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-orange w-full" onClick={add}>Add message</button>
      </div>
      {(rows || []).map((m) => (
        <div key={m.id} className="card">
          <p className="font-bold">{m.kind === 'positive' ? 'Positive' : 'Promo'}{m.headline ? `: ${m.headline}` : ''} {m.active ? '' : '(off)'}</p>
          <p className="text-sm">{m.body}</p>
          <p className="muted text-sm">weight {m.weight} · {m.views} views · {m.clicks} taps</p>
          <div className="mt-2 flex gap-2"><button className="btn-outline py-2" onClick={() => toggle(m)}>{m.active ? 'Turn off' : 'Turn on'}</button><button className="btn-outline py-2" onClick={() => del(m)}>Delete</button></div>
        </div>
      ))}
    </div>
  )
}

function Openers() {
  const [rows, load] = useTable('launch_openers', 'sort')
  if (!rows) return <Spinner />
  async function save(o, patch) { await supabase.from('launch_openers').update(patch).eq('id', o.id); load() }
  return (
    <div className="space-y-3">
      <p className="muted">Shown for 3 seconds on scans paid by the Community Fund, after "You just helped [First Name] earn money. 🙌"</p>
      {[...rows].sort((a, b) => a.sort - b.sort).map((o) => (
        <div key={o.id} className="card space-y-2">
          <textarea className="input" defaultValue={o.body} onBlur={(e) => e.target.value !== o.body && save(o, { body: e.target.value })} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button className="btn-outline py-2" onClick={() => save(o, { active: !o.active })}>{o.active ? 'On (tap to turn off)' : 'Off (tap to turn on)'}</button>
            <label className="font-bold">Weight <input type="number" min="1" className="input inline w-20 py-2" defaultValue={o.weight} onBlur={(e) => save(o, { weight: Number(e.target.value) || 1 })} /></label>
            <span className="muted">{o.views} views</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Payouts() {
  const [o, setO] = useState(null)
  const [paid, loadPaid] = useTable('payouts')
  const [err, setErr] = useState(null)
  const load = () => supabase.rpc('admin_overview').then(({ data }) => setO(data))
  useEffect(() => { load() }, [])
  async function pay(h) {
    const amt = prompt(`Pay ${h.first_name} how much? Balance ${money(h.balance_cents)}`, (h.balance_cents / 100).toFixed(2))
    if (!amt) return
    const method = prompt('How? (Cash App, cash, partner pickup, other)', 'Cash App') || 'other'
    const note = prompt('Note (optional)', '') || ''
    const { error } = await supabase.rpc('admin_record_payout', { p_holder: h.id, p_cents: Math.round(Number(amt) * 100), p_method: method, p_note: note })
    setErr(error?.message || null); load(); loadPaid()
  }
  if (!o) return <Spinner />
  return (
    <div className="space-y-4">
      <p className="muted">Pay holders by hand for now, then record it here. Instant debit-card cash-out comes in the next round.</p>
      {err && <Notice kind="error">{err}</Notice>}
      {o.balances.length === 0 && <p className="muted">Nobody has a balance yet.</p>}
      {o.balances.map((h) => (
        <div key={h.id} className="card flex items-center justify-between"><span className="font-bold">{h.first_name} #{h.holder_code} · {money(h.balance_cents)}</span><button className="btn-orange py-2" onClick={() => pay(h)}>Record payout</button></div>
      ))}
      <div className="card"><p className="font-bold">Past payouts</p><ul className="mt-2 text-sm">{(paid || []).map((p) => <li key={p.id}>{when(p.created_at)} · {money(p.amount_cents)} · {p.method} {p.note}</li>)}</ul></div>
    </div>
  )
}

function Scans() {
  const [rows] = useTable('scans')
  const [flags, loadFlags] = useTable('fraud_flags')
  async function resolve(f) { await supabase.from('fraud_flags').update({ resolved: true }).eq('id', f.id); loadFlags() }
  if (!rows) return <Spinner />
  return (
    <div className="space-y-4">
      {(flags || []).filter((f) => !f.resolved).map((f) => (
        <div key={f.id} className="card flex items-center justify-between"><span className="text-sm"><b>Flag:</b> {f.reason} · {when(f.created_at)}</span><button className="btn-outline py-2" onClick={() => resolve(f)}>Mark reviewed</button></div>
      ))}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="muted"><th className="py-1">When</th><th>Status</th><th>Paid by</th><th>Holder got</th></tr></thead>
          <tbody>{rows.slice(0, 200).map((s) => <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-700"><td className="py-1">{when(s.created_at)}</td><td>{s.status}</td><td>{s.paid_by}</td><td>{money(s.holder_cents)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

function Supporters() {
  const [rows] = useTable('supporter_plans')
  const [codes, loadCodes] = useTable('referral_codes')
  const [code, setCode] = useState('')
  if (!rows) return <Spinner />
  const real = rows.filter((r) => r.status !== 'pending')
  async function addCode() { if (!code.trim()) return; await supabase.from('referral_codes').insert({ code: code.trim().toUpperCase(), label: code.trim() }); setCode(''); loadCodes() }
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <p className="font-bold">Referral codes (add ?ref=CODE to the /support link to track who signed people up)</p>
        <div className="flex gap-2"><input className="input" placeholder="JERMAINE" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn-orange" onClick={addCode}>Add</button></div>
        <ul className="text-sm">{(codes || []).map((c) => <li key={c.code}><b>{c.code}</b>: {real.filter((r) => (r.referral_code || '').toUpperCase() === c.code).length} supporters · {window.location.origin}/support?ref={c.code}</li>)}</ul>
      </div>
      {real.length === 0 && <p className="muted">No supporters yet.</p>}
      {real.map((r) => <div key={r.id} className="card text-sm"><b>{r.first_name || r.email || 'Supporter'}</b> · {r.plan_type === 'weekly' ? `${money(r.amount_cents)}/week × ${r.weeks}` : `${money(r.amount_cents)} once`} · {r.payments_made} paid · {r.status}{r.referral_code ? ` · ref ${r.referral_code}` : ''}</div>)}
    </div>
  )
}

function Settings() {
  const [rows, load] = useTable('settings', 'key')
  const [msg, setMsg] = useState(null)
  if (!rows) return <Spinner />
  async function save(r, raw) {
    let value
    try { value = JSON.parse(raw) } catch { value = raw }
    const { error } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', r.key)
    setMsg(error ? { k: 'error', t: error.message } : { k: 'ok', t: `Saved ${r.key}` }); load()
  }
  return (
    <div className="space-y-2">
      <p className="muted">Money is in cents (50 = $0.50). Text goes in quotes. Changes save when you click away from a box.</p>
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
      {[...rows].sort((a, b) => a.key.localeCompare(b.key)).map((r) => (
        <label key={r.key} className="card block">
          <span className="text-sm font-bold">{r.key}</span>
          <input className="input mt-1" defaultValue={JSON.stringify(r.value)} onBlur={(e) => e.target.value !== JSON.stringify(r.value) && save(r, e.target.value)} />
        </label>
      ))}
    </div>
  )
}

export default function Admin() {
  const session = useSession()
  const [isAdmin, setIsAdmin] = useState(undefined)
  const [tab, setTab] = useState('Overview')
  useEffect(() => { if (session) supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data)) }, [session])
  if (session === undefined) return <Spinner />
  if (!session) return <div className="px-4 py-8"><AuthBox title="Admin log in" redirectPath="/admin" /></div>
  if (isAdmin === undefined) return <Spinner />
  if (!isAdmin) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">This page is for Us In It admins.</h1><p className="muted mt-2">Logged in as {session.user.email}.</p></div>
  const C = { Overview, Holders, Zones, Ads, Fund, 'House messages': HouseMessages, Openers, Payouts, Scans, Supporters, Settings }[tab]
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${tab === t ? 'bg-orange text-ink' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{t}</button>)}
      </div>
      <C />
    </div>
  )
}
