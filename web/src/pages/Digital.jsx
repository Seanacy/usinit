import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SITE_URL, deviceId, money, supabase, useSession } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import AuthBox from '../components/AuthBox'
import { useQR } from '../components/Printables'
import { ContentCard } from './Scan'
import { recordScan } from '../lib/impact'
import StripePayouts from '../components/StripePayouts'

export const digitalUrl = (code) => `${SITE_URL}/d/${code}`

function ScreenQR({ code, label }) {
  const url = digitalUrl(code)
  const qr = useQR(url)
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-2">
      {qr && <img src={qr} alt={`QR code for ${url}`} className="h-44 w-44 rounded-lg border border-neutral-200" />}
      <p className="break-all text-xs">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline py-2" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied!' : 'Copy link'}</button>
        {qr && <a className="btn-black py-2" href={qr} download={`${label || code}-usinit-qr.png`}>Download QR for your screen</a>}
      </div>
    </div>
  )
}

// ================= Digital scan page: /d/:code =================
export function DigitalScan() {
  const { code } = useParams()
  const [r, setR] = useState(undefined)
  useEffect(() => {
    supabase.rpc('process_digital_scan', { p_code: code, p_device: deviceId() }).then(({ data }) => {
      setR(data || { error: 'not_found' })
      if (data?.who?.code) recordScan(data.who.code)
    })
  }, [code])
  if (r === undefined) return <Spinner label="Loading…" />
  if (r.error) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">We couldn't find that code.</h1></div>
  const w = r.who
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-6">
      <div className="rounded-2xl bg-ink p-4 text-white">
        {w.kind === 'creator'
          ? <p className="text-lg font-extrabold">This code supports {w.creator}, the creator.</p>
          : <p className="text-lg font-extrabold">You're helping {w.first_name}, Us In It holder #{w.code}{w.kind === 'collab' ? `, shared by ${w.creator}` : ''}.</p>}
      </div>
      <ContentCard content={r.content} scanId={null} />
      {r.earned && w.kind !== 'creator' && <p className="text-center text-xl font-extrabold">You just helped {w.first_name} earn money. 🙌</p>}
      {r.earned && w.kind === 'creator' && <p className="text-center text-xl font-extrabold">You just supported {w.creator}. 🙌</p>}
      <p className="text-center text-2xl font-extrabold">Thanks for scanning. 🧡</p>
      {w.code && <Link to={`/p/${w.code}`} className="btn-black w-full">Meet {w.first_name}</Link>}
    </div>
  )
}

// ================= Holder: online code card =================
export function HolderDigital() {
  const [d, setD] = useState(null)
  useEffect(() => { supabase.rpc('holder_digital').then(({ data }) => setD(data)) }, [])
  if (!d?.digital_code) return null
  return (
    <div className="card space-y-3">
      <h2 className="h2">Your online code</h2>
      <p className="muted text-sm">Share this on social media, in a post, or on a livestream. When someone scans it online, a business pays you. ({d.scans_today} online scans today · {d.scans_total} total)</p>
      <ScreenQR code={d.digital_code} label="my-online-code" />
      {d.creators.length > 0 && <p className="text-sm"><b>Creators sharing your code:</b> {d.creators.join(', ')}</p>}
    </div>
  )
}

// ================= Creator page: /creator =================
function CreatorSignup({ onDone }) {
  const [f, setF] = useState({ name: '', links: '' })
  const [err, setErr] = useState(null)
  async function save(e) {
    e.preventDefault(); setErr(null)
    const { error } = await supabase.rpc('become_creator', { p_name: f.name, p_links: f.links })
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <form onSubmit={save} className="card space-y-3">
      <h2 className="h2">Become an Us In It creator</h2>
      <p className="muted">Put a code on your videos, posts, or livestreams. Viewers scan it and see a short message from a business. You get paid for your own code, and you can also share holders' codes to help them.</p>
      <input className="input" maxLength={60} placeholder="The name viewers know you by" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" maxLength={300} placeholder="Your channel or profile links" value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full">Send for approval</button>
    </form>
  )
}

export default function CreatorPage() {
  const session = useSession()
  const [d, setD] = useState(undefined)
  const [dir, setDir] = useState([])
  const [pick, setPick] = useState('')
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const load = () => supabase.rpc('creator_dashboard').then(({ data }) => setD(data ?? null))
  useEffect(() => { if (session) { load(); supabase.rpc('list_directory').then(({ data }) => setDir((data || []).filter((x) => x.allow_champions))) } }, [session])
  async function run(fn, args, msg) { setErr(null); setOk(null); const { error } = await supabase.rpc(fn, args); if (error) return setErr(error.message); if (msg) setOk(msg); load() }
  if (session === undefined) return <Spinner />
  if (!session) return <div className="px-4 py-8"><AuthBox title="Creator sign up" intro="Make a free account, then send your creator profile for approval." redirectPath="/creator" role="creator" /></div>
  if (d === undefined) return <Spinner />
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="h1">Creator</h1>
      {!d ? <CreatorSignup onDone={load} /> : (
        <>
          {d.status === 'pending' && <Notice>Thanks, {d.name}! Us In It is checking your profile. Your codes turn on once you're approved.</Notice>}
          {d.status === 'rejected' && <Notice kind="error">Your creator profile wasn't approved. Contact Us In It with questions.</Notice>}
          {d.status === 'suspended' && <Notice kind="error">Your creator account is turned off. Contact Us In It for help.</Notice>}
          {err && <Notice kind="error">{err}</Notice>}
          {ok && <Notice kind="ok">{ok}</Notice>}
          {d.status === 'approved' && (
            <>
              <div className="card space-y-2">
                <p className="muted text-sm">Your earnings</p>
                <p className="text-3xl font-extrabold">{money(d.balance_cents)}</p>
                {d.pending_cashout ? <p className="text-sm font-bold">Cash-out of {money(d.pending_cashout)} requested.</p>
                  : <button className="text-sm font-bold underline" disabled={d.balance_cents < d.min_cashout_cents} onClick={() => run('creator_request_cashout', {}, 'Cash-out requested.')}>No bank or debit card? Ask Us In It to pay you by hand (from {money(d.min_cashout_cents)})</button>}
              </div>
              <StripePayouts kind="creator" />
              <div className="card space-y-3">
                <h2 className="h2">Your own code</h2>
                <p className="muted text-sm">Put this on your screen. Viewers who scan it see a short business message, and you earn $0.20 per scan (one per phone per day). The page tells viewers: "This code supports {d.name}, the creator."</p>
                <p className="font-bold">{d.own.scans_today} scans today · {d.own.scans_total} total · you earned {money(d.own.earned_cents)}</p>
                <ScreenQR code={d.own_code} label={d.name} />
              </div>
              <div className="card space-y-3">
                <h2 className="h2">Share a holder's code</h2>
                <p className="muted text-sm">Help someone in hard times: share their code with your viewers. The holder gets $0.20 per scan. You choose: keep a $0.02 cut, or give it to them too.</p>
                <div className="flex gap-2">
                  <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Pick a holder…</option>{dir.map((x) => <option key={x.code} value={x.code}>{x.first_name} #{x.code}{x.general_area ? ` · ${x.general_area}` : ''}</option>)}</select>
                  <button className="btn-orange shrink-0" disabled={!pick} onClick={() => run('creator_add_collab', { p_holder_code: pick }, 'Code ready below.')}>Get code</button>
                </div>
                {d.collabs.map((c) => (
                  <div key={c.id} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                    <p className="font-bold">{c.first_name} #{c.holder_code} · {c.scans_total} scans · {c.first_name} earned {money(c.holder_cents)}{c.creator_cents ? ` · you earned ${money(c.creator_cents)}` : ''}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className={c.keep_cut ? 'btn-black' : 'btn-outline'} onClick={() => run('creator_set_cut', { p_collab: c.id, p_keep: true })}>Keep my $0.02</button>
                      <button className={!c.keep_cut ? 'btn-black' : 'btn-outline'} onClick={() => run('creator_set_cut', { p_collab: c.id, p_keep: false })}>Give it to {c.first_name}</button>
                    </div>
                    <ScreenQR code={c.code} label={`${c.first_name}-collab`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ================= Admin: Creators tab =================
export function AdminCreators() {
  const [d, setD] = useState(null)
  const load = () => supabase.rpc('admin_creators').then(({ data }) => setD(data))
  useEffect(() => { load() }, [])
  async function run(fn, args) { await supabase.rpc(fn, args); load() }
  if (!d) return <Spinner />
  return (
    <div className="space-y-6">
      <p className="muted">Digital scans: online viewers scan creator codes or holders' online codes. Paid only by businesses that turned on digital scans ($0.25 per scan; holder $0.20, creator $0.02 cut or $0.20 for their own code). One paid scan per phone per code per day; max 200 paid scans per code per day. Never the Community Fund.</p>
      <div className="space-y-3">
        <h2 className="h2">Creators</h2>
        {d.creators.length === 0 && <p className="muted">None yet.</p>}
        {d.creators.map((c) => (
          <div key={c.id} className="card space-y-1">
            <p className="font-bold">{c.name} <span className="pill ml-1 bg-neutral-200 text-neutral-800">{c.status}</span></p>
            <p className="text-sm">{c.email}{c.links ? ` · ${c.links}` : ''}{c.own_code ? ` · code ${c.own_code}` : ''} · {c.scans} scans · balance {money(c.balance_cents)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {c.status !== 'approved' && <button className="btn-orange py-2" onClick={() => run('admin_set_creator', { p_id: c.id, p_status: 'approved' })}>Approve</button>}
              {c.status === 'pending' && <button className="btn-outline py-2" onClick={() => run('admin_set_creator', { p_id: c.id, p_status: 'rejected' })}>Reject</button>}
              {c.status === 'approved' && <button className="btn-outline py-2" onClick={() => run('admin_set_creator', { p_id: c.id, p_status: 'suspended' })}>Suspend</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">Creator cash-outs</h2>
        {d.cashouts.length === 0 && <p className="muted">None yet.</p>}
        {d.cashouts.map((x) => (
          <div key={x.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span><b>{x.name}</b> · {money(x.amount_cents)} · {x.status}</span>
            {x.status === 'pending' && <span className="flex gap-2">
              <button className="btn-orange py-2" onClick={() => { const m = prompt('How did you pay them?'); if (m) run('admin_creator_cashout', { p_id: x.id, p_paid: true, p_method: m }) }}>Mark paid</button>
              <button className="btn-outline py-2" onClick={() => run('admin_creator_cashout', { p_id: x.id, p_paid: false })}>Reject</button>
            </span>}
          </div>
        ))}
      </div>
    </div>
  )
}
