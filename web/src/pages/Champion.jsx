import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { money, supabase, useSession } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import AuthBox from '../components/AuthBox'
import Printables from '../components/Printables'

export const CROWDS = [['school', 'School event'], ['work', 'Work event'], ['church', 'Church / faith'], ['sports', 'Sports event'], ['livestream', 'Livestream'], ['other', 'Other']]
const crowdLabel = (k) => CROWDS.find((c) => c[0] === k)?.[1] || k
const LIGHT = {
  EARNING_AD: ['bg-green-500', 'Earning from ads'],
  AD_LIMIT_SPOT_NO_LOVE_NOTES: ['bg-yellow-400', 'This spot is maxed out. Move at least 200 feet to a new spot and ads will pay again.'],
  NOTHING_RUNNING_AREA: ['bg-neutral-400', 'No paid messages are running here right now. Tips still work.'],
  OZA: ['bg-red-500', 'You\'re outside the business zones. Champion scans earn only inside a zone.'],
  HOLDER_DAILY_CAP: ['bg-orange', 'They hit their max for today. Scans earn again at midnight.'],
}

// ================= Public directory: /directory =================
export function Directory() {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [printing, setPrinting] = useState(null)
  useEffect(() => { supabase.rpc('list_directory').then(({ data }) => setList(data || [])) }, [])
  if (!list) return <Spinner />
  if (printing) return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button className="no-print mb-4 font-bold underline" onClick={() => setPrinting(null)}>← Back to the directory</button>
      {printing.allow_champions && <div className="no-print mb-4"><Notice>Want credit for the scans you bring in? <Link className="font-bold underline" to={`/champion?holder=${printing.code}`}>Become a Champion</Link> and print your own Champion code instead.</Notice></div>}
      <Printables holder={{ holder_code: printing.code, first_name: printing.first_name }} />
    </div>
  )
  const shown = list.filter((h) => !q.trim() || `${h.first_name} ${h.general_area || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="h1">Holders</h1>
      <p className="muted mt-2">People who chose to be listed. Print a code and share it anywhere: at work, at school, at church, on a shirt.</p>
      <input className="input mt-4" placeholder="Search by name or area, like Uptown" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.length === 0 && <p className="muted">No holders listed yet.</p>}
        {shown.map((h) => (
          <div key={h.code} className="card space-y-2">
            <Link to={`/p/${h.code}`} className="flex items-center gap-3">
              {h.photo_url ? <img src={h.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange text-2xl font-extrabold text-ink">{h.first_name?.[0]}</div>}
              <div><p className="text-lg font-extrabold">{h.first_name}</p><p className="muted text-sm">#{h.code}{h.general_area ? ` · ${h.general_area}` : ''}</p></div>
            </Link>
            {h.story && <p className="text-sm">{h.story}{h.story.length >= 160 ? '…' : ''}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-black py-2" onClick={() => setPrinting(h)}>Print this code</button>
              {h.allow_champions && <Link className="btn-outline py-2" to={`/champion?holder=${h.code}`}>Become a Champion</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================= Champion page: /champion =================
function SignupForm({ onDone }) {
  const [f, setF] = useState({ name: '', phone: '', notify: 'email', minor: false, parent_name: '', parent_email: '', terms: false })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function save(e) {
    e.preventDefault(); setErr(null)
    if (!f.terms) return setErr('Please agree to the Champion rules.')
    const { error } = await supabase.rpc('become_champion', { p_name: f.name, p_phone: f.phone, p_notify: f.notify, p_minor: f.minor, p_parent_name: f.parent_name, p_parent_email: f.parent_email })
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <form onSubmit={save} className="card space-y-3">
      <h2 className="h2">Become a Champion</h2>
      <p className="muted">Champions print a holder's code and share it at school, at work, at church, at games, or on a livestream. Every scan inside an Us In It zone can earn for the holder. Champions are never paid.</p>
      <input className="input" placeholder="Your name" value={f.name} onChange={set('name')} />
      <input className="input" type="tel" placeholder="Phone for text alerts (optional)" value={f.phone} onChange={set('phone')} />
      <select className="input" value={f.notify} onChange={set('notify')}><option value="email">Send my alerts by email</option><option value="sms">Send my alerts by text</option></select>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.minor} onChange={set('minor')} /><span>I'm under 18</span></label>
      {f.minor && (
        <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
          <p className="text-sm">A parent or guardian has to say OK first. Us In It will contact them before your account turns on.</p>
          <input className="input" placeholder="Parent or guardian name" value={f.parent_name} onChange={set('parent_name')} />
          <input className="input" type="email" placeholder="Parent or guardian email" value={f.parent_email} onChange={set('parent_email')} />
        </div>
      )}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.terms} onChange={set('terms')} />
        <span>I won't fake scans or pressure anyone to scan. I understand Champions are not paid. (<Link to="/terms" target="_blank" className="underline">Terms</Link>)</span></label>
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full">Become a Champion</button>
    </form>
  )
}

function AddHolder({ preset, onDone }) {
  const [list, setList] = useState([])
  const [h, setH] = useState(preset || '')
  const [crowd, setCrowd] = useState('school')
  const [err, setErr] = useState(null)
  useEffect(() => { supabase.rpc('list_directory').then(({ data }) => setList((data || []).filter((x) => x.allow_champions))) }, [])
  async function add() {
    setErr(null)
    const { error } = await supabase.rpc('champion_add_holder', { p_holder_code: h.trim(), p_crowd: crowd })
    if (error) return setErr(error.message)
    setH(''); onDone()
  }
  return (
    <div className="card space-y-3">
      <h2 className="h2">Champion a holder</h2>
      <select className="input" value={list.some((x) => x.code === h) ? h : ''} onChange={(e) => setH(e.target.value)}>
        <option value="">Pick a holder from the directory…</option>
        {list.map((x) => <option key={x.code} value={x.code}>{x.first_name} #{x.code}{x.general_area ? ` · ${x.general_area}` : ''}</option>)}
      </select>
      <input className="input" placeholder="…or type their holder number, like 5473" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ''))} />
      <label className="label">Where will you share it?</label>
      <select className="input" value={crowd} onChange={(e) => setCrowd(e.target.value)}>{CROWDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full" disabled={!h} onClick={add}>Get my Champion code</button>
    </div>
  )
}

export default function ChampionPage() {
  const session = useSession()
  const [params] = useSearchParams()
  const preset = params.get('holder') || ''
  const [d, setD] = useState(undefined)
  const [printing, setPrinting] = useState(null)
  const [copied, setCopied] = useState(null)
  const load = () => supabase.rpc('champion_dashboard').then(({ data }) => setD(data ?? null))
  useEffect(() => { if (session) load() }, [session])
  if (session === undefined) return <Spinner />
  if (!session) return (
    <div className="px-4 py-8">
      <AuthBox title="Become a Champion" intro="Make a free account. Then print a holder's code and get scans for them at school, at work, or online." redirectPath={`/champion${preset ? `?holder=${preset}` : ''}`} role="champion" />
    </div>
  )
  if (d === undefined) return <Spinner />
  if (printing) return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button className="no-print mb-4 font-bold underline" onClick={() => setPrinting(null)}>← Back</button>
      <Printables holder={{ holder_code: printing.holder_code, first_name: printing.first_name }} champCode={printing.code} crowd={printing.crowd_type} />
    </div>
  )
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="h1">Champion</h1>
      {!d ? <SignupForm onDone={load} /> : (
        <>
          {d.status === 'pending_parent' && <Notice>Thanks, {d.name}! Your account turns on once your parent or guardian says OK. Us In It will contact them.</Notice>}
          {d.status === 'suspended' && <Notice kind="error">Your Champion account is turned off. Contact Us In It for help.</Notice>}
          {d.status === 'active' && <AddHolder preset={preset} onDone={load} />}
          {d.codes.map((c) => {
            const light = LIGHT[c.last_status]
            const brag = `I've helped ${c.first_name} earn ${money(c.helped_cents)} on Us In It. Scan to help: usinit.com`
            return (
              <div key={c.id} className="card space-y-3">
                <div className="flex items-center gap-3">
                  {c.photo_url ? <img src={c.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange text-xl font-extrabold text-ink">{c.first_name?.[0]}</div>}
                  <div><p className="text-lg font-extrabold">{c.first_name} #{c.holder_code}</p><p className="muted text-sm">Your code {c.code} · {crowdLabel(c.crowd_type)}</p></div>
                </div>
                {light && <p className="flex items-center gap-2 text-sm font-bold"><span className={`inline-block h-3 w-3 rounded-full ${light[0]}`} />{light[1]}</p>}
                <p className="font-bold">{c.scans_today} scans today · {c.scans_total} total · you helped {c.first_name} earn {money(c.helped_cents)}</p>
                <label className="label">Where are you sharing it now?</label>
                <select className="input" value={c.crowd_type} onChange={async (e) => { await supabase.rpc('champion_set_crowd', { p_code_id: c.id, p_crowd: e.target.value }); load() }}>
                  {CROWDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-black py-2" onClick={() => setPrinting(c)}>Print my Champion code</button>
                  <button className="btn-outline py-2" onClick={() => { navigator.clipboard?.writeText(brag); setCopied(c.id); setTimeout(() => setCopied(null), 1500) }}>{copied === c.id ? 'Copied!' : 'Copy "I\'ve helped…" to share'}</button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ================= Admin: Champions tab =================
export function AdminChampions() {
  const [rows, setRows] = useState(null)
  const load = () => supabase.rpc('admin_champions').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function set(c, status) { await supabase.rpc('admin_set_champion', { p_id: c.id, p_status: status }); load() }
  if (!rows) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="muted">Champions print a holder's code and share it. Champion scans pay only from ads that turned on Champion scans ($0.25 per scan, holder gets $0.20), at most 2 paid scans per 200 ft spot per code per 24 hours. The Community Fund never pays Champion scans.</p>
      {rows.length === 0 && <p className="muted">No Champions yet.</p>}
      {rows.map((c) => (
        <div key={c.id} className="card space-y-1">
          <p className="font-bold">{c.name} <span className="pill ml-1 bg-neutral-200 text-neutral-800">{c.status === 'pending_parent' ? 'waiting for parent OK' : c.status}</span>{c.circles_24h >= 5 ? <span className="pill ml-1 bg-red-100 text-red-800">{c.circles_24h} spots in 24h</span> : null}</p>
          <p className="text-sm">{c.email} · {c.codes} code{c.codes === 1 ? '' : 's'} · {c.scans} verified scans</p>
          {c.is_minor && <p className="text-sm">Under 18 · parent: {c.parent_name} ({c.parent_email})</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {c.status === 'pending_parent' && <button className="btn-orange py-2" onClick={() => set(c, 'active')}>Parent said OK: turn on</button>}
            {c.status === 'active' && <button className="btn-outline py-2" onClick={() => set(c, 'suspended')}>Suspend</button>}
            {c.status === 'suspended' && <button className="btn-outline py-2" onClick={() => set(c, 'active')}>Turn back on</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
