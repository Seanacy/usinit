import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deviceId, supabase } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'

// Coupons: a business can put an optional deal on its ad. Scanners save it, show it at the counter,
// and staff redeem it once with the store's 4-digit PIN. Saved codes are kept on this phone.
const KEY = 'usinit_coupons'
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const remember = (code) => { try { const l = saved().filter((c) => c !== code); l.unshift(code); localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))) } catch { /* storage off */ } }

// Shown under an ad on the scan screen when the ad has a deal.
export function CouponOffer({ adId, scanId }) {
  const [c, setC] = useState(null)
  const [code, setCode] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (adId) supabase.rpc('ad_coupon', { p_ad: adId }).then(({ data }) => setC(data || null)) }, [adId])
  if (!c) return null
  async function save() {
    setErr(null); setBusy(true)
    const { data, error } = await supabase.rpc('claim_coupon', { p_ad: adId, p_scan: scanId || null, p_device: deviceId() })
    setBusy(false)
    if (error) return setErr(error.message)
    remember(data.code); setCode(data.code)
  }
  return (
    <div className="mx-4 mb-4 rounded-xl border-2 border-dashed border-orange bg-orange/10 p-4">
      <p className="text-xs font-bold tracking-wide text-orange">🎟️ DEAL FROM {String(c.business || '').toUpperCase()}</p>
      <p className="mt-1 text-2xl font-extrabold">{c.text}</p>
      {c.terms && <p className="muted mt-1 text-sm">{c.terms}</p>}
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      {code ? (
        <div className="mt-3 space-y-2">
          <p className="font-bold">✅ Saved! Good for {c.days} day{c.days === 1 ? '' : 's'}. Show it at the counter.</p>
          <a href={`/c/${code}`} target="_blank" rel="noopener noreferrer" className="btn-orange block w-full text-center">Open my coupon</a>
          <p className="muted text-xs">Find it later anytime at usinit.com/coupons on this phone.</p>
        </div>
      ) : (
        <button className="btn-orange mt-3 w-full py-3" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save my coupon'}</button>
      )}
    </div>
  )
}

// usinit.com/c/CODE — the coupon the customer shows. Staff tap Redeem and type the store PIN.
export default function CouponPage() {
  const { code } = useParams()
  const [c, setC] = useState(undefined)
  const [pin, setPin] = useState('')
  const [staff, setStaff] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => supabase.rpc('get_coupon', { p_code: code }).then(({ data }) => setC(data || null))
  useEffect(() => { load(); remember(String(code).toUpperCase()) }, [code]) // eslint-disable-line
  if (c === undefined) return <Spinner />
  if (!c) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">Coupon not found.</p></div>
  const used = !!c.redeemed_at, dead = used || c.expired || c.locked
  async function redeem() {
    setMsg(null); setBusy(true)
    const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code, p_pin: pin })
    setBusy(false); setPin('')
    if (error) return setMsg({ kind: 'error', text: error.message })
    if (!data.ok) return setMsg({ kind: 'error', text: data.error })
    setMsg({ kind: 'ok', text: 'Redeemed! ✅ Thank you.' }); setStaff(false); load()
  }
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className={`rounded-2xl border-4 border-dashed p-6 text-center ${dead ? 'border-neutral-300 opacity-70' : 'border-orange bg-orange/10'}`}>
        <p className="text-sm font-bold tracking-wide text-orange">🎟️ US IN IT DEAL</p>
        <p className="mt-1 text-lg font-bold">{c.business}</p>
        <p className="mt-3 text-4xl font-black leading-tight">{c.text}</p>
        {c.terms && <p className="muted mt-3">{c.terms}</p>}
        <p className="mt-4 font-mono text-2xl font-bold tracking-widest">{c.code}</p>
        <p className="mt-2 text-sm">
          {used ? `✅ Used ${new Date(c.redeemed_at).toLocaleString()}` : c.expired ? '⌛ Expired' : c.locked ? '🔒 Locked' : `Good until ${new Date(c.expires_at).toLocaleDateString()}`}
        </p>
      </div>
      {msg && <Notice kind={msg.kind === 'ok' ? undefined : 'error'}>{msg.text}</Notice>}
      {!dead && (
        <div className="card space-y-3">
          <p className="font-bold">Show this screen at the counter.</p>
          {!staff ? (
            <button className="btn-black w-full py-4 text-lg" onClick={() => setStaff(true)}>For staff: Redeem</button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm"><b>Staff only:</b> type your store's 4-digit PIN to use this coupon. It only works once.</p>
              <input className="input text-center text-3xl tracking-[0.5em]" inputMode="numeric" maxLength={4} value={pin} autoFocus
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && redeem()} aria-label="Store PIN" />
              <button className="btn-orange w-full py-4 text-lg" onClick={redeem} disabled={busy || pin.length !== 4}>{busy ? 'Checking…' : 'Redeem'}</button>
              <button className="w-full text-sm underline" onClick={() => setStaff(false)}>Cancel</button>
            </div>
          )}
          {!c.has_pin && <p className="muted text-xs">This business hasn't set its store PIN yet.</p>}
        </div>
      )}
      <p className="text-center text-sm"><Link to="/coupons" className="underline">My saved coupons</Link></p>
    </div>
  )
}

// usinit.com/coupons — coupons saved on this phone.
export function MyCoupons() {
  const [list, setList] = useState(null)
  useEffect(() => {
    const codes = saved()
    Promise.all(codes.map((code) => supabase.rpc('get_coupon', { p_code: code }).then(({ data }) => data))).then((r) => setList(r.filter(Boolean)))
  }, [])
  if (!list) return <Spinner />
  const open = list.filter((c) => !c.redeemed_at && !c.expired && !c.locked)
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-8">
      <h1 className="h1">My coupons</h1>
      <p className="muted">Deals you saved from scans on this phone.</p>
      {list.length === 0 && <p>No coupons yet. When a scan shows a 🎟️ deal, tap "Save my coupon."</p>}
      {list.map((c) => {
        const live = open.includes(c)
        return (
          <Link key={c.code} to={`/c/${c.code}`} className={`block rounded-xl border-2 p-4 ${live ? 'border-orange' : 'border-neutral-300 opacity-60'}`}>
            <p className="text-xs font-bold text-orange">{c.business}</p>
            <p className="text-xl font-extrabold">{c.text}</p>
            <p className="muted text-sm">{c.redeemed_at ? 'Used' : c.expired ? 'Expired' : c.locked ? 'Locked' : `Good until ${new Date(c.expires_at).toLocaleDateString()}`}</p>
          </Link>
        )
      })}
    </div>
  )
}
