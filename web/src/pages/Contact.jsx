import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '../components/Layout'
import { supabase } from '../lib/supabase'

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

      <ContactForm />

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

// The message form. Business, phone and picture are optional.
function ContactForm() {
  const empty = { business: '', name: '', phone: '', email: '', message: '' }
  const [f, setF] = useState(empty)
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    if (!file.type.startsWith('image/')) return setErr('Please pick a picture (JPG or PNG).')
    if (file.size > 5 * 1024 * 1024) return setErr('That picture is too big. Use one under 5 MB.')
    setUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const { error } = await supabase.storage.from('contact').upload(path, file, { upsert: false, contentType: file.type })
    setUploading(false)
    if (error) return setErr('That picture did not upload. Use a JPG or PNG under 5 MB.')
    setPhoto({ path, name: file.name })
  }

  async function send(e) {
    e.preventDefault()
    setErr(null); setBusy(true)
    const { error } = await supabase.rpc('submit_contact', { p_business: f.business, p_name: f.name, p_phone: f.phone, p_email: f.email, p_message: f.message, p_photo: photo?.path ?? null })
    setBusy(false)
    if (error) return setErr(error.message)
    setSent(true); setF(empty); setPhoto(null)
  }

  if (sent) return (
    <div className="card space-y-3 text-center">
      <p className="text-4xl">✅</p>
      <p className="text-2xl font-black">Message sent</p>
      <p className="muted">Thanks for reaching out. We'll reply to the email you gave us.</p>
      <button type="button" className="btn-outline w-full" onClick={() => setSent(false)}>Send another message</button>
    </div>
  )

  const input = 'w-full rounded-xl border-2 border-neutral-300 bg-transparent px-4 py-3 text-lg dark:border-neutral-600'
  return (
    <form onSubmit={send} className="card space-y-4">
      <p className="text-lg font-extrabold">Send us a message</p>
      <label className="block"><span className="label">Business <span className="muted font-normal">(optional)</span></span>
        <input className={input} value={f.business} onChange={set('business')} maxLength={120} autoComplete="organization" /></label>
      <label className="block"><span className="label">Name <span className="text-orange">*</span></span>
        <input className={input} value={f.name} onChange={set('name')} maxLength={80} required autoComplete="name" /></label>
      <label className="block"><span className="label">Phone number <span className="muted font-normal">(optional)</span></span>
        <input className={input} value={f.phone} onChange={set('phone')} maxLength={30} type="tel" inputMode="tel" autoComplete="tel" /></label>
      <label className="block"><span className="label">Email <span className="text-orange">*</span></span>
        <input className={input} value={f.email} onChange={set('email')} maxLength={200} type="email" required autoComplete="email" /></label>
      <label className="block"><span className="label">Message <span className="text-orange">*</span></span>
        <textarea className={`${input} min-h-[9rem]`} value={f.message} onChange={set('message')} maxLength={3000} required placeholder="Tell us why you're reaching out." /></label>
      <div>
        <span className="label">Picture <span className="muted font-normal">(optional)</span></span>
        {photo ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-orange px-4 py-3">
            <span className="truncate font-bold">📎 {photo.name}</span>
            <button type="button" className="font-bold underline" onClick={() => setPhoto(null)}>Remove</button>
          </div>
        ) : (
          <label className="btn-outline block w-full cursor-pointer py-3 text-center">
            {uploading ? 'Uploading…' : '📷 Add a picture'}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={uploading} />
          </label>
        )}
      </div>
      <p className="muted text-xs"><span className="text-orange">*</span> Required</p>
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full py-4 text-lg" disabled={busy || uploading}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  )
}
