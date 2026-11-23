import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, useSession, SITE_URL } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import Printables from './Printables'
import StripePayouts from './StripePayouts'

// Starter accounts: QR codes printed ahead of time. The first person to scan one claims it
// with their name + a verified email. Phone and payout info are optional.

const KEY = 'usinit_starter_claim'

export function ClaimPage() {
  const { code } = useParams()
  const nav = useNavigate()
  const session = useSession()
  const [s, setS] = useState(null)
  const [f, setF] = useState({ name: '', email: '', phone: '', pay: '', handle: '', agree: false })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(null)
  const load = () => supabase.rpc('get_starter', { p_code: code }).then(({ data }) => setS(data || { status: 'none' }))
  useEffect(() => { load() }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the email link logs them in, finish the claim.
  useEffect(() => {
    if (!session || !s || !['reserved', 'claimed'].includes(s.status) || done) return
    supabase.rpc('finish_starter_claim', { p_code: code }).then(({ data, error }) => {
      if (error) { if (s.status === 'claimed') nav(`/s/${code}`, { replace: true }); else setErr(error.message) }
      else { setDone(data); setPwDone(!!session.user?.user_metadata?.pw_set); try { localStorage.removeItem(KEY) } catch { /* off */ } }
    })
  }, [session, s]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (s?.status === 'none' || (s?.status === 'claimed' && !done && session === null)) nav(`/s/${code}`, { replace: true }) }, [s, session]) // eslint-disable-line react-hooks/exhaustive-deps
  const [pwDone, setPwDone] = useState(false)
  const [pw, setPw] = useState({ a: '', b: '' })
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

  const [wait, setWait] = useState(0)
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t) }, [wait])
  async function sendLink(email) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/claim/${code}`, shouldCreateUser: true } })
    if (error) {
      const m = /after (\d+) seconds?/.exec(error.message || '')
      if (m) { setWait(Number(m[1])); throw new Error('We just sent you an email. Check your inbox (and your Spam folder) first.') }
      throw error
    }
    setWait(60)
  }

  async function claim(e) {
    e.preventDefault()
    setErr(null); setBusy(true)
    const email = f.email.trim().toLowerCase()
    const { error } = await supabase.rpc('reserve_starter', {
      p_code: code, p_name: f.name, p_email: email, p_phone: f.phone || null,
      p_pay_method: f.pay || null, p_pay_handle: f.pay ? f.handle : null, p_agree: f.agree,
    })
    if (error) { setErr(error.message); setBusy(false); return }
    try { await sendLink(email); localStorage.setItem(KEY, JSON.stringify({ code, email })) } catch (e2) { setErr(e2.message); setBusy(false); return }
    setBusy(false); setSent(email); load()
  }

  async function resend() {
    setErr(null)
    let email = sent
    try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!email && m?.code === code) email = m.email } catch { /* off */ }
    if (!email) return setErr('Type your email in the box again to get a new link.')
    try { await sendLink(email); setSent(email) } catch (e2) { setErr(e2.message) }
  }

  if (!s || session === undefined) return <Spinner />

  if (done && !pwDone) return (
    <form onSubmit={savePw} className="mx-auto max-w-md space-y-4 px-4 py-10">
      <p className="text-center text-5xl">🎉</p>
      <h1 className="h1 text-center">This code is yours!</h1>
      <p className="text-center text-lg">You are holder <b>#{done.code}</b>. Every scan of your sign pays you.</p>
      <div className="card space-y-3">
        <p className="text-xl font-extrabold">Last step: make a password</p>
        <p>You need it to log back in and see your money.</p>
        <label className="block"><span className="label">Password (8 or more letters or numbers)</span>
          <input className="input text-lg" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></label>
        <label className="block"><span className="label">Type it again</span>
          <input className="input text-lg" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></label>
        {err && <Notice kind="error">{err}</Notice>}
        <button type="submit" className="btn-orange w-full py-4 text-lg" disabled={busy}>{busy ? 'Saving…' : 'Save my password'}</button>
      </div>
    </form>
  )

  if (done) return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <p className="text-center text-lg font-bold">✅ Password saved. You’re all set, holder #{done.code}.</p>
      <p className="font-bold">Optional: have an ID and a debit card or bank account? Set up direct pay now. No ID? Skip this. Cash App or Venmo works.</p>
      <StripePayouts kind="holder" title="Get paid to a debit card or bank" />
      <Link to="/holder" className="btn-black block w-full py-4 text-center text-lg">Skip for now. Go to my account</Link>
    </div>
  )

  if (s.status === 'reserved') return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="h1">📧 Check your email</h1>
      <p className="text-lg">We sent a link to <b>{sent || s.email_hint}</b>.</p>
      <ol className="list-decimal space-y-1 pl-5 text-lg">
        <li>Open your email on this phone.</li>
        <li>Find the email from Us In It.</li>
        <li>Tap the link inside it.</li>
      </ol>
      <p>Then this code is yours. Nobody else can claim it while you finish.</p>
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-outline w-full py-3" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Send again in ${wait} seconds` : 'Send the email again'}</button>
      <p className="muted text-sm">Not your email? Ask the person who gave you this sheet.</p>
    </div>
  )

  return (
    <form onSubmit={claim} className="mx-auto max-w-md space-y-4 px-4 py-8">
      <h1 className="h1">Claim this code</h1>
      <p className="text-lg">Once it’s yours, every scan of this sign pays you.</p>
      <label className="block"><span className="label">Your first name *</span>
        <input className="input text-lg" maxLength={40} autoComplete="given-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block"><span className="label">Your email *</span>
        <input className="input text-lg" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <span className="muted text-sm">We send a link here. You must tap it to finish.</span></label>
      <label className="block"><span className="label">Phone number (optional)</span>
        <input className="input text-lg" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <div>
        <p className="label">How do you want to get paid? (optional)</p>
        <div className="grid grid-cols-3 gap-2">
          {[['cashapp', 'Cash App'], ['venmo', 'Venmo'], ['', 'Later']].map(([k, l]) => (
            <button key={l} type="button" onClick={() => setF({ ...f, pay: k })} className={`rounded-xl border-2 py-3 font-bold ${f.pay === k ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>{l}</button>
          ))}
        </div>
        {f.pay && <input className="input mt-2 text-lg" autoCapitalize="none" placeholder={f.pay === 'cashapp' ? '$cashtag' : 'Venmo username'} value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} />}
        <p className="muted mt-1 text-sm">You can also set up a debit card later in your account.</p>
      </div>
      <label className="flex items-start gap-3 text-lg">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-[#FF6A00]" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
        <span>I agree to the <a href="/holder-agreement" target="_blank" rel="noreferrer" className="font-bold underline">Holder Agreement</a>.</span>
      </label>
      {err && <Notice kind="error">{err}</Notice>}
      <button type="submit" className="btn-orange w-full py-4 text-lg" disabled={busy}>{busy ? 'Claiming…' : 'Claim this code'}</button>
    </form>
  )
}

// Admin: make, track, free and print starter codes.
export function AdminStarters() {
  const [list, setList] = useState(null)
  const [n, setN] = useState(1)
  const [msg, setMsg] = useState(null)
  const [printing, setPrinting] = useState(null)
  const load = () => supabase.rpc('admin_starters').then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  async function run(fn, args, ok) {
    setMsg(null)
    const { error } = await supabase.rpc(fn, args)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: ok }); load()
  }
  if (printing) return (
    <div>
      <button type="button" className="no-print btn-black mb-4 w-full py-3" onClick={() => setPrinting(null)}>← Back</button>
      <Printables holder={{ holder_code: printing.code, first_name: '' }} />
    </div>
  )
  if (!list) return <Spinner />
  const count = (st) => list.filter((x) => x.status === st).length
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">Starter accounts</h2>
        <p>Print these ahead of time. The first person to scan one claims it with their name and a verified email.</p>
        <p className="font-bold">{count('open')} ready · {count('reserved')} waiting for email · {count('claimed')} claimed</p>
        <div className="flex gap-2">
          <input className="input w-24 text-lg" type="number" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <button type="button" className="btn-orange flex-1 py-3" onClick={() => run('admin_make_starters', { p_n: n }, `Made ${n}.`)}>Make {n} starter {n === 1 ? 'code' : 'codes'}</button>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>
      {list.map((x) => (
        <div key={x.code} className="card space-y-2">
          <p className="text-lg font-extrabold">Account {x.label} · #{x.code}</p>
          {x.status === 'open' && <p>✅ Ready to hand out</p>}
          {x.status === 'reserved' && <p>⏳ Waiting for {x.name} to tap the email link ({x.email})</p>}
          {x.status === 'claimed' && <p>🎉 Claimed by {x.holder_first || x.name}</p>}
          <div className="flex flex-wrap gap-2">
            {x.status !== 'claimed' && <button type="button" className="btn-black py-2" onClick={() => setPrinting(x)}>🖨️ Print sign</button>}
            {x.status === 'reserved' && <button type="button" className="btn-outline py-2" onClick={() => window.confirm(`Free Account ${x.label} so someone else can claim it?`) && run('admin_free_starter', { p_code: x.code }, 'Freed. Anyone can claim it now.')}>Free this code</button>}
            <a className="btn-outline py-2" href={`${SITE_URL}/claim/${x.code}`} target="_blank" rel="noreferrer">Open claim page</a>
          </div>
        </div>
      ))}
    </div>
  )
}
