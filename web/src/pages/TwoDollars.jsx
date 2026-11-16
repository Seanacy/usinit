import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '../components/Layout'
import ShareQR from '../components/ShareQR'
import { deviceId, startCheckout } from '../lib/supabase'

// usinit.com/2 — The $2 Drop: exactly $2 to the Community Fund (card fee added on top)
export const TWO_URL = 'https://www.usinit.com/2'
export const TWO_MESSAGE = "$2 = 4 paychecks. Give $2 and 4 people on our streets get paid for a scan. Not a handout. A paycheck. 🧡 usinit.com/2"

export default function TwoDollars() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState(false)

  async function give() {
    setErr(null); setBusy(true)
    try { await startCheckout({ kind: 'two', device: deviceId() }) } catch (e) { setErr(e.message); setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(TWO_MESSAGE); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="font-bold text-orange">[ The $2 Drop ]</p>
        <h1 className="mt-2 text-6xl font-black">$2 = 4 paychecks.</h1>
        <p className="mt-4 text-lg text-neutral-300">Give $2 and 4 people on our streets get paid for a scan. Not a handout. A paycheck.</p>
      </div>

      <button className="btn-orange w-full py-5 text-2xl" onClick={give} disabled={busy}>
        {busy ? 'Opening checkout…' : 'Give $2'}
      </button>
      <p className="muted -mt-3 text-center text-sm">$2 plus a 37¢ card fee, so the full $2 goes to the Community Fund. Apple Pay, Google Pay, Cash App Pay, or card. No account needed.</p>
      {err && <Notice kind="error">{err}</Notice>}

      <div className="card space-y-3">
        <p className="text-lg font-extrabold">Pass it on</p>
        <p className="rounded-xl bg-neutral-100 px-4 py-3 font-bold dark:bg-neutral-800">{TWO_MESSAGE}</p>
        <button type="button" className="btn-outline w-full" onClick={copy}>{copied ? 'Copied ✓' : 'Copy this message'}</button>
      </div>

      <ShareQR inline url={TWO_URL} title={TWO_MESSAGE} heading="Scan. Give $2. Pay 4 people." />

      <p className="muted text-center text-sm">Want to give more? <Link to="/support" className="underline">Go to the Support page</Link>. Us In It is a business run by Many Ways Up LLC. Payments are not tax-deductible.</p>
    </div>
  )
}
