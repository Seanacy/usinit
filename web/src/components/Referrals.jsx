import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deviceId, money, supabase, IS_FINAL_DOMAIN, SITE_URL } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import { useQR, Verified } from './Printables'
import { hasAlcohol } from '../lib/tonight'

// Referral Partners: businesses send each other customers. The business that gets the customer
// pays the sender a set reward, plus Us In It's 20% fee on top (at least 50¢), from its prepaid balance.
export const fee = (cents) => Math.max(50, Math.round(cents * 0.2))
export const refUrl = (code) => `${SITE_URL}/r/${code}`

const GROUPS = {
  Auto: ['Oil change', 'Tires', 'Auto repair', 'Car wash / detailing', 'Auto parts'],
  Beauty: ['Nails', 'Lashes', 'Brows', 'Hair salon', 'Barber', 'Braids', 'Spa / massage'],
  Food: ['Coffee', 'Bakery', 'Restaurant', 'Food truck', 'Grocery'],
  Shopping: ['Clothing / boutique', 'Shoes', 'Thrift', 'Gifts', 'Phone / electronics'],
  Home: ['Cleaning', 'Moving', 'Handyman', 'Laundromat', 'Furniture'],
  Health: ['Gym / fitness', 'Nutrition', 'Yoga', 'Pharmacy'],
  Other: ['Other'],
}
const groupOf = (cat) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(cat)) || 'Other'
const feetOrMiles = (m) => (m == null ? 'distance unknown' : m < 300 ? `${Math.round(m * 3.281)} ft away` : `${(m / 1609).toFixed(1)} mi away`)

export function ReferralPanel({ adv }) {
  const [d, setD] = useState(null)
  const [sugs, setSugs] = useState([])
  const [msg, setMsg] = useState(null)
  async function load() {
    const [{ data }, { data: s }] = await Promise.all([supabase.rpc('my_referrals'), supabase.rpc('referral_suggestions')])
    setD(data); setSugs(s || [])
  }
  useEffect(() => { load() }, [adv.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null
  const waiting = d.links.filter((l) => l.status === 'requested' && ((l.requested_by === 'owner') === l.i_send))
  const sent = d.links.filter((l) => l.status === 'requested' && !waiting.includes(l))
  const active = d.links.filter((l) => l.status === 'active')
  async function act(fn, args, ok) {
    setMsg(null)
    const { error } = await supabase.rpc(fn, args)
    if (error) setMsg({ kind: 'error', text: error.message }); else if (ok) setMsg({ kind: 'ok', text: ok })
    load()
  }
  return (
    <div className="space-y-3">
      <h2 className="h2 pt-2">Referral Partners</h2>
      <p className="muted -mt-2 text-sm">Team up with businesses near you. They send you customers with a discount, and you pay them a reward when the customer buys. Send them customers and you earn their reward.</p>
      {!d.me.approved && <Notice>Referral Partners opens once Us In It approves your business.</Notice>}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <SpotForm me={d.me} onDone={load} />
      {d.me.approved && <OfferForm me={d.me} offer={d.offer} onDone={load} />}
      {waiting.length > 0 && (
        <div className="card space-y-2 border-2 border-orange">
          <p className="font-extrabold">📥 Waiting on you ({waiting.length})</p>
          {waiting.map((l) => (
            <div key={l.id} className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
              <p>{l.i_send ? <><b>{l.other}</b> invited you to send them customers. You earn <b>{money(l.payout_cents)}</b> each time.</> : <><b>{l.other}</b> wants to send you customers. You pay <b>{money(l.payout_cents + l.fee_cents)}</b> per customer who buys.</>}</p>
              <p className="text-sm">Their deal: {l.discount}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn-orange py-2" onClick={() => act('respond_referral_partner', { p_id: l.id, p_action: 'yes' }, `You and ${l.other} are partners now.`)}>Yes, team up</button>
                <button className="btn-outline py-2" onClick={() => act('respond_referral_partner', { p_id: l.id, p_action: 'no' })}>No thanks</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {active.length > 0 && (
        <div className="card space-y-3">
          <p className="font-extrabold">🤝 Your partners ({active.length})</p>
          {active.map((l) => <PartnerRow key={l.id} l={l} onEnd={() => window.confirm(`Stop partnering with ${l.other}?`) && act('respond_referral_partner', { p_id: l.id, p_action: 'end' })} />)}
        </div>
      )}
      {sent.length > 0 && <p className="muted text-sm">Waiting for an answer from: {sent.map((l) => l.other).join(', ')}</p>}
      {d.me.approved && d.me.on && <FindPartners me={d.me} offer={d.offer} sugs={sugs} act={act} />}
    </div>
  )
}

function SpotForm({ me, onDone }) {
  const [open, setOpen] = useState(!me.address || !me.category)
  const [f, setF] = useState({ address: me.address || '', category: me.category || '', on: me.on || !me.address })
  const [err, setErr] = useState(null)
  async function save() {
    setErr(null)
    if (!f.address.trim()) return setErr('Add your full street address.')
    if (!f.category) return setErr('Pick what kind of business you are.')
    const { error } = await supabase.rpc('set_business_location', { p_address: f.address, p_category: f.category, p_on: f.on })
    if (error) return setErr(error.message)
    setOpen(false); onDone()
  }
  if (!open) {
    return (
      <div className="card flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">📍 {me.address} · {me.category}</p>
          <p className="muted text-sm">{me.on ? 'Other businesses can find you.' : 'Hidden from other businesses.'} {!me.mapped && (me.geo_status === 'nomatch' ? 'We couldn’t find that address on the map. Fix it so nearby businesses show up.' : 'Finding you on the map (up to 10 minutes).')}</p>
        </div>
        <button className="btn-outline shrink-0 py-2" onClick={() => setOpen(true)}>Edit</button>
      </div>
    )
  }
  return (
    <div className="card space-y-3">
      <p className="font-extrabold">Step 1: Where you are and what you do</p>
      {err && <Notice kind="error">{err}</Notice>}
      <input className="input" placeholder="Full street address, like 123 Main St, Minneapolis" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Kind of business">
        <option value="">What kind of business are you?</option>
        {Object.entries(GROUPS).map(([g, list]) => <optgroup key={g} label={g}>{list.map((c) => <option key={c}>{c}</option>)}</optgroup>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.on} onChange={(e) => setF({ ...f, on: e.target.checked })} /> Let other businesses find me</label>
      <button className="btn-black w-full" onClick={save}>Save</button>
    </div>
  )
}

function OfferForm({ me, offer, onDone }) {
  const [open, setOpen] = useState(!offer)
  const [f, setF] = useState({ discount: offer?.discount || '', terms: offer?.terms || '', payout: offer ? (offer.payout_cents / 100).toFixed(2) : '5.00', days: offer?.claim_days || 30, accepting: offer?.accepting ?? true, active: offer?.active ?? true })
  const [err, setErr] = useState(null)
  const cents = Math.round(Number(f.payout) * 100) || 0
  async function save() {
    setErr(null)
    if (f.discount.trim().length < 3) return setErr('Write the deal customers get, like "$10 off any set of tires."')
    if (cents < 100) return setErr('The reward has to be at least $1.')
    if (hasAlcohol(f.discount) || hasAlcohol(f.terms)) return setErr('Referral offers can’t mention alcohol.')
    const { error } = await supabase.rpc('save_referral_offer', { p_discount: f.discount, p_terms: f.terms, p_payout_cents: cents, p_claim_days: Number(f.days), p_accepting: f.accepting, p_active: f.active })
    if (error) return setErr(error.message)
    setOpen(false); onDone()
  }
  const low = offer && me.balance_cents < offer.payout_cents + offer.fee_cents
  if (!open && offer) {
    return (
      <div className="card space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-extrabold">🎟️ Your offer: {offer.discount}</p>
            <p className="text-sm">You pay <b>{money(offer.payout_cents)}</b> to the business that sent them + <b>{money(offer.fee_cents)}</b> Us In It fee = <b>{money(offer.payout_cents + offer.fee_cents)}</b> per customer who buys.</p>
            <p className="muted text-sm">{offer.active ? (offer.accepting ? 'On · taking new partners' : 'On · not taking new partners') : 'Off'}</p>
          </div>
          <button className="btn-outline shrink-0 py-2" onClick={() => setOpen(true)}>Edit</button>
        </div>
        {low && <Notice kind="error">Your ad balance is too low, so your offer is paused for customers. Add funds above to turn it back on.</Notice>}
        {!me.has_pin && <Notice kind="error">Set your 4-digit store PIN in the Coupons box. Staff need it to accept referral codes.</Notice>}
      </div>
    )
  }
  return (
    <div className="card space-y-3">
      <p className="font-extrabold">Step 2: Your referral offer</p>
      {err && <Notice kind="error">{err}</Notice>}
      <label className="block text-sm font-bold">What the customer gets
        <input className="input mt-1" maxLength={80} placeholder="$10 off any set of tires" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
      </label>
      <label className="block text-sm font-bold">Rules (optional)
        <input className="input mt-1" maxLength={200} placeholder="Purchase of $50 or more. One per customer." value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} />
      </label>
      <label className="block text-sm font-bold">Reward to the business that sends them ($)
        <input className="input mt-1" inputMode="decimal" value={f.payout} onChange={(e) => setF({ ...f, payout: e.target.value.replace(/[^0-9.]/g, '') })} />
      </label>
      {cents >= 100 && <p className="rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">Per customer who buys: <b>{money(cents)}</b> reward + <b>{money(fee(cents))}</b> Us In It fee (20%, at least 50¢) = <b>{money(cents + fee(cents))}</b>, taken from your ad balance. If your balance runs low, the offer pauses by itself.</p>}
      <label className="block text-sm font-bold">Customer has this many days to use it
        <input className="input mt-1" type="number" min={1} max={90} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.accepting} onChange={(e) => setF({ ...f, accepting: e.target.checked })} /> Take new partners</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Offer is on</label>
      <div className="flex gap-2">
        {offer && <button className="btn-outline flex-1" onClick={() => setOpen(false)}>Cancel</button>}
        <button className="btn-orange flex-1" onClick={save}>Save offer</button>
      </div>
    </div>
  )
}

function PartnerRow({ l, onEnd }) {
  return (
    <div className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      {l.i_send ? (
        <>
          <p>You send customers to <b>{l.other}</b> · you earn <b>{money(l.payout_cents)}</b> each</p>
          <p className="text-sm">Their deal: {l.discount}</p>
          <p className="text-sm">{l.claims} saved · {l.walk_ins} bought · you earned {money(l.paid_cents)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a className="btn-black py-2" href={`/r/${l.code}/print`} target="_blank" rel="noreferrer">🖨️ Counter sign</a>
            <button className="btn-outline py-2" onClick={() => { navigator.clipboard?.writeText(refUrl(l.code)); alert('Link copied. Text it or post it.') }}>Copy link</button>
          </div>
        </>
      ) : (
        <>
          <p><b>{l.other}</b> sends you customers · you pay {money(l.payout_cents + l.fee_cents)} each</p>
          <p className="text-sm">{l.claims} saved · {l.walk_ins} bought · paid them {money(l.paid_cents)}</p>
        </>
      )}
      <button className="mt-2 text-sm underline" onClick={onEnd}>Stop partnering</button>
    </div>
  )
}

function FindPartners({ me, offer, sugs, act }) {
  const mine = groupOf(me.category)
  const list = useMemo(() => [...sugs].sort((a, b) => {
    const ca = groupOf(a.category) === mine && a.category !== me.category ? 0 : 1
    const cb = groupOf(b.category) === mine && b.category !== me.category ? 0 : 1
    return ca - cb || (a.dist_m ?? 1e9) - (b.dist_m ?? 1e9)
  }), [sugs, mine, me.category])
  const bands = [
    ['Next door (500 ft)', list.filter((x) => x.dist_m != null && x.dist_m <= 152)],
    ['Nearby (¼ mile)', list.filter((x) => x.dist_m != null && x.dist_m > 152 && x.dist_m <= 402)],
    ['In your area', list.filter((x) => x.dist_m == null || x.dist_m > 402)],
  ].filter(([, l]) => l.length)
  return (
    <div className="card space-y-3">
      <p className="font-extrabold">🔎 Find Referral Partners</p>
      <p className="muted text-sm">Businesses near you that take referrals. Ones that go well with yours are first.</p>
      {!list.length && <p className="text-sm">No other businesses nearby yet. As more join, they show up here.</p>}
      {bands.map(([label, l]) => (
        <div key={label} className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-neutral-500">{label}</p>
          {l.slice(0, 10).map((x) => {
            const link = (x.links || [])[0]
            const goes = groupOf(x.category) === mine && x.category !== me.category
            return (
              <div key={x.id} className="rounded-xl border-2 border-neutral-200 p-3 dark:border-neutral-700">
                <p><b>{x.business_name}</b> · {x.category || 'Business'} · {feetOrMiles(x.dist_m)}{goes ? ' · ✨ goes well with you' : ''}</p>
                {x.offer ? <p className="text-sm">Their deal: {x.offer.discount} · they pay <b>{money(x.offer.payout_cents)}</b> per customer you send</p> : <p className="muted text-sm">No offer yet.</p>}
                {link ? <p className="mt-1 text-sm font-bold">{link.status === 'active' ? '🤝 Partners' : 'Asked · waiting'}</p> : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {x.offer?.accepting && <button className="btn-orange py-2" onClick={() => act('request_referral_partner', { p_other: x.id, p_i_send: true }, `Asked ${x.business_name}. You’ll see their answer here.`)}>Send them customers</button>}
                    {offer?.active && <button className="btn-outline py-2" onClick={() => act('request_referral_partner', { p_other: x.id, p_i_send: false }, `Invited ${x.business_name}.`)}>Invite them to send me customers</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ---------- Public: usinit.com/r/CODE (customer scans a partner's QR) ----------
const KEY = 'usinit_ref_claims'
const remember = (code) => { try { const l = JSON.parse(localStorage.getItem(KEY) || '[]').filter((c) => c !== code); l.unshift(code); localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))) } catch { /* storage off */ } }

export function ReferralOffer() {
  const { code } = useParams()
  const [o, setO] = useState(undefined)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { supabase.rpc('get_referral', { p_code: code }).then(({ data }) => setO(data || null)) }, [code])
  if (o === undefined) return <Spinner />
  if (!o) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">This deal isn’t available.</p></div>
  async function claim() {
    setErr(null); setBusy(true)
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code, p_device: deviceId() })
    setBusy(false)
    if (error) return setErr(error.message)
    remember(data); window.location.href = `/rc/${data}`
  }
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className="rounded-2xl border-4 border-dashed border-orange bg-orange/10 p-6 text-center">
        <p className="text-sm font-bold tracking-wide text-orange">🎟️ A DEAL FROM {String(o.from).toUpperCase()}</p>
        <p className="mt-3 text-4xl font-black leading-tight">{o.discount}</p>
        <p className="mt-2 text-lg font-bold">at {o.business}</p>
        {o.address && <p className="muted">{o.address}</p>}
        {o.terms && <p className="muted mt-3 text-sm">{o.terms}</p>}
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {o.open
        ? <button className="btn-orange w-full py-4 text-lg" onClick={claim} disabled={busy}>{busy ? 'Saving…' : 'Get my discount'}</button>
        : <Notice>This deal is paused right now. Try again later.</Notice>}
      <p className="muted text-center text-xs">Good for {o.claim_days} days after you tap. Powered by Us In It.</p>
    </div>
  )
}

// ---------- Public: usinit.com/rc/CODE (the code the customer shows; staff type the store PIN) ----------
export function ReferralClaim() {
  const { code } = useParams()
  const [c, setC] = useState(undefined)
  const [pin, setPin] = useState('')
  const [staff, setStaff] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => supabase.rpc('get_referral_claim', { p_code: code }).then(({ data }) => setC(data || null))
  useEffect(() => { load(); remember(String(code).toUpperCase()) }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  if (c === undefined) return <Spinner />
  if (!c) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">Code not found.</p></div>
  const used = !!c.redeemed_at, dead = used || c.expired || c.locked
  async function redeem() {
    setMsg(null); setBusy(true)
    const { data, error } = await supabase.rpc('redeem_referral', { p_code: code, p_pin: pin })
    setBusy(false); setPin('')
    if (error) return setMsg({ kind: 'error', text: error.message })
    if (!data.ok) return setMsg({ kind: 'error', text: data.error })
    setMsg({ kind: 'ok', text: 'Done! ✅ Give the customer their discount.' }); setStaff(false); load()
  }
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className={`rounded-2xl border-4 border-dashed p-6 text-center ${dead ? 'border-neutral-300 opacity-70' : 'border-orange bg-orange/10'}`}>
        <p className="text-sm font-bold tracking-wide text-orange">🎟️ SENT BY {String(c.from).toUpperCase()}</p>
        <p className="mt-1 text-lg font-bold">{c.business}</p>
        {c.address && <p className="muted text-sm">{c.address}</p>}
        <p className="mt-3 text-4xl font-black leading-tight">{c.text}</p>
        {c.terms && <p className="muted mt-3">{c.terms}</p>}
        <p className="mt-4 font-mono text-2xl font-bold tracking-widest">{c.code}</p>
        <p className="mt-2 text-sm">{used ? `✅ Used ${new Date(c.redeemed_at).toLocaleString()}` : c.expired ? '⌛ Expired' : c.locked ? '🔒 Locked' : `Good until ${new Date(c.expires_at).toLocaleDateString()}`}</p>
      </div>
      {msg && <Notice kind={msg.kind === 'ok' ? undefined : 'error'}>{msg.text}</Notice>}
      {!dead && (
        <div className="card space-y-3">
          <p className="font-bold">Show this screen when you pay.</p>
          {!staff ? <button className="btn-black w-full py-4 text-lg" onClick={() => setStaff(true)}>For staff: Redeem</button> : (
            <div className="space-y-3">
              <p className="text-sm"><b>Staff only:</b> after the customer buys, type your store’s 4-digit PIN. It only works once.</p>
              <input className="input text-center text-3xl tracking-[0.5em]" inputMode="numeric" maxLength={4} value={pin} autoFocus
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && redeem()} aria-label="Store PIN" />
              <button className="btn-orange w-full py-4 text-lg" onClick={redeem} disabled={busy || pin.length !== 4}>{busy ? 'Checking…' : 'Redeem'}</button>
              <button className="w-full text-sm underline" onClick={() => setStaff(false)}>Cancel</button>
            </div>
          )}
          {!c.has_pin && <p className="muted text-xs">This business hasn’t set its store PIN yet.</p>}
        </div>
      )}
      <p className="text-center text-sm"><Link to="/coupons" className="underline">My saved coupons</Link></p>
    </div>
  )
}

// ---------- Counter sign for the sending business: usinit.com/r/CODE/print ----------
export function ReferralPrint() {
  const { code } = useParams()
  const [o, setO] = useState(undefined)
  const url = refUrl(code)
  const qr = useQR(url)
  useEffect(() => { supabase.rpc('get_referral', { p_code: code }).then(({ data }) => setO(data || null)) }, [code])
  if (o === undefined || !qr) return <Spinner />
  if (!o) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">Not found.</p></div>
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="no-print mb-4 space-y-3">
        <h1 className="h1">Counter sign</h1>
        {!IS_FINAL_DOMAIN && <Notice kind="error">Test prints only. This QR code points to {new URL(SITE_URL).host}, not UsInIt.com yet.</Notice>}
        <p className="muted text-sm">Black and white. Prints sideways on one regular 8.5 x 11 sheet. Put it by your register.</p>
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{'@page { size: letter landscape; margin: 0 }'}</style>
      <div className="print-page mx-auto flex aspect-[11/8.5] w-full max-w-[11in] items-center gap-[2.5%] border border-neutral-300 bg-white p-[3%] text-black [container-type:inline-size] print:fixed print:left-0 print:top-0 print:h-[8.5in] print:w-[11in] print:max-w-none print:border-0">
        <div className="aspect-square w-[60%] shrink-0 bg-white"><img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /></div>
        <div className="flex h-full flex-1 flex-col justify-between">
          <p className="text-[4.6cqw] font-black leading-[0.95]">Scan for<br />{o.discount}</p>
          <p className="text-[2.8cqw] font-extrabold leading-tight">at {o.business}</p>
          <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
          <Verified className="text-[2.3cqw] leading-tight" />
        </div>
      </div>
    </div>
  )
}
