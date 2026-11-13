import { useEffect, useState } from 'react'
import { callConnect, money } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

// Cash out with Stripe (holders, creators, businesses/nonprofits).
// People who can't use Stripe can still be paid by hand by Us In It.
export default function StripePayouts({ kind, title = 'Cash out', handNote }) {
  const [st, setSt] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const load = () => callConnect('status', kind).then(setSt).catch((e) => { setErr(e.message); setSt(null) })
  useEffect(() => { load() }, [kind]) // eslint-disable-line
  async function go(action) {
    setBusy(true); setErr(null); setOk(null)
    try {
      const out = await callConnect(action, kind)
      if (out.url) { window.location.href = out.url; return }
      if (out.ok) setOk(`${money(out.amount_cents)} is on its way. It usually reaches your bank or debit card in 1 to 3 business days.`)
      await load()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  if (st === undefined) return <div className="card"><Spinner /></div>
  return (
    <div className="card space-y-3">
      <h2 className="h2">{title}</h2>
      {st && <p className="text-2xl font-extrabold">{money(st.balance_cents)} <span className="muted text-sm font-normal">ready to cash out</span></p>}
      {st && !st.has_account && (
        <>
          <p className="muted text-sm">Get paid straight to your bank account or debit card (a Cash App or other prepaid debit card works). Stripe, our payment company, asks for your name, birthday, last 4 of your SSN, and address one time. Us In It never sees your card or bank numbers.</p>
          <button className="btn-orange w-full" disabled={busy} onClick={() => go('onboard')}>{busy ? 'Opening Stripe…' : 'Set up cash-outs with Stripe'}</button>
        </>
      )}
      {st && st.has_account && !st.payouts_enabled && (
        <>
          <Notice>Stripe still needs a few details before you can cash out.</Notice>
          <button className="btn-orange w-full" disabled={busy} onClick={() => go('onboard')}>{busy ? 'Opening Stripe…' : 'Finish Stripe setup'}</button>
        </>
      )}
      {st && st.payouts_enabled && (
        <>
          <button className="btn-orange w-full" disabled={busy || st.balance_cents < st.min_cents} onClick={() => go('cashout')}>
            {busy ? 'Sending…' : st.balance_cents < st.min_cents ? `Cash out (from ${money(st.min_cents)})` : `Cash out ${money(st.balance_cents)}`}
          </button>
          <button className="text-sm font-bold underline" disabled={busy} onClick={() => go('dashboard')}>See my payouts or change my bank on Stripe</button>
        </>
      )}
      {ok && <Notice kind="ok">{ok}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {st?.recent?.length > 0 && (
        <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
          {st.recent.map((r, i) => <li key={i} className="flex justify-between py-1"><span>{new Date(r.created_at).toLocaleDateString()}</span><span>{money(r.amount_cents)} · {r.status === 'paid' ? 'sent' : r.status === 'failed' ? 'returned to balance' : 'sending'}</span></li>)}
        </ul>
      )}
      {handNote && <p className="muted text-xs">{handNote}</p>}
    </div>
  )
}
