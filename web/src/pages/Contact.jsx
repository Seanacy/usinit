import { useState } from 'react'
import { Link } from 'react-router-dom'

// usinit.com/contact — one email for everything
const EMAIL = 'team@usinit.com'

const REASONS = [
  ['🙋', 'Holders', 'Questions about your code, your balance, or cashing out.'],
  ['🏪', 'Businesses', 'Ads, zones, Community Spotlight, booking pages, or The Plug.'],
  ['🧡', 'Supporters', 'Questions about a payment or your weekly plan.'],
  ['🎄', 'Gift Tree', 'Parents, sponsors, and churches.'],
  ['🤝', 'Partners and press', 'Nonprofits, shelters, funders, and reporters.'],
]

export default function Contact() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(EMAIL); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-white">
        <p className="font-bold text-orange">[ Us In It ]</p>
        <h1 className="mt-2 text-4xl font-black">Contact us</h1>
        <p className="mt-3 text-neutral-300">One email for everything. A real person reads every message.</p>
      </div>

      <div className="card space-y-3 text-center">
        <p className="muted text-sm font-bold uppercase tracking-wide">Email</p>
        <a href={`mailto:${EMAIL}`} className="block break-all text-3xl font-black text-orange underline">{EMAIL}</a>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`mailto:${EMAIL}`} className="btn-orange w-full py-3">Send an email</a>
          <button type="button" onClick={copy} className="btn-outline w-full py-3">{copied ? 'Copied ✓' : 'Copy email'}</button>
        </div>
      </div>

      <div className="card space-y-3">
        <p className="text-lg font-extrabold">What can we help with?</p>
        {REASONS.map(([e, t, d]) => (
          <div key={t} className="flex gap-3">
            <span className="text-2xl">{e}</span>
            <div><p className="font-bold">{t}</p><p className="muted text-sm">{d}</p></div>
          </div>
        ))}
        <p className="muted text-sm">Tip: put the topic in your subject line, like "Holder: cash-out question."</p>
      </div>

      <div className="card space-y-1">
        <p className="font-bold">Please don't email</p>
        <p className="muted text-sm">Card numbers, bank numbers, passwords, or Social Security numbers. We will never ask for them by email.</p>
      </div>

      <p className="muted text-center text-sm">Us In It is run by Many Ways Up LLC in Minneapolis, Minnesota. <Link to="/how" className="underline">See how it works</Link></p>
    </div>
  )
}
