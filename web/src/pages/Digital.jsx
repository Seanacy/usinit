import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SITE_URL, deviceId, money, startCheckout, supabase, useSession, useStats } from '../lib/supabase'
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
  const nav = useNavigate()
  const [r, setR] = useState(undefined)
  useEffect(() => {
    // One code per holder: old holder online links (H...) forward to the holder's one code
    if (/^h/i.test(code || '')) {
      supabase.rpc('holder_code_for_digital', { p_code: code }).then(({ data }) => {
        if (data) nav(`/s/${data}`, { replace: true }); else setR({ error: 'not_found' })
      })
      return
    }
    const geo = fetch('/api/geo').then((r) => r.json()).then((j) => j.token || null).catch(() => null)
    geo.then((p_geo) => supabase.rpc('process_digital_scan', { p_code: code, p_device: deviceId(), p_geo })).then(({ data }) => {
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
  if (!d) return null
  return (
    <div className="card space-y-2">
      <h2 className="h2">Share your code online too</h2>
      <p className="muted text-sm">Your one code works everywhere: on your sign, in a post, or on a livestream. Use the same QR or link from the top of this page. Scans from far away or without location are paid by online ads. ({d.scans_today} online scans today · {d.scans_total} total)</p>
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
      <p className="muted">Put a code on your videos, posts, or livestreams. Viewers scan it and see a short message from a business. You get paid for your own code, and you can also share holders' codes to help them. Once you're approved, you can also turn on a gift code: earn $1 every time a follower gives $3.</p>
      <input className="input" maxLength={60} placeholder="The name viewers know you by" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" maxLength={300} placeholder="Your channel or profile links" value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full">Send for approval</button>
    </form>
  )
}

export const giftUrl = (code) => `${SITE_URL}/g/${code}`

// ================= Creator: $3 gift code (opt-in) =================
function GiftCodeCard({ d, onDone }) {
  const g = d.gift || {}
  const give = g.give_cents ?? 300, mine = g.creator_cents ?? 100, fund = give - mine
  const [open, setOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function turnOn() {
    setErr(null); setBusy(true)
    const { error } = await supabase.rpc('creator_turn_on_gift', { p_agree: agree })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  if (!g.code) return (
    <div className="card space-y-3 border-2 border-orange bg-orange/10">
      <h2 className="h2">Raise money for your city. Earn {money(mine)} per gift.</h2>
      <p>Followers give {money(give)}. {money(fund)} goes to the Us In It Community Fund. You get {money(mine)}.</p>
      {!open ? <button className="btn-orange w-full" onClick={() => setOpen(true)}>Turn on my gift code</button> : (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I'll tell my followers I get {money(mine)} from each gift, in every post that shares this code (like "#ad, I get {money(mine)} of each gift").</span>
          </label>
          <button className="btn-black w-full" disabled={!agree || busy} onClick={turnOn}>{busy ? 'Making your code…' : 'Get my code'}</button>
          <p className="muted text-xs">The law (FTC) says followers must know when you get paid. Never say gifts are tax-deductible: Us In It is a business, not a charity.</p>
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}
    </div>
  )
  return (
    <div className="card space-y-3 border-2 border-orange">
      <h2 className="h2">Your gift code</h2>
      <p className="muted text-sm">Put this in a post, video, or your bio. Followers who scan it can give {money(give)}: {money(fund)} to the Community Fund, {money(mine)} to you. Always tell them you get {money(mine)} of each gift.</p>
      <p className="font-bold">{g.gifts} gift{g.gifts === 1 ? '' : 's'} · {money(g.fund_cents)} to the Community Fund · you earned {money(g.earned_cents)}</p>
      <GiftQR code={g.code} name={d.name} give={give} />
    </div>
  )
}

function GiftQR({ code, name, give }) {
  const url = giftUrl(code)
  const qr = useQR(url)
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col items-center gap-2">
      {qr && <img src={qr} alt={`Gift QR code for ${url}`} className="h-44 w-44 rounded-lg border border-neutral-200" />}
      <p className="text-sm font-bold">Scan to give {money(give)}</p>
      <p className="break-all text-xs">{url}</p>
      <div className="flex gap-2">
        <button className="btn-outline py-2" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied!' : 'Copy link'}</button>
        {qr && <a className="btn-black py-2" href={qr} download={`${name}-gift-qr.png`}>Download QR</a>}
      </div>
    </div>
  )
}

// ================= Gift code page: /g/:code =================
export function CreatorGive() {
  const { code } = useParams()
  const stats = useStats()
  const [g, setG] = useState(undefined)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { supabase.rpc('get_creator_gift', { p_code: code }).then(({ data }) => setG(data ?? null)) }, [code])
  if (g === undefined) return <Spinner />
  if (!g) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">We couldn't find that gift code.</h1></div>
  if (!g.on) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">This gift code is paused right now.</p><Link to="/fund" className="mt-4 inline-block font-bold underline">Give to the Community Fund instead</Link></div>
  const give = g.give_cents, mine = g.creator_cents, fund = give - mine
  const s = stats?.settings || {}
  const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30)
  const total = Math.ceil((give + fixed) / (1 - pct))
  async function start() {
    setErr(null); setBusy(true)
    try { await startCheckout({ code }, 'creator-give') } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <div>
        <p className="font-bold text-orange">Shared by {g.name}</p>
        <h1 className="h1">Give {money(give)}. Help pay people in hard times in Minneapolis.</h1>
        <p className="mt-3 text-lg">Your {money(give)} is split two ways:</p>
        <ul className="mt-2 space-y-2 text-lg">
          <li>💸 <b>{money(fund)}</b> goes to the Us In It Community Fund. It pays people holding Us In It QR codes for every scan.</li>
          <li>🙌 <b>{money(mine)}</b> goes to {g.name} for sharing this code.</li>
        </ul>
      </div>
      <div className="card space-y-3">
        <p className="text-sm">{money(give)} + card fee {money(total - give)} = <b>{money(total)}</b>. Not tax-deductible.</p>
        <button className="btn-orange w-full py-4 text-lg" onClick={start} disabled={busy}>{busy ? 'Opening checkout…' : `Give ${money(give)}`}</button>
        {err && <Notice kind="error">{err}</Notice>}
      </div>
      {g.gifts > 0 && <p className="text-center font-bold">{g.name}'s followers have given {money(g.fund_cents)} to the Community Fund so far.</p>}
      <p className="muted text-xs">Us In It is a business, not a charity. Gifts are not tax-deductible. <Link to="/how" className="underline">How Us In It works</Link></p>
    </div>
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
              <GiftCodeCard d={d} onDone={load} />
              <div className="card space-y-3">
                <h2 className="h2">Your own code</h2>
                <p className="muted text-sm">Put this on your screen. Viewers who scan it see a short business message, and you earn $0.04 per scan (one per phone per day, up to 2,000 paid scans a day). The page tells viewers: "This code supports {d.name}, the creator."</p>
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
      <p className="muted">Digital scans: online viewers scan creator codes or holders' online codes. Paid only by businesses that turned on digital scans. Holder online codes and collabs: $0.25 per scan (holder $0.20, creator $0.02 cut). Creator's own code: $0.05 per scan (creator $0.04, Us In It $0.01). One paid scan per phone per code per day; max 200 paid scans per holder or collab code a day, 2,000 per creator code. Never the Community Fund.</p>
      {d.gift_totals && <div className="card"><p className="font-bold">Creator gift codes ($3: $2 to the Community Fund, $1 to the creator)</p><p className="text-sm">{d.gift_totals.gifts} gifts · {money(d.gift_totals.fund_cents)} to the fund · {money(d.gift_totals.creator_cents)} to creators</p></div>}
      <div className="space-y-3">
        <h2 className="h2">Creators</h2>
        {d.creators.length === 0 && <p className="muted">None yet.</p>}
        {d.creators.map((c) => (
          <div key={c.id} className="card space-y-1">
            <p className="font-bold">{c.name} <span className="pill ml-1 bg-neutral-200 text-neutral-800">{c.status}</span></p>
            <p className="text-sm">{c.email}{c.links ? ` · ${c.links}` : ''}{c.own_code ? ` · code ${c.own_code}` : ''} · {c.scans} scans · balance {money(c.balance_cents)}</p>
            {c.gift_code && <p className="text-sm">Gift code {c.gift_code} · {c.gifts} gift{c.gifts === 1 ? '' : 's'} · {money(c.gift_fund_cents)} to the fund · {money(c.gift_creator_cents)} to them</p>}
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
