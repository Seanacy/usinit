import { useEffect, useState } from 'react'

function CopyLink({ link, className = '' }) {
  const [done, setDone] = useState(false)
  return <button type="button" className={className} onClick={() => { navigator.clipboard?.writeText(link); setDone(true); setTimeout(() => setDone(false), 1500) }}>{done ? 'Copied!' : 'Copy link'}</button>
}
import { KEY, SUPABASE_URL, money, supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

const FN = `${SUPABASE_URL}/functions/v1/gift-cashout`

// Holder cash-out: no ID, bank, or phone needed. Holder gets a link and picks
// a gift card, a Visa card, or Cash App / Venmo / PayPal.
export default function GiftCashout() {
  const [d, setD] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [fresh, setFresh] = useState(null)
  const load = () => supabase.rpc('my_gift_cashouts').then(({ data }) => setD(data ?? null))
  useEffect(() => { load() }, [])
  async function cashOut() {
    setBusy(true); setErr(null); setFresh(null)
    try {
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${s?.session?.access_token}` },
        body: JSON.stringify({ action: 'cashout' }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Try again.')
      setFresh(out)
    } catch (e) { setErr(e.message) }
    setBusy(false); load()
  }
  if (d === undefined) return <div className="card"><Spinner /></div>
  if (!d) return null
  const can = d.balance_cents >= d.min_cents
  return (
    <div className="card space-y-3">
      <h2 className="h2">Cash out</h2>
      <p className="text-2xl font-extrabold">{money(d.balance_cents)} <span className="muted text-sm font-normal">ready to cash out</span></p>
      <p className="muted text-sm">No ID, bank account, or phone needed. You get a cash-out link. Open it on any phone or computer (a library computer works) and pick how you want your money: a gift card (Walmart, Target, groceries, gas, and more), a Visa card, or money sent to Cash App, Venmo, PayPal, or a bank (those take a small fee). 💚 Good for Cash App: pick Instant Debit Transfer (Cash App Card, $10 or more) or Bank Transfer.</p>
      <p className="rounded-lg border-2 border-orange p-2 text-sm"><b>⚠️ $10 minimum for Instant Debit Transfer (Cash App Card).</b> {d.balance_cents < 1000
        ? <>You have {money(d.balance_cents)}. If you cash out now, your link will <b>not</b> have Instant Debit Transfer. You can still use Bank Transfer, a gift card, or a Visa card. Or wait until you have $10.</>
        : <>You have {money(d.balance_cents)}, so your link will have it.</>}</p>
      <button className="btn-orange w-full py-4 text-lg" disabled={busy || !can} onClick={cashOut}>
        {busy ? 'Making your link…' : can ? `Cash out ${money(d.balance_cents)}` : `Cash out (from ${money(d.min_cents)})`}
      </button>
      {fresh && (
        <div className="space-y-2 rounded-xl bg-orange/15 p-3">
          <p className="font-extrabold">Your {money(fresh.amount_cents)} cash-out link is ready.</p>
          <p className="rounded-lg bg-white p-2 text-sm dark:bg-neutral-900"><b>💚 Good for Cash App:</b> {fresh.amount_cents >= 1000 ? <>pick <b>Instant Debit Transfer</b> and enter your Cash App Card number, or pick </> : <>pick </>}<b>Bank Transfer</b> and use the account and routing numbers in the Money tab of Cash App.{fresh.amount_cents < 1000 && ' (Instant Debit Transfer shows up for cash-outs of $10 or more.)'}</p>
          <a className="btn-black w-full" href={fresh.link} target="_blank" rel="noreferrer">Open my cash-out link</a>
          <CopyLink link={fresh.link} className="btn-outline w-full" />
          <p className="text-sm">It stays saved below, so you can come back to it anytime. <b>Only share this link with someone you trust. Whoever opens it gets the money.</b></p>
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      {d.recent.length > 0 && (
        <div>
          <p className="text-sm font-bold">Your cash-out links</p>
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
            {d.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>{new Date(r.created_at).toLocaleDateString()} · {money(r.amount_cents)}</span>
                {r.status === 'sent' && r.link ? <span className="flex gap-3"><CopyLink link={r.link} className="font-bold underline" /><a className="font-bold underline" href={r.link} target="_blank" rel="noreferrer">Open link</a></span>
                  : <span className="muted">{r.status === 'failed' ? 'didn\'t go through, money returned' : 'making…'}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted text-xs">No phone or internet? Ask Us In It or your partner organization to pay you by hand.</p>
    </div>
  )
}
