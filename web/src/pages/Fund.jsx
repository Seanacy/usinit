import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money, startCheckout, useStats } from '../lib/supabase'
import { GoalTracker } from './Home'
import { Notice } from '../components/Layout'

export default function Fund() {
  const stats = useStats()
  const [amount, setAmount] = useState(1000)
  const [other, setOther] = useState('')
  const [donor, setDonor] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const s = stats?.settings || {}
  const cents = other ? Math.round(Number(other) * 100) : amount
  const fee = Math.round(cents * (Number(s.stripe_fee_pct ?? 2.9) / 100)) + Number(s.stripe_fee_fixed_cents ?? 30)
  const net = Math.max(0, cents - fee)
  const platform = Math.round(net * (Number(s.fund_gift_fee_pct ?? 10) / 100))
  const price = stats?.price_per_scan_cents || 50
  const share = stats?.holder_share_cents || 40

  async function give() {
    setErr(null)
    if (!(cents >= 100)) return setErr('Gifts start at $1.')
    setBusy(true)
    try { await startCheckout({ kind: 'gift', amount_cents: cents, donor_name: donor }) } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="h1">Community Fund</h1>
      <p className="muted mt-2">The Community Fund pays people on our streets for scans when no paid messages are running. It keeps holders earning while local businesses come on board.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="card"><p className="muted text-sm">In the fund now</p><p className="text-2xl font-extrabold">{stats ? money(stats.fund_balance_cents) : '…'}</p><p className="muted text-xs">Powers about {stats ? Math.floor(stats.fund_balance_cents / price).toLocaleString() : '…'} scans</p></div>
        <div className="card"><p className="muted text-sm">Paid to holders</p><p className="text-2xl font-extrabold">{stats ? money(stats.paid_to_holders_cents) : '…'}</p><p className="muted text-xs">{stats ? stats.scans_funded.toLocaleString() : '…'} scans funded by neighbors</p></div>
      </div>
      <div className="mt-4"><GoalTracker stats={stats} /></div>
      <p className="mt-4 font-bold">Every scan costs {money(price)}: {money(share)} goes to the holder, {money(price - share)} keeps Us In It running.</p>

      <div className="card mt-6">
        <h2 className="h2">Give once</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[500, 1000, 2500].map((a) => (
            <button key={a} onClick={() => { setAmount(a); setOther('') }} className={`rounded-xl border-2 py-3 text-lg font-extrabold ${!other && amount === a ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>${a / 100}</button>
          ))}
        </div>
        <input className="input mt-2" inputMode="decimal" placeholder="Other amount, like 40" value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Other amount in dollars" />
        <input className="input mt-2" placeholder="Your first name for the thank-you wall (optional)" maxLength={40} value={donor} onChange={(e) => setDonor(e.target.value)} />
        {cents >= 100 && <p className="mt-3 text-sm font-bold">{money(net - platform)} goes to the Community Fund, {money(platform)} supports running Us In It, {money(fee)} is card processing.</p>}
        {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
        <button className="btn-orange mt-3 w-full" onClick={give} disabled={busy}>{busy ? 'Opening checkout…' : `Give ${money(cents || 0)}`}</button>
        <p className="muted mt-3 text-xs">Your gift goes into the Community Fund, which pays people on the street for scans when no paid messages are running. Us In It is a business, not a charity. Not tax-deductible.</p>
      </div>
      <Link to="/support" className="btn-black mt-4 w-full">Or become a Founding Supporter</Link>
    </div>
  )
}
