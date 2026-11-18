import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import StripePayouts from './StripePayouts'

const METHODS = [
  ['cashapp', 'Cash App'],
  ['venmo', 'Venmo'],
  ['stripe', 'Bank or debit card'],
]

// Holder cash-out: Cash App or Venmo (sent by Us In It), or Stripe (automatic, needs ID check).
// The amount is always the holder's real balance, figured on our server, never typed by the holder.
export default function HolderCashout() {
  const [d, setD] = useState(undefined)
  const [method, setMethod] = useState('cashapp')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [taxStop, setTaxStop] = useState(false)
  const load = () => supabase.rpc('my_cashout_info').then(({ data }) => {
    setD(data ?? null)
    if (data?.pay_method) { setMethod(data.pay_method); setHandle(data.pay_handle || '') }
  })
  useEffect(() => { load() }, [])

  async function cashOut() {
    setErr(null); setTaxStop(false); setBusy(true)
    const { error } = await supabase.rpc('request_cashout', { p_method: method, p_handle: handle })
    if (error) {
      if (error.message.includes('TAX_FORM_NEEDED')) setTaxStop(true)
      else if (!error.message.includes('CASHOUTS_PAUSED')) setErr(error.message)
    }
    setBusy(false); load()
  }
  async function cancel(id) {
    if (!confirm('Cancel this cash-out? The money goes back on your balance.')) return
    const { error } = await supabase.rpc('cancel_my_cashout', { p_req: id })
    setErr(error?.message || null); load()
  }

  if (d === undefined) return <div className="card"><Spinner /></div>
  if (!d) return null
  const open = d.recent.find((r) => r.status === 'waiting' || r.status === 'review')
  const can = d.balance_cents >= d.min_cents
  const nearTax = !d.tax_form_on_file && d.year_paid_cents >= d.tax_warn_cents
  const appName = method === 'venmo' ? 'Venmo' : 'Cash App'

  return (
    <div className="card space-y-3">
      <h2 className="h2">Cash out</h2>
      <p className="text-2xl font-extrabold">{money(d.balance_cents)} <span className="muted text-sm font-normal">ready to cash out</span></p>

      {!open && d.cashouts_open === false ? (
        <div className="space-y-2 rounded-xl border-2 border-orange p-3">
          <p className="font-extrabold">Cash-outs are paused for now</p>
          <p className="text-sm">Your money is safe and stays on your balance. You keep earning from every scan. Cash-outs open again when the Community Fund reaches {money(d.resume_cents)}.</p>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 bg-orange" style={{ width: `${Math.min(100, Math.round((Math.max(0, d.fund_cents) / d.resume_cents) * 100))}%` }} /></div>
          <p className="muted text-xs">Community Fund: {money(Math.max(0, d.fund_cents))} of {money(d.resume_cents)}</p>
        </div>
      ) : open ? (
        <div className="space-y-2 rounded-xl bg-orange/15 p-3">
          <p className="font-extrabold">⏳ {money(open.amount_cents)} is on its way to {open.handle}</p>
          <p className="text-sm">Us In It sends it to your {open.method === 'venmo' ? 'Venmo' : 'Cash App'} by hand. You'll see it there soon.</p>
          {open.status === 'waiting' && <button className="text-sm font-bold underline" onClick={() => cancel(open.id)}>Cancel this cash-out</button>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setMethod(id); setErr(null) }}
                className={`rounded-xl px-2 py-3 text-sm font-bold ${method === id ? 'bg-orange text-black' : 'border border-neutral-300'}`}>{label}</button>
            ))}
          </div>

          {method === 'stripe' ? (
            <StripePayouts kind="holder" title="Bank or debit card" />
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-bold">Your {appName} {method === 'venmo' ? 'username' : '$cashtag'}</span>
                <input className="input mt-1" autoCapitalize="none" autoCorrect="off" spellCheck="false"
                  placeholder={method === 'venmo' ? '@Your-Name' : '$YourName'} value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/\s/g, ''))} />
              </label>
              <p className="muted text-xs">Check it twice. Money sent to the wrong {method === 'venmo' ? 'username' : '$cashtag'} can't be brought back.</p>
              {nearTax && <Notice>You've been paid {money(d.year_paid_cents)} this year. At {money(d.tax_cap_cents)} we need a tax form (W-9) from you before we can pay you more.</Notice>}
              <button className="btn-orange w-full py-4 text-lg" disabled={busy || !can || handle.length < 2} onClick={cashOut}>
                {busy ? 'Sending…' : can ? `Cash out ${money(d.balance_cents)} to ${appName}` : `Cash out (from ${money(d.min_cents)})`}
              </button>
            </>
          )}
        </>
      )}

      {taxStop && (
        <div className="space-y-2 rounded-xl border-2 border-orange p-3">
          <p className="font-extrabold">We need a tax form first</p>
          <p className="text-sm">You've earned close to {money(d.tax_cap_cents)} this year. The law says we need a tax form (W-9) from you before we can pay you more. Your money is safe and stays on your balance.</p>
          <Link className="btn-black w-full" to="/contact">Message Us In It to fill it out</Link>
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}

      {d.recent.length > 0 && (
        <div>
          <p className="text-sm font-bold">Your cash-outs</p>
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
            {d.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>{new Date(r.created_at).toLocaleDateString()} · {money(r.amount_cents)} · {r.handle}</span>
                <span className={r.status === 'paid' ? 'font-bold text-green-700 dark:text-green-400' : 'muted'}>
                  {r.status === 'paid' ? 'Sent ✅' : r.status === 'canceled' ? 'Canceled' : 'On its way'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted text-xs">No Cash App or Venmo? Ask Us In It or your partner organization to pay you by hand.</p>
    </div>
  )
}
