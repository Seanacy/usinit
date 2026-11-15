import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SITE_URL, deviceId, money, startCheckout, supabase, useStats, withCardFee } from '../lib/supabase'
import ShareQR from '../components/ShareQR'
import GiftTagTeam from '../components/GiftTagTeam'
import { ContentCard } from './Scan'
import { Notice, Spinner } from '../components/Layout'

const GIVE = [1000, 2500, 5000, 10000]

function TagCard({ t, onGive }) {
  const pct = Math.min(100, Math.round((t.raised_cents / t.goal_cents) * 100))
  const done = t.status !== 'open'
  return (
    <div className={`card space-y-2 ${done ? 'border-2 border-green-600' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xl font-extrabold">🎁 {t.label}</p>
        {done && <span className="pill bg-green-100 text-green-800">{t.status === 'delivered' ? 'Delivered' : 'Shopped'}</span>}
      </div>
      {t.items?.length > 0 ? (
        <div className="space-y-2">
          {t.store && <p className="muted text-sm">Shopping at {t.store === 'target' ? 'Target' : 'Walmart'}</p>}
          {t.items.map((it, i) => (
            <div key={i} className="flex items-center gap-3">
              <img src={it.image} alt={it.name} className="h-16 w-16 flex-none rounded-lg object-cover" loading="lazy" />
              <p className="text-sm"><b>{it.name}</b>{it.note ? ` (${it.note})` : ''}<br />{money(it.price_cents)}</p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="list-disc pl-5">{t.wishes.split('\n').filter(Boolean).map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      {done ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">Spent {money(t.spent_cents)} on {new Date(t.shopped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          {t.receipt_url && <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">See the receipt</a>}
        </div>
      ) : (
        <>
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 rounded-full bg-orange" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm font-bold">{money(t.raised_cents)} of {money(t.goal_cents)}{pct >= 100 ? ' · Ready to shop! 🎉' : ''}{t.scans ? ` · ${t.scans} sponsor scans` : ''}</p>
          {t.team?.length > 0 && (
            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-sm font-bold">Team board</p>
              {t.team.map((m, i) => <p key={m.name} className="text-sm">{i + 1}. {m.name} · {m.scans} scan{m.scans === 1 ? '' : 's'}</p>)}
            </div>
          )}
          {pct < 100 && (
            <div className="grid gap-2">
              <GiftTagTeam t={t} />
              {onGive && <button type="button" className="btn-outline w-full" onClick={() => onGive(t)}>Give to this tag</button>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GiveBox({ tag, onClear }) {
  const stats = useStats()
  const [amt, setAmt] = useState(2500)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function give() {
    setBusy(true); setErr(null)
    try { await startCheckout({ kind: 'gift_tree', amount_cents: amt, donor_name: name, tag_code: tag?.code || null }) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div id="give" className="card space-y-3">
      <h2 className="h2">{tag ? `Give to 🎁 ${tag.label}` : 'Give to the Gift Tree'}</h2>
      {tag ? <p className="text-sm">Your gift goes to this tag first. If it fills up, the rest helps the next tag. <button type="button" className="font-bold underline" onClick={onClear}>Give to the whole tree instead</button></p>
        : <p className="text-sm">Your gift fills tags in order, top to bottom.</p>}
      <div className="grid grid-cols-4 gap-2">
        {GIVE.map((a) => <button key={a} type="button" onClick={() => setAmt(a)} className={amt === a ? 'btn-orange py-3' : 'btn-outline py-3'}>${a / 100}</button>)}
      </div>
      <input className="input" placeholder="Your first name (optional, for the thank-you list)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <p className="text-sm font-bold">Gift {money(amt)} + card fee {money(withCardFee(amt, stats || {}) - amt)} = {money(withCardFee(amt, stats || {}))}. All {money(amt)} goes to gifts.</p>
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-orange w-full py-4 text-lg" onClick={give} disabled={busy}>{busy ? 'Opening checkout…' : `Give ${money(amt)}`}</button>
    </div>
  )
}

// usinit.com/gifttree
export default function GiftTree() {
  const [d, setD] = useState(null)
  const [giveTag, setGiveTag] = useState(null)
  const pickGive = (t) => { setGiveTag(t); setTimeout(() => document.getElementById('give')?.scrollIntoView({ behavior: 'smooth' }), 50) }
  useEffect(() => { supabase.rpc('gift_tree_public').then(({ data }) => setD(data)) }, [])
  if (!d) return <Spinner />
  const open = d.tags.filter((t) => t.status === 'open')
  const done = d.tags.filter((t) => t.status !== 'open')
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="text-5xl">🎄</p>
        <h1 className="mt-2 text-4xl font-black">The Us In It Gift Tree</h1>
        <p className="mt-3 text-neutral-300">Real wish lists from local kids. Every scan and every gift helps fill a tag. When a tag is full, we go shopping and post the receipts here.</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div><p className="text-3xl font-black text-orange">{money(d.raised_cents)}</p><p className="text-sm text-neutral-300">raised</p></div>
          <div><p className="text-3xl font-black text-orange">{money(d.spent_cents)}</p><p className="text-sm text-neutral-300">spent on gifts</p></div>
          <div><p className="text-3xl font-black text-orange">{d.scans}</p><p className="text-sm text-neutral-300">sponsor scans</p></div>
        </div>
      </div>

      {!d.on && <Notice>The Gift Tree is closed right now. Thank you to everyone who helped!</Notice>}

      <div className="space-y-3">
        <h2 className="h2">Wish lists</h2>
        <p className="muted text-sm">Each tag has its own code, so a whole team (a church, a class, friends) can work on one child or one big goal. Money for the whole tree fills tags in order. Kids are picked with a partner (like a church) and their parents' OK. Parents sign up with a private link from us. We never share names or photos.</p>
        {d.tags.length === 0 && <p className="muted">Tags are coming soon.</p>}
        {open.map((t) => <TagCard key={t.id} t={t} onGive={d.on ? pickGive : null} />)}
        {done.map((t) => <TagCard key={t.id} t={t} />)}
      </div>

      {d.on && <GiveBox tag={giveTag} onClear={() => setGiveTag(null)} />}

      {d.on && (
        <div className="card space-y-3">
          <h2 className="h2">Help by scanning (free)</h2>
          <p>Scan this code. A local business sponsor pays {money(d.price_cents)} and {money(d.fund_cents)} goes straight to the Gift Tree. One scan per phone per day. Show it to friends, family, and coworkers.</p>
          <ShareQR inline url={`${SITE_URL}/gt`} title="Scan for the Us In It Gift Tree" heading="Scan for the whole Gift Tree" label="Full screen" />
        </div>
      )}

      <div className="muted space-y-2 text-sm">
        <p><b>Where the money goes:</b> every dollar given goes to gifts. Sponsor scans: {money(d.fund_cents)} of each {money(d.price_cents)} goes to gifts, the rest keeps Us In It running. {d.leftover}</p>
        <p>Us In It is a business, not a charity. Gifts are not tax-deductible.</p>
        <p>Businesses: want to sponsor Gift Tree scans? <Link to="/advertise" className="font-bold underline">Make an ad</Link> and check "Sponsor the Gift Tree."</p>
      </div>
    </div>
  )
}

// usinit.com/gt — what a scanner sees
export function GiftTreeScan() {
  const { code } = useParams()
  const [qs] = useSearchParams()
  const [res, setRes] = useState(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    supabase.rpc('process_gift_tree_scan', { p_device: deviceId(), p_tag: code || null, p_champ: qs.get('by') || null }).then(({ data }) => setRes(data || { tree: null }))
  }, []) // eslint-disable-line
  if (!res) return <Spinner label="Opening the Gift Tree" />
  const t = res.tree
  const next = (res.tag_id && t?.tags?.find((x) => x.id === res.tag_id)) || t?.tags?.find((x) => x.status === 'open' && x.raised_cents < x.goal_cents)
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8 text-center">
      <p className="text-5xl">🎄</p>
      <h1 className="h1">{res.earned ? 'Your scan just helped a kid this Christmas!' : 'Thank you for helping the Gift Tree!'}</h1>
      {res.earned && res.content?.sponsor && <p className="font-bold">Brought to you by {res.content.sponsor}</p>}
      {res.content && <div className="text-left"><ContentCard content={res.content} /></div>}
      {next && (
        <div className="card text-left">
          <p className="font-extrabold">{res.tag_id ? 'Your scan helped' : 'Now filling'}: 🎁 {next.label}</p>
          {res.champ && res.earned && <p className="text-sm">Counted for {res.champ}'s team score. 🙌</p>}
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 rounded-full bg-orange" style={{ width: `${Math.min(100, (next.raised_cents / next.goal_cents) * 100)}%` }} /></div>
          <p className="mt-1 text-sm font-bold">{money(next.raised_cents)} of {money(next.goal_cents)}</p>
        </div>
      )}
      <Link to="/gifttree" className="btn-orange block w-full py-4 text-lg">See the wish lists</Link>
      <p className="muted text-xs">Do not use your phone while driving.</p>
    </div>
  )
}
