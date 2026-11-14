import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SITE_URL, money, startCheckout, useStats } from '../lib/supabase'
import ShareQR from '../components/ShareQR'
import { GoalTracker } from './Home'
import { Notice } from '../components/Layout'

export default function Support({ embedded = false, onBack }) {
  const stats = useStats()
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const weekly = stats?.settings?.supporter_weekly_amounts || [500, 1000, 2000, 5000]
  const onceAmts = stats?.settings?.supporter_onetime_amounts || [5000, 10000, 20000]
  const [mode, setMode] = useState('weekly')
  const [amount, setAmount] = useState(500)
  const [weeks, setWeeks] = useState(8)
  const [once, setOnce] = useState(5000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const price = stats?.price_per_scan_cents || 50
  const share = stats?.holder_share_cents || 40

  async function pay() {
    setErr(null); setBusy(true)
    try {
      if (mode === 'weekly') await startCheckout({ kind: 'supporter', plan_type: 'weekly', amount_cents: amount, weeks, ref })
      else await startCheckout({ kind: 'supporter', plan_type: 'one_time', amount_cents: once, ref })
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  const choice = (active) => `rounded-xl border-2 px-3 py-4 text-lg font-extrabold transition ${active ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`

  return (
    <div className={embedded ? '' : 'mx-auto max-w-xl px-4 py-8'}>
      {onBack && <button onClick={onBack} className="mb-4 font-bold underline">← Back</button>}
      <h1 className="h1">Your support pays people on our streets for scans.</h1>
      <div className="mt-4"><GoalTracker stats={stats} /></div>

      {mode === 'weekly' ? (
        <div className="mt-6 space-y-5">
          <div>
            <p className="label">Amount per week</p>
            <div className="grid grid-cols-4 gap-2">
              {weekly.map((a) => <button key={a} className={choice(amount === a)} onClick={() => setAmount(a)}>${a / 100}</button>)}
            </div>
          </div>
          <div>
            <p className="label">How long</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={choice(weeks === 4)} onClick={() => setWeeks(4)}>1 month<span className="block text-sm font-bold">4 payments</span></button>
              <button className={choice(weeks === 8)} onClick={() => setWeeks(8)}>2 months<span className="block text-sm font-bold">8 payments</span></button>
            </div>
          </div>
          <p className="rounded-xl bg-neutral-100 px-4 py-3 text-lg font-bold dark:bg-neutral-800">
            {money(amount)} a week for {weeks === 4 ? '1 month' : '2 months'} = {money(amount * weeks)} total. Ends on its own.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <p className="label">Give once</p>
          <div className="grid grid-cols-3 gap-2">
            {onceAmts.map((a) => <button key={a} className={choice(once === a)} onClick={() => setOnce(a)}>${a / 100}</button>)}
          </div>
        </div>
      )}

      <button className="btn-orange mt-6 w-full py-4 text-lg" onClick={pay} disabled={busy}>
        {busy ? 'Opening checkout…' : mode === 'weekly' ? `Pay ${money(amount)} a week` : `Pay ${money(once)} once`}
      </button>
      <p className="muted mt-2 text-center text-sm">Apple Pay, Google Pay, Cash App Pay, or card. No account needed.</p>
      {err && <div className="mt-3"><Notice kind="error">{err}</Notice></div>}

      <button className="mt-5 w-full text-center font-bold underline" onClick={() => setMode(mode === 'weekly' ? 'once' : 'weekly')}>
        {mode === 'weekly' ? 'Prefer to give once?' : 'Back to weekly support'}
      </button>

      <div className="mt-6">
        <ShareQR url={`${SITE_URL}/support${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`} title="Support Us In It" label="Show QR code for this page" />
        <p className="muted mt-1 text-center text-sm">Pull it up on your phone so people can scan it, or share it.</p>
      </div>

      <div className="muted mt-6 space-y-2 text-sm">
        <p>Every scan costs {money(price)}: {money(share)} goes to the holder, {money(price - share)} keeps Us In It running.</p>
        <p>Your support goes into the Us In It Community Fund, which pays holders for scans when no paid messages are running. Us In It is a business, not a charity. Support is not tax-deductible. Card processing fees come out first. You can cancel anytime from your email receipt.</p>
      </div>
    </div>
  )
}
