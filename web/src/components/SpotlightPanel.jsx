import { useEffect, useState } from 'react'
import { supabase, uploadPhoto, useSession } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

const EMPTY = { id: null, headline: '', body: '', image_url: '', button_text: 'Learn more', button_url: '' }
const STATUS = {
  pending: ['Waiting for review', 'bg-orange/20 text-ink dark:text-white'],
  live: ['Live', 'bg-green-100 text-green-800'],
  paused: ['Paused', 'bg-neutral-200 text-neutral-700'],
  rejected: ['Needs changes', 'bg-red-100 text-red-800'],
  ended: ['Ended', 'bg-neutral-200 text-neutral-700'],
}

// Preview of how a spotlight looks when someone scans
export function SpotlightPreview({ s, business }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-ink dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
      <div className="bg-ink px-4 py-1 text-xs font-bold tracking-wide text-orange">COMMUNITY SPOTLIGHT{business ? ` · ${String(business).toUpperCase()}` : ''}</div>
      {s.image_url && <img src={s.image_url} alt="" className="max-h-72 w-full object-cover" />}
      <div className="p-5">
        <p className="text-2xl font-extrabold leading-snug">{s.headline || 'Your headline'}</p>
        {s.body && <p className="mt-2 text-lg">{s.body}</p>}
        {s.button_url && <span className="btn-orange mt-4 inline-block">{s.button_text || 'Learn more'}</span>}
      </div>
    </div>
  )
}

// The free Community Spotlight box on a business account.
// onBoost(spotlight) opens the ad form filled in with the spotlight.
export default function SpotlightPanel({ adv, onBoost }) {
  const session = useSession()
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const load = () => supabase.from('spotlights').select('*').eq('advertiser_id', adv.id).neq('status', 'ended').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [adv.id]) // eslint-disable-line
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function photo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setMsg(null)
    try { setForm({ ...form, image_url: await uploadPhoto(f, session.user.id) }) } catch (err) { setMsg({ kind: 'error', text: err.message }) }
    setBusy(false)
  }
  async function submit(e) {
    e.preventDefault(); setMsg(null)
    if (!form.headline.trim()) return setMsg({ kind: 'error', text: 'Add a headline.' })
    if (form.button_url && !/^https?:\/\//i.test(form.button_url.trim())) return setMsg({ kind: 'error', text: 'The button link must start with https://' })
    setBusy(true)
    const { error } = await supabase.rpc('submit_spotlight', { p_id: form.id, p_headline: form.headline, p_body: form.body, p_image: form.image_url, p_button_text: form.button_text, p_button_url: form.button_url })
    setBusy(false)
    if (error) return setMsg({ kind: 'error', text: error.message })
    setForm(null); setMsg({ kind: 'ok', text: 'Sent! Us In It reviews every spotlight. You will see "Live" here once it is approved.' }); load()
  }
  async function status(s, st) {
    if (st === 'ended' && !window.confirm(`End "${s.headline}"? It stops showing for good.`)) return
    const { error } = await supabase.rpc('set_spotlight_status', { p_id: s.id, p_status: st })
    if (error) setMsg({ kind: 'error', text: error.message })
    load()
  }

  if (!rows) return <div className="card"><Spinner /></div>
  return (
    <div className="space-y-3 rounded-2xl border-2 border-orange p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange">Free</p>
        <h2 className="h2">Your Community Spotlight</h2>
        <p className="muted text-sm">Show off one special product or service for free. Write a catchy message and pick your best photo. Your spotlight shows when people scan a holder's code and the Community Fund pays the holder. Views aren't guaranteed. Want guaranteed views? Boost it.</p>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      {form ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><span className="label">Headline (up to 80 letters)</span><input className="input" maxLength={80} value={form.headline} onChange={set('headline')} placeholder="Fresh knotless braids, booked same week" /></label>
          <label className="block"><span className="label">Message (up to 280 letters)</span><textarea className="input min-h-24" maxLength={280} value={form.body} onChange={set('body')} placeholder="What makes it special? Why should someone try it?" /></label>
          <div>
            <p className="label">Photo of your product or service</p>
            <input type="file" accept="image/*" onChange={photo} disabled={busy} />
            {form.image_url && <button type="button" className="ml-3 text-sm font-bold underline" onClick={() => setForm({ ...form, image_url: '' })}>Remove photo</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Button words</span><input className="input" maxLength={30} value={form.button_text} onChange={set('button_text')} placeholder="Book now" /></label>
            <label className="block"><span className="label">Button link</span><input className="input" value={form.button_url} onChange={set('button_url')} placeholder="https://yourbusiness.com" /></label>
          </div>
          <p className="label">How it will look</p>
          <SpotlightPreview s={form} business={adv.business_name} />
          <div className="flex gap-2">
            <button className="btn-orange flex-1" disabled={busy}>{busy ? 'Sending…' : form.id ? 'Send changes for review' : 'Send my spotlight'}</button>
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {rows.map((s) => (
            <div key={s.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-extrabold">{s.headline}</p>
                <span className={`pill shrink-0 ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span>
              </div>
              {s.image_url && <img src={s.image_url} alt="" className="max-h-40 rounded-lg object-cover" />}
              <p className="text-sm"><b>{s.views}</b> views · <b>{s.clicks}</b> button taps</p>
              {s.status === 'rejected' && s.admin_note && <Notice kind="error">From Us In It: {s.admin_note}</Notice>}
              <div className="flex flex-wrap gap-2">
                <button className="btn-orange py-2" onClick={() => onBoost?.(s)}>🚀 Boost it</button>
                <button className="btn-outline py-2" onClick={() => setForm({ ...EMPTY, ...s, body: s.body || '', image_url: s.image_url || '', button_text: s.button_text || '', button_url: s.button_url || '' })}>Edit</button>
                {s.status === 'live' && <button className="btn-outline py-2" onClick={() => status(s, 'paused')}>Pause</button>}
                {s.status === 'paused' && <button className="btn-outline py-2" onClick={() => status(s, 'live')}>Resume</button>}
                <button className="btn-outline py-2" onClick={() => status(s, 'ended')}>End</button>
              </div>
              {s.boosted_ad_id && <p className="muted text-xs">Boosted: a paid ad was made from this spotlight. See it under Your ads.</p>}
            </div>
          ))}
          {rows.length < 3 && (
            <button className="btn-black w-full" onClick={() => { setMsg(null); setForm(EMPTY) }}>{rows.length ? '+ Make another spotlight' : '+ Make my free spotlight'}</button>
          )}
          <div className="rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
            <p className="font-bold">🚀 What does Boost do?</p>
            <p>It turns your spotlight into a paid ad that shows every time someone scans inside your own zone. You draw the zone, set a daily budget, and pay $0.50 per scan. $0.40 of each scan goes to the holder.</p>
          </div>
        </>
      )}
    </div>
  )
}
