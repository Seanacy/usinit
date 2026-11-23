import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { money, supabase, useSession, SITE_URL, IS_FINAL_DOMAIN } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import { GROUPS, fee, PlugMoneyBox } from './Referrals'

// Starter business accounts: a pre-printed sheet. The shop owner scans it, signs up and sets up
// The Plug in one go (approved right away, since only Us In It hands these out).
// After that, the same sheet is the shop's counter sign: it lists the partner deals the shop carries.

const KEY = 'usinit_shop_claim'
// Same address as the printed sheets, so the QR on screen matches the paper exactly.
const SHOP_BASE = IS_FINAL_DOMAIN ? 'https://usinit.com' : SITE_URL
const PAYS = [200, 500, 1000]
const walk = (m) => (m == null ? '' : m < 120 ? '🚶 Next door' : m < 1609 ? `🚶 ${Math.max(1, Math.round(m / 80))} min walk` : `${(m / 1609).toFixed(1)} mi away`)

export function ShopPage() {
  const { code: raw } = useParams()
  const code = String(raw || '').toUpperCase()
  const session = useSession()
  const [s, setS] = useState(null)
  const [f, setF] = useState({ business: '', contact: '', email: '', phone: '', address: '', group: '', category: '', discount: '', terms: '', pay: 500, other: '', agree: false })
  const [err, setErr] = useState(null)
  const [note, setNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(null)
  const [pwDone, setPwDone] = useState(false)
  const [pw, setPw] = useState({ a: '', b: '' })
  const [pinDone, setPinDone] = useState(false)
  const [pin, setPin] = useState({ a: '', b: '' })
  const [wait, setWait] = useState(0)
  const load = () => supabase.rpc('shop_counter', { p_code: code }).then(({ data }) => setS(data || { status: 'none' }))
  useEffect(() => { load() }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t) }, [wait])

  // After the email link logs them in, finish the claim (also resumes on reload).
  useEffect(() => {
    if (!session || !s || done) return
    if (!(s.status === 'reserved' || (s.status === 'claimed' && s.is_me))) return
    supabase.rpc('finish_biz_starter', { p_code: code }).then(({ data, error }) => {
      if (error) { if (s.status === 'reserved') { if (['Log in first.', 'Tap the link in your email first.'].includes(error.message)) setNote(true); else setErr(error.message) } return }
      setDone(data); setPwDone(!!session.user?.user_metadata?.pw_set); setPinDone(!!data?.has_pin)
      try { localStorage.removeItem(KEY) } catch { /* off */ }
    })
  }, [session, s]) // eslint-disable-line react-hooks/exhaustive-deps

  async function sendLink(email) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/shop/${code}`, shouldCreateUser: true } })
    if (error) {
      const m = /after (\d+) seconds?/.exec(error.message || '')
      if (m) { setWait(Number(m[1])); throw new Error('We just sent you an email. Check your inbox (and your Spam folder) first.') }
      throw error
    }
    setWait(60)
  }
  const cents = f.pay === 'other' ? Math.round(Number(f.other) * 100) || 0 : f.pay

  async function claim(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const email = f.email.trim().toLowerCase()
    const hasDeal = f.discount.trim().length > 0
    if (hasDeal && f.discount.trim().length < 3) { setBusy(false); return setErr('Write a little more about the deal, like "$6 off".') }
    const { error } = await supabase.rpc('reserve_biz_starter', {
      p_code: code, p_business: f.business, p_contact: f.contact, p_email: email, p_phone: f.phone,
      p_address: f.address, p_category: f.category, p_discount: hasDeal ? f.discount : null, p_terms: hasDeal ? f.terms : null,
      p_payout_cents: hasDeal ? cents : null, p_agree: f.agree,
    })
    if (error) { setErr(error.message); setBusy(false); return }
    try { await sendLink(email); localStorage.setItem(KEY, JSON.stringify({ code, email })) } catch (e2) { setErr(e2.message); setBusy(false); return }
    setBusy(false); setSent(email); load()
  }
  async function resend() {
    setErr(null)
    let email = sent
    try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!email && m?.code === code) email = m.email } catch { /* off */ }
    if (!email) return setErr('Ask Us In It to free this code so you can start again.')
    try { await sendLink(email); setSent(email) } catch (e2) { setErr(e2.message) }
  }
  async function savePin(e) {
    e.preventDefault(); setErr(null)
    if (!/^[0-9]{4}$/.test(pin.a)) return setErr('Your PIN must be 4 numbers.')
    if (pin.a !== pin.b) return setErr('The two PINs don’t match. Type them again.')
    setBusy(true)
    const { error } = await supabase.rpc('set_redeem_pin', { p_pin: pin.a })
    setBusy(false)
    if (error) return setErr(error.message)
    setPinDone(true); window.scrollTo({ top: 0 })
  }
  async function savePw(e) {
    e.preventDefault(); setErr(null)
    if (pw.a.length < 8) return setErr('Your password needs at least 8 characters.')
    if (pw.a !== pw.b) return setErr('The two passwords don’t match. Type them again.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw.a, data: { pw_set: true } })
    setBusy(false)
    if (error) return setErr(error.message)
    setPwDone(true); window.scrollTo({ top: 0 })
  }

  if (!s || session === undefined) return <Spinner />
  if (s.status === 'none') return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">This code wasn’t found.</p></div>

  if (done && !pwDone) return (
    <form onSubmit={savePw} className="mx-auto max-w-md space-y-4 px-4 py-10">
      <p className="text-center text-5xl">🎉</p>
      <h1 className="h1 text-center">{done.business} is on Us In It!</h1>
      <p className="text-center text-lg">Your business account is approved and The Plug is turned on.</p>
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">Make a password</p>
        <p>You need it to log back in.</p>
        <label className="block"><span className="label">Password (8 or more letters or numbers)</span>
          <input className="input text-lg" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></label>
        <label className="block"><span className="label">Type it again</span>
          <input className="input text-lg" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></label>
        {err && <Notice kind="error">{err}</Notice>}
        <button type="submit" className="btn-orange w-full py-4 text-lg" disabled={busy}>{busy ? 'Saving…' : 'Save my password'}</button>
      </div>
    </form>
  )

  if (done && !pinDone) return (
    <form onSubmit={savePin} className="mx-auto max-w-md space-y-4 px-4 py-10">
      <p className="text-center text-lg font-bold">✅ Password saved.</p>
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">Last step: make your 4-digit store PIN</p>
        <p>When a customer shows a deal from another shop’s QR code, your cashier types this PIN to confirm the sale. Share it only with your staff.</p>
        <label className="block"><span className="label">Store PIN (4 numbers)</span>
          <input className="input text-center text-3xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value.replace(/[^0-9]/g, '') })} /></label>
        <label className="block"><span className="label">Type it again</span>
          <input className="input text-center text-3xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value.replace(/[^0-9]/g, '') })} /></label>
        {err && <Notice kind="error">{err}</Notice>}
        <button type="submit" className="btn-orange w-full py-4 text-lg" disabled={busy}>{busy ? 'Saving…' : 'Save my PIN'}</button>
      </div>
    </form>
  )

  if (done) return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <p className="text-center text-lg font-bold">✅ Password and store PIN saved. You’re all set.</p>
      <CounterSignCard code={code} />
      <Notice>Made a deal? It turns on once you have at least $10 of ad money. Add it now or later.</Notice>
      <Link to="/partners" className="btn-orange block w-full py-4 text-center text-lg">🔌 Find shops to partner with</Link>
      <Link to="/advertise?tab=money" className="btn-black block w-full py-4 text-center text-lg">💵 Add ad money (optional)</Link>
      <Link to="/advertise" className="btn-outline block w-full py-3 text-center">Go to my business page</Link>
    </div>
  )

  if (s.status === 'claimed') return <Counter s={s} />

  if (s.status === 'reserved') return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="h1">📧 Check your email</h1>
      <p className="text-lg">We sent a link to <b>{sent || s.email_hint}</b>.</p>
      <ol className="list-decimal space-y-1 pl-5 text-lg">
        <li>Open your email on this phone.</li>
        <li>Find the email from Us In It.</li>
        <li>Tap the link inside it.</li>
      </ol>
      <p>Nobody else can claim this code while you finish.</p>
      {note && <Notice kind="note">📧 Please check your email and tap the link to verify. Then you can finish here.</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-outline w-full py-3" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Send again in ${wait} seconds` : 'Send the email again'}</button>
    </div>
  )

  return (
    <form onSubmit={claim} className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div>
        <h1 className="h1">Set up your shop</h1>
        <p className="text-lg">One page. Your business account and The Plug, done together.</p>
      </div>
      <PlugMoneyBox />
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">1. Your business</p>
        <label className="block"><span className="label">Business name *</span>
          <input className="input text-lg" maxLength={80} value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} /></label>
        <label className="block"><span className="label">Your name (optional)</span>
          <input className="input text-lg" maxLength={60} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
        <label className="block"><span className="label">Email *</span>
          <input className="input text-lg" type="email" inputMode="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <span className="muted text-sm">We send a link here. You must tap it to finish.</span></label>
        <label className="block"><span className="label">Phone (optional)</span>
          <input className="input text-lg" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      </div>
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">2. Where is your shop?</p>
        <input className="input text-lg" placeholder="123 Main St, Minneapolis, MN" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <p className="muted text-sm">Other shops see how far away you are, never your exact address.</p>
        <p className="text-xl font-extrabold">3. What kind of shop? *</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(GROUPS).map((g) => (
            <button key={g} type="button" onClick={() => setF({ ...f, group: g, category: GROUPS[g].length === 1 ? GROUPS[g][0] : '' })}
              className={`rounded-xl border-2 py-3 font-bold ${f.group === g ? 'border-orange bg-orange/15' : 'border-neutral-300 dark:border-neutral-600'}`}>{g}</button>
          ))}
        </div>
        {f.group && GROUPS[f.group].length > 1 && (
          <div className="flex flex-wrap gap-2">
            {GROUPS[f.group].map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, category: c })}
                className={`rounded-full border-2 px-4 py-2 font-bold ${f.category === c ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">4. Your deal (optional)</p>
        <p className="text-sm">So other shops can send you customers. Skip it if you only want to carry other shops’ deals.</p>
        <label className="block"><span className="label">What does a customer get?</span>
          <input className="input text-lg" maxLength={80} placeholder="$10 off any set of tires" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></label>
        {f.discount.trim() && (
          <>
            <p className="font-bold">What do you pay the shop that sent them?</p>
            <div className="grid grid-cols-4 gap-2">
              {PAYS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, pay: c })} className={`rounded-xl border-2 py-3 text-lg font-extrabold ${f.pay === c ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>{money(c).replace('.00', '')}</button>)}
              <button type="button" onClick={() => setF({ ...f, pay: 'other' })} className={`rounded-xl border-2 py-3 font-bold ${f.pay === 'other' ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>Other</button>
            </div>
            {f.pay === 'other' && <input className="input text-lg" inputMode="decimal" placeholder="Amount in dollars, like 7.50" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value.replace(/[^0-9.]/g, '') })} />}
            {cents >= 100 && <p className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">You pay <b>{money(cents + fee(cents))}</b> only when a sent customer buys: {money(cents)} to the shop + {money(fee(cents))} to Us In It. It comes from your ad money.</p>}
            {cents >= 100 && <p className="font-bold">Your deal stays off until you add at least $10 of ad money and set your 4-digit store PIN.</p>}
            <label className="block"><span className="label">Any rules? (optional)</span>
              <input className="input" maxLength={200} placeholder="Spend $50 or more. One per customer." value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></label>
          </>
        )}
      </div>
      <label className="flex items-start gap-3 text-lg">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-[#FF6A00]" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
        <span>I agree to the <a href="/advertiser-agreement" target="_blank" rel="noreferrer" className="font-bold underline">Advertiser Agreement</a>.</span>
      </label>
      {err && <Notice kind="error">{err}</Notice>}
      <button type="submit" className="btn-orange w-full py-4 text-lg" disabled={busy}>{busy ? 'Setting up…' : 'Set up my shop'}</button>
    </form>
  )
}

// The shop's own counter sign: the same QR as the paper they scanned. Shown after setup, with a print button.
export function CounterSignCard({ code }) {
  const url = `${SHOP_BASE}/shop/${code}`
  const [qr, setQr] = useState(null)
  const [printing, setPrinting] = useState(false)
  const [business, setBusiness] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: 'M' }).then(setQr) }, [url])
  useEffect(() => { supabase.rpc('shop_counter', { p_code: code }).then(({ data }) => setBusiness(data?.business || '')) }, [code])
  if (printing) return <ShopSheet x={{ code, label: '', business }} start={printing} onBack={() => setPrinting(false)} />
  return (
    <div className="card space-y-3 text-center">
      <p className="text-xl font-extrabold">🪧 Your counter sign</p>
      <p>This is the same QR code as the paper you scanned. Put that paper by your register. When customers scan it, they see deals from shops you partner with. When they use one, you get paid.</p>
      {qr && <img src={qr} alt="Your counter sign QR code" className="mx-auto w-2/3 rounded-xl border" />}
      <p className="font-bold">🖨️ Print a new copy. Pick a size:</p>
      <div className="grid grid-cols-2 gap-2 text-left">
        {SIZES.map((t) => (
          <button key={t.k} type="button" onClick={() => setPrinting(t.k)} className="rounded-xl border-2 border-neutral-300 p-3 dark:border-neutral-600">
            <span className="block font-extrabold">{t.label}</span><span className="text-sm">{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// What customers see when they scan a claimed shop's counter sign.
function Counter({ s }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-orange">Deals from shops near</p>
        <h1 className="h1">{s.business}</h1>
      </div>
      {s.is_me && <Notice>This is your counter sign. Customers see this page. Add partner shops in <Link to="/partners" className="font-bold underline">The Plug</Link>.</Notice>}
      {!s.deals.length && <div className="card text-center"><p className="text-lg font-bold">No deals here yet.</p><p className="muted">Check back soon.</p></div>}
      {s.deals.map((d) => (
        <Link key={d.code} to={`/r/${d.code}`} className="card block space-y-1">
          <p className="text-xl font-extrabold">{d.business}</p>
          <p className="text-sm">{d.category || 'Shop'}{d.dist_m != null ? ` · ${walk(d.dist_m)}` : ''}</p>
          <p className="text-2xl font-black text-orange">{d.discount}</p>
          {d.terms && <p className="muted text-sm">{d.terms}</p>}
          <p className="font-bold underline">Get this deal →</p>
        </Link>
      ))}
    </div>
  )
}

// Admin: make, track, free and print shop sheets.
export function AdminShopStarters() {
  const [list, setList] = useState(null)
  const [n, setN] = useState(1)
  const [msg, setMsg] = useState(null)
  const [printing, setPrinting] = useState(null)
  const load = () => supabase.rpc('admin_biz_starters').then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  async function run(fn, args, ok) {
    setMsg(null)
    const { error } = await supabase.rpc(fn, args)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: ok }); load()
  }
  if (printing) return <ShopSheet x={printing} onBack={() => setPrinting(null)} />
  if (!list) return <Spinner />
  const count = (st) => list.filter((x) => x.status === st).length
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">Starter shop accounts</h2>
        <p>Hand one to a shop owner. They scan it, set up their business and The Plug together, and they’re approved right away. Then the sheet is their counter sign.</p>
        <p className="font-bold">{count('open')} ready · {count('reserved')} waiting for email · {count('claimed')} claimed</p>
        <div className="flex gap-2">
          <input className="input w-24 text-lg" type="number" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <button type="button" className="btn-orange flex-1 py-3" onClick={() => run('admin_make_biz_starters', { p_n: n }, `Made ${n}.`)}>Make {n} shop {n === 1 ? 'code' : 'codes'}</button>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>
      {list.map((x) => (
        <div key={x.code} className="card space-y-2">
          <p className="text-lg font-extrabold">Shop {x.label} · {x.code}</p>
          {x.status === 'open' && <p>✅ Ready to hand out</p>}
          {x.status === 'reserved' && <p>⏳ Waiting for {x.name} to tap the email link ({x.email})</p>}
          {x.status === 'claimed' && <p>🎉 Claimed by {x.claimed_name || x.name}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-black py-2" onClick={() => setPrinting(x)}>🖨️ Print sheet</button>
            {x.status === 'reserved' && <button type="button" className="btn-outline py-2" onClick={() => window.confirm(`Free Shop ${x.label} so someone else can claim it?`) && run('admin_free_biz_starter', { p_code: x.code }, 'Freed.')}>Free this code</button>}
            <a className="btn-outline py-2" href={`${SITE_URL}/shop/${x.code}`} target="_blank" rel="noreferrer">Open page</a>
          </div>
        </div>
      ))}
    </div>
  )
}

// Print sizes. Smaller sizes fit several copies on one sheet with cut lines.
const SIZES = [
  { k: 'full', label: 'Full page', sub: '8.5 × 11 in · 1 per sheet', w: '7.6in', n: 1, cols: 1, title: 'text-4xl', qr: '7in' },
  { k: 'half', label: 'Half page', sub: '5.5 × 8.5 in · 2 per sheet', w: '7.6in', n: 2, cols: 1, title: 'text-2xl', qr: '3.6in' },
  { k: 'card', label: 'Counter card', sub: '4 × 5 in · 4 per sheet', w: '3.75in', n: 4, cols: 2, title: 'text-lg', qr: '3in' },
  { k: 'mini', label: 'Mini', sub: '2.5 × 3 in · 9 per sheet', w: '2.45in', n: 9, cols: 3, title: 'text-sm', qr: '2in' },
]

function ShopSheet({ x, onBack, start }) {
  const url = `${SHOP_BASE}/shop/${x.code}`
  const [qr, setQr] = useState(null)
  const [size, setSize] = useState(start || 'full')
  useEffect(() => { QRCode.toDataURL(url, { width: 1200, margin: 1, errorCorrectionLevel: 'M' }).then(setQr) }, [url])
  // Picked a size on the counter sign card: open the print window right away.
  useEffect(() => { if (start && qr) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) } }, [qr]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!qr) return <Spinner />
  const z = SIZES.find((t) => t.k === size)
  const foot = x.label ? `New shop? The first scan sets up your account. · Shop ${x.label} · ${x.code}` : `${x.business ? `${x.business} · ` : ''}Us In It · ${x.code}`
  const one = (i) => (
    <div key={i} className={`flex flex-col items-center justify-center bg-white p-2 text-center text-black ${z.n > 1 ? 'border border-dashed border-neutral-400' : ''}`} style={{ width: z.w, breakInside: 'avoid' }}>
      {x.business && <p className={`font-black leading-tight ${z.title}`}>{x.business}</p>}
      <p className={`mt-1 font-black ${x.business ? 'text-base' : z.title}`}>{x.business ? 'Scan for deals from shops nearby.' : 'Scan for deals nearby.'}</p>
      <img src="/logo-print-bw.svg" alt="Us In It" className="mt-1" style={{ width: z.n > 2 ? '30%' : '18%' }} />
      <img src={qr} alt={`QR code for ${url}`} style={{ width: z.qr }} className="mt-1" />
      {z.k !== 'mini' && <p className="mt-1 text-xs">{foot}</p>}
    </div>
  )
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        <p className="font-bold">Pick a size</p>
        <div className="grid grid-cols-2 gap-2">
          {SIZES.map((t) => (
            <button key={t.k} type="button" onClick={() => setSize(t.k)} className={`rounded-xl border-2 p-3 text-left ${size === t.k ? 'border-orange bg-orange/15' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <span className="block font-extrabold">{t.label}</span><span className="text-sm">{t.sub}</span>
            </button>
          ))}
        </div>
        {z.n > 1 && <p className="text-sm">Cut along the dashed lines.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-outline py-3" onClick={onBack}>← Back</button>
          <button type="button" className="btn-orange py-3" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <style>{'@page { size: letter; margin: 0.4in }'}</style>
      <div className="mx-auto grid justify-center gap-0" style={{ gridTemplateColumns: `repeat(${z.cols}, ${z.w})` }}>
        {Array.from({ length: z.n }, (_, i) => one(i))}
      </div>
    </div>
  )
}
