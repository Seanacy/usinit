import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, supabase, useSession } from '../lib/supabase'
import AuthBox from '../components/AuthBox'
import ZoneManager from '../components/ZoneManager'
import { AdminWorkplaces } from './Workplace'
import { AdminChampions } from './Champion'
import { AdminSchools } from './Schools'
import { AdminCreators } from './Digital'
import Printables from '../components/Printables'
import { Notice, Spinner } from '../components/Layout'

const TABS = ['Overview', 'Holders', 'Champions', 'Creators', 'Updates', 'Zones', 'Ads', 'Nonprofits', 'Workplaces', 'Schools', 'Fund', 'House messages', 'Openers', 'Payouts', 'Scans', 'Supporters', 'Settings']
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

function HolderEdit({ h, onDone }) {
  const [f, setF] = useState({ first_name: h.first_name || '', story: h.story || '', general_area: h.general_area || '', photo_url: h.photo_url || '', daily_goal: h.daily_goal ?? '', listed_in_directory: h.listed_in_directory, allow_champions: h.allow_champions })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function save() {
    setErr(null)
    if (!f.first_name.trim()) return setErr('First name is required.')
    const { error } = await supabase.from('holders').update({ ...f, first_name: f.first_name.trim(), photo_url: f.photo_url || null, daily_goal: f.daily_goal === '' ? null : Number(f.daily_goal) }).eq('id', h.id)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="card space-y-3">
      <h2 className="h2">Edit {h.first_name}{h.holder_code ? ` #${h.holder_code}` : ''}</h2>
      <label className="block text-sm font-bold">First name<input className="input" maxLength={40} value={f.first_name} onChange={set('first_name')} /></label>
      <label className="block text-sm font-bold">Story<textarea className="input min-h-[120px]" maxLength={1000} value={f.story} onChange={set('story')} /></label>
      <label className="block text-sm font-bold">General area<input className="input" maxLength={80} value={f.general_area} onChange={set('general_area')} /></label>
      <label className="block text-sm font-bold">Daily scan goal (blank = default)<input className="input" inputMode="numeric" value={f.daily_goal} onChange={set('daily_goal')} /></label>
      {f.photo_url && <div className="flex items-center gap-3"><img src={f.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" /><button className="btn-outline py-2" onClick={() => setF({ ...f, photo_url: '' })}>Remove photo</button></div>}
      <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={f.listed_in_directory} onChange={set('listed_in_directory')} />Listed in public directory</label>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={f.allow_champions} onChange={set('allow_champions')} />Allows Champions</label>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex gap-2"><button className="btn-outline flex-1" onClick={onDone}>Cancel</button><button className="btn-orange flex-1" onClick={save}>Save changes</button></div>
    </div>
  )
}

function Holders() {
  const [rows, load] = useTable('holders')
  const [printing, setPrinting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(null)
  if (printing) return <div><button className="no-print mb-3 font-bold underline" onClick={() => setPrinting(null)}>← Back</button><Printables holder={printing} /></div>
  if (editing) return <HolderEdit h={editing} onDone={() => { setEditing(null); load() }} />
  if (!rows) return <Spinner />
  async function approve(h) { const { data, error } = await supabase.rpc('approve_holder', { p_holder: h.id }); setMsg(error ? { k: 'error', t: error.message } : { k: 'ok', t: `${h.first_name} approved as #${data}` }); load() }
  async function setStatus(h, status) { await supabase.from('holders').update({ status }).eq('id', h.id); load() }
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
            <button className="btn-black py-2" onClick={() => setEditing(h)}>Edit</button>
            {h.status !== 'deactivated' ? <button className="btn-outline py-2" onClick={() => setStatus(h, 'deactivated')}>Turn off</button>
              : h.holder_code && <button className="btn-outline py-2" onClick={() => setStatus(h, 'active')}>Turn back on</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Zones() { return <ZoneManager isAdmin /> }

function Updates() {
  const [rows, setRows] = useState(null)
  const load = () => supabase.rpc('admin_recent_updates').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function hide(u) { await supabase.from('holder_updates').update({ hidden: !u.hidden }).eq('id', u.id); load() }
  if (!rows) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="muted">Updates holders post for their followers. Hide anything that shares where someone is staying, private info, or breaks the rules.</p>
      {rows.length === 0 && <p className="muted">No updates yet.</p>}
      {rows.map((u) => (
        <div key={u.id} className="card space-y-1">
          <p className="text-sm font-bold">{u.first_name} #{u.code} · {when(u.created_at)}{u.hidden ? ' · HIDDEN' : ''}</p>
          <p className="whitespace-pre-line">{u.body}</p>
          {u.photo_url && <img src={u.photo_url} alt="" className="max-h-48 rounded-lg object-cover" />}
          <button className="btn-outline py-2" onClick={() => hide(u)}>{u.hidden ? 'Show again' : 'Hide'}</button>
        </div>
      ))}
    </div>
  )
}

function Nonprofits() {
  const [o, setO] = useState(null)
  const [err, setErr] = useState(null)
  const load = () => supabase.rpc('admin_plug_overview').then(({ data }) => setO(data))
  useEffect(() => { load() }, [])
  async function run(fn, args) { setErr(null); const { error } = await supabase.rpc(fn, args); if (error) setErr(error.message); load() }
  if (!o) return <Spinner />
  return (
    <div className="space-y-6">
      <p className="muted">The Plug for Nonprofits: verified nonprofits carry each other's messages. Each scan costs the sender $0.05 (host $0.04, Us In It $0.01). Approve outreach messages in the Ads tab.</p>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="space-y-3">
        <h2 className="h2">Nonprofit applications</h2>
        {o.applications.length === 0 && <p className="muted">None yet.</p>}
        {o.applications.map((a) => (
          <div key={a.id} className="card space-y-1">
            <p className="font-bold">{a.name}{a.kind ? ` · ${a.kind}` : ''} <span className="pill ml-2 bg-neutral-200 text-neutral-800">{a.status}</span></p>
            <p className="text-sm">Contact: {a.contact || '—'} · EIN: {a.ein || '—'}</p>
            {a.proof && <a href={a.proof} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">Open their proof link</a>}
            <p className="muted text-xs">Check the EIN on the IRS Tax Exempt Organization Search or the Minnesota Secretary of State before approving.</p>
            <div className="flex gap-2 pt-1">
              {a.status !== 'approved' && <button className="btn-orange py-2" onClick={() => run('admin_set_nonprofit', { p_adv: a.id, p_ok: true })}>Approve</button>}
              {a.status !== 'rejected' && <button className="btn-outline py-2" onClick={() => run('admin_set_nonprofit', { p_adv: a.id, p_ok: false })}>{a.status === 'approved' ? 'Remove approval' : 'Reject'}</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">Host cash-out requests</h2>
        {o.cashouts.length === 0 && <p className="muted">None yet.</p>}
        {o.cashouts.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span><b>{c.host}</b> · {money(c.amount_cents)} · {when(c.created_at)} · {c.status}</span>
            {c.status === 'pending' && <span className="flex gap-2">
              <button className="btn-orange py-2" onClick={() => { const m = prompt('How did you pay them? (check, Cash App, bank transfer…)'); if (m) run('admin_plug_cashout', { p_req: c.id, p_paid: true, p_method: m }) }}>Mark paid</button>
              <button className="btn-outline py-2" onClick={() => run('admin_plug_cashout', { p_req: c.id, p_paid: false })}>Reject</button>
            </span>}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">Messages being carried</h2>
        {o.hostings.length === 0 && <p className="muted">None yet.</p>}
        {o.hostings.map((h) => (
          <div key={h.id} className="card text-sm"><b>{h.from}</b> carried by <b>{h.host}</b> · {h.status}{h.code ? ` · code ${h.code}` : ''} · {h.scans} scans</div>
        ))}
      </div>
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
            <p className="muted text-sm">{advName(a.advertiser_id)} · {(a.zone_ids || []).length} zone{(a.zone_ids || []).length === 1 ? '' : 's'} · {a.views} scans · {a.clicks} taps · {a.button_url}</p>
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
  async function undo(r) {
    if (!confirm(`Undo the ${money(r.amount_cents)} deposit? This adds a correcting entry so your records stay complete.`)) return
    const { error } = await supabase.rpc('admin_undo_fund_deposit', { p_tx: r.id })
    setErr(error?.message || null); load()
  }
  return (
    <div className="space-y-4">
      <p className="muted">Money records can't be edited, so your books always add up. Use Undo to reverse a deposit you added by mistake.</p>
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
        {(rows || []).slice(0, 100).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            <span>{r.source}{r.donor_name ? ` · ${r.donor_name}` : ''}{r.note ? ` · ${r.note}` : ''} · {when(r.created_at)}{r.undone ? ' · undone' : ''}</span>
            <span className="flex items-center gap-2"><b>{money(r.amount_cents)}</b>
              {r.source === 'admin_deposit' && !r.undone && <button className="btn-outline px-3 py-1 text-sm" onClick={() => undo(r)}>Undo</button>}</span>
          </li>
        ))}
      </ul></div>
    </div>
  )
}

function HouseMessages() {
  const [rows, load] = useTable('house_messages')
  const blank = { kind: 'positive', headline: '', body: '', image_url: '', button_text: '', button_url: '', weight: 1 }
  const [f, setF] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [err, setErr] = useState(null)
  function startEdit(m) {
    setEditing(m); setErr(null)
    setF({ kind: m.kind, headline: m.headline || '', body: m.body || '', image_url: m.image_url || '', button_text: m.button_text || '', button_url: m.button_url || '', weight: m.weight })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function cancel() { setEditing(null); setF(blank); setErr(null) }
  async function save() {
    setErr(null)
    if (!f.body.trim()) return setErr('Add the message text.')
    if (f.button_url && !/^https?:\/\//i.test(f.button_url)) return setErr('The button link must start with https://')
    const row = { ...f, headline: f.headline || null, image_url: f.image_url || null, button_text: f.button_text || null, button_url: f.button_url || null, weight: Number(f.weight) || 1 }
    const { error } = editing
      ? await supabase.from('house_messages').update(row).eq('id', editing.id)
      : await supabase.from('house_messages').insert(row)
    if (error) return setErr(error.message)
    cancel(); load()
  }
  async function toggle(m) { await supabase.from('house_messages').update({ active: !m.active }).eq('id', m.id); load() }
  async function del(m) { if (confirm('Delete this message?')) { await supabase.from('house_messages').delete().eq('id', m.id); if (editing?.id === m.id) cancel(); load() } }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-4">
      <p className="muted">These show when the Community Fund pays for a scan. Positive messages also show to people whose scan didn't count.</p>
      {editing && <Notice>Editing a saved message. Make your changes, then click Save changes.</Notice>}
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
        <div className="flex gap-2">
          {editing && <button className="btn-outline flex-1" onClick={cancel}>Cancel</button>}
          <button className="btn-orange flex-1" onClick={save}>{editing ? 'Save changes' : 'Add message'}</button>
        </div>
      </div>
      {(rows || []).map((m) => (
        <div key={m.id} className={`card ${editing?.id === m.id ? 'border-orange' : ''}`}>
          <p className="font-bold">{m.kind === 'positive' ? 'Positive' : 'Promo'}{m.headline ? `: ${m.headline}` : ''} {m.active ? '' : '(off)'}</p>
          <p className="text-sm">{m.body}</p>
          <p className="muted text-sm">weight {m.weight} · {m.views} views · {m.clicks} taps</p>
          <div className="mt-2 flex gap-2"><button className="btn-black py-2" onClick={() => startEdit(m)}>Edit</button><button className="btn-outline py-2" onClick={() => toggle(m)}>{m.active ? 'Turn off' : 'Turn on'}</button><button className="btn-outline py-2" onClick={() => del(m)}>Delete</button></div>
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
  async function undoPayout(p) {
    if (!confirm(`Undo this ${money(p.amount_cents)} payout? The money goes back on the holder's balance.`)) return
    const { error } = await supabase.rpc('admin_undo_payout', { p_payout: p.id })
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
      <div className="card"><p className="font-bold">Past payouts</p><ul className="mt-2 divide-y divide-neutral-200 text-sm dark:divide-neutral-700">{(paid || []).map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-2 py-2">
          <span>{when(p.created_at)} · {money(p.amount_cents)} · {p.method} {p.note}{p.undone ? ' · undone' : ''}</span>
          {!p.undone && <button className="btn-outline px-3 py-1 text-sm" onClick={() => undoPayout(p)}>Undo</button>}
        </li>))}</ul></div>
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
          <tbody>{rows.slice(0, 200).map((s) => <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-700"><td className="py-1">{when(s.created_at)}</td><td>{s.status === 'OZA' ? 'OZA (Outside Zone Area)' : s.status}</td><td>{s.paid_by}</td><td>{money(s.holder_cents)}</td></tr>)}</tbody>
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
  async function addCode() { if (!code.trim()) return; await supabase.from('referral_codes').insert({ code: code.trim().toUpperCase().replace(/\s+/g, ''), label: code.trim() }); setCode(''); loadCodes() }
  async function editCode(c) { const label = prompt(`Who is code ${c.code} for? (a note for you)`, c.label || ''); if (label === null) return; await supabase.from('referral_codes').update({ label }).eq('code', c.code); loadCodes() }
  async function toggleCode(c) { await supabase.from('referral_codes').update({ active: !c.active }).eq('code', c.code); loadCodes() }
  async function delCode(c) { if (confirm(`Delete code ${c.code}? Supporters who used it keep their plans.`)) { await supabase.from('referral_codes').delete().eq('code', c.code); loadCodes() } }
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <p className="font-bold">Referral codes (add ?ref=CODE to the /support link to track who signed people up)</p>
        <div className="flex gap-2"><input className="input" placeholder="JERMAINE" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn-orange" onClick={addCode}>Add</button></div>
        <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">{(codes || []).map((c) => (
          <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><b>{c.code}</b>{c.label && c.label.toUpperCase() !== c.code ? ` (${c.label})` : ''}{c.active ? '' : ' (off)'}: {real.filter((r) => (r.referral_code || '').toUpperCase() === c.code).length} supporters · {window.location.origin}/support?ref={c.code}</span>
            <span className="flex gap-2"><button className="btn-black px-3 py-1 text-sm" onClick={() => editCode(c)}>Edit</button><button className="btn-outline px-3 py-1 text-sm" onClick={() => toggleCode(c)}>{c.active ? 'Turn off' : 'Turn on'}</button><button className="btn-outline px-3 py-1 text-sm" onClick={() => delCode(c)}>Delete</button></span>
          </li>))}</ul>
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
  if (!session) return <div className="px-4 py-8"><AuthBox title="Admin log in" redirectPath="/admin" allowSignup={false} /></div>
  if (isAdmin === undefined) return <Spinner />
  if (!isAdmin) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="h2">You're logged in</h1>
      <p className="muted mt-2">{session.user.email} doesn't have admin access. Where do you want to go?</p>
      <div className="mt-6 grid gap-3">
        <Link to="/holder" className="btn-orange">I'm a holder</Link>
        <Link to="/advertise" className="btn-black">I'm a business</Link>
        <button onClick={() => supabase.auth.signOut()} className="btn-outline">Log out</button>
      </div>
    </div>
  )
  const C = { Overview, Holders, Champions: AdminChampions, Creators: AdminCreators, Updates, Zones, Ads, Nonprofits, Workplaces: AdminWorkplaces, Schools: AdminSchools, Fund, 'House messages': HouseMessages, Openers, Payouts, Scans, Supporters, Settings }[tab]
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${tab === t ? 'bg-orange text-ink' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{t}</button>)}
      </div>
      <C />
    </div>
  )
}
