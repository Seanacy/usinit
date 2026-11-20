import { useEffect, useState } from 'react'
import { money, startCheckout, supabase } from '../lib/supabase'
import { getRef } from '../lib/ref'
import { Notice } from './Layout'

// "Give $3": $2 goes to the holder, $1 goes to the Community Fund to help launch Us In It.
// Amounts come from settings (launch_give_cents, launch_give_holder_cents). Card fee is added on top.
export function useLaunchGive() {
  const [g, setG] = useState(null)
  useEffect(() => { supabase.rpc('launch_give_stats').then(({ data }) => setG(data || null)) }, [])
  return g
}

export function cardTotal(cents, s = {}) {
  const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30)
  return Math.ceil((cents + fixed) / (1 - pct))
}

export function LaunchGiveBox({ code, firstName, scanId, settings, from, compact }) {
  const g = useLaunchGive()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  if (!g || !g.on) return null
  const give = g.give_cents, toHolder = g.holder_cents, toFund = give - toHolder
  const total = cardTotal(give, settings)
  async function go() {
    setErr(null); setBusy(true)
    try { await startCheckout({ holder_code: code, scan_id: scanId, ref: getRef(), from }, 'launch-give') } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className={`rounded-2xl border-2 border-orange bg-orange/10 p-4 ${compact ? '' : 'mt-3'}`}>
      <p className="text-lg font-extrabold">Give {money(give)}</p>
      <ul className="mt-1 space-y-1 text-sm">
        <li>💸 <b>{money(toHolder)}</b> goes straight to {firstName}</li>
        <li>🚀 <b>{money(toFund)}</b> helps launch Us In It, so holders get paid for every scan</li>
      </ul>
      <p className="muted mt-2 text-xs">{money(give)} + card fee {money(total - give)} = {money(total)}. Not tax-deductible.</p>
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <button className="btn-orange mt-3 w-full py-3 text-lg" onClick={go} disabled={busy}>{busy ? 'Opening checkout…' : `Give ${money(give)}`}</button>
    </div>
  )
}
