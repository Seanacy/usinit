import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deviceId, money, supabase, useSession, IS_FINAL_DOMAIN, SITE_URL } from '../lib/supabase'
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

const walk = (m) => (m == null ? '' : m < 120 ? '🚶 Next door' : `🚶 ${Math.max(1, Math.round(m / 80))} min walk`)
const PAYS = [200, 500, 1000]

// Small card on the Advertise page that opens the Partners page.
export function ReferralPanel() {
  return (
    <Link to="/partners" className="card block border-2 border-orange">
      <p className="text-xl font-extrabold">🤝 Referral Partners →</p>
      <p className="mt-1">Send customers to shops near you. Get paid when they buy.</p>
    </Link>
  )
}

// usinit.com/partners — made simple: 3 big tabs, plain words, big buttons.
export function PartnersPage() {
  const session = useSession()
  const [d, setD] = useState(undefined)
  const [sugs, setSugs] = useState([])
  const [tab, setTab] = useState('find')
  const [msg, setMsg] = useState(null)
  const [setup, setSetup] = useState(false)
  async function load() {
    const [{ data }, { data: s }] = await Promise.all([supabase.rpc('my_referrals'), supabase.rpc('referral_suggestions')])
    setD(data || null); setSugs(s || [])
  }
  useEffect(() => { if (session) load(); else if (session === null) setD(null) }, [session]) // eslint-disable-line react-hooks/exhaustive-deps
  if (session === undefined || d === undefined) return <Spinner />
  if (!session) return <Gate text="Log in with your business account to use Referral Partners." />
  if (!d) return <Gate text="Make a business account first. It's free." />
  async function act(fn, args, ok) {
    setMsg(null)
    const { error } = await supabase.rpc(fn, args)
    if (error) setMsg({ kind: 'error', text: error.message }); else if (ok) setMsg({ kind: 'ok', text: ok })
    load()
  }
  const needSpot = !d.me.address || !d.me.category
  const waiting = d.links.filter((l) => l.status === 'requested' && ((l.requested_by === 'owner') === l.i_send))
  const partners = d.links.filter((l) => l.status === 'active')
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div>
        <h1 className="h1">🤝 Referral Partners</h1>
        <p className="text-lg">Send customers to shops near you. <b>Get paid when they buy.</b></p>
      </div>
      {!d.me.approved && <Notice>We’re still checking your business. You can set up now. It turns on when we approve you.</Notice>}
      {(needSpot || setup) ? <SpotStep me={d.me} onDone={() => { setSetup(false); load() }} /> : (
        <>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <div className="grid grid-cols-3 gap-2">
            {[['find', '🔎', 'Find shops'], ['mine', '🤝', `My partners${partners.length ? ` (${partners.length})` : ''}`], ['deal', '🎟️', 'My deal']].map(([id, icon, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`relative rounded-2xl border-2 px-2 py-3 text-center font-extrabold ${tab === id ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <span className="block text-2xl">{icon}</span>{label}
                {id === 'mine' && waiting.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 text-sm text-white">{waiting.length}</span>}
              </button>
            ))}
          </div>
          {tab === 'find' && <FindTab me={d.me} offer={d.offer} sugs={sugs} act={act} goDeal={() => setTab('deal')} />}
          {tab === 'mine' && <MineTab waiting={waiting} partners={partners} act={act} goFind={() => setTab('find')} />}
          {tab === 'deal' && <DealTab me={d.me} offer={d.offer} onDone={load} />}
          <p className="text-center text-sm">📍 {d.me.address} · {d.me.category} · <button className="underline" onClick={() => setSetup(true)}>Change</button></p>
        </>
      )}
      <p className="text-center text-sm"><Link to="/advertise" className="underline">← Back to my business page</Link></p>
    </div>
  )
}

function Gate({ text }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <p className="h2">🤝 Referral Partners</p>
      <p className="text-lg">{text}</p>
      <Link to="/advertise" className="btn-orange block w-full py-4 text-lg">Go to my business page</Link>
    </div>
  )
}

// Step: where is your shop + what kind of shop (big tap tiles)
function SpotStep({ me, onDone }) {
  const [address, setAddress] = useState(me.address || '')
  const [group, setGroup] = useState(me.category ? groupOf(me.category) : '')
  const [category, setCategory] = useState(me.category || '')
  const [err, setErr] = useState(null)
  async function save() {
    setErr(null)
    if (address.trim().length < 6) return setErr('Type your shop’s street address.')
    if (!category) return setErr('Tap what kind of shop you are.')
    const { error } = await supabase.rpc('set_business_location', { p_address: address, p_category: category, p_on: true })
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="card space-y-4">
      <p className="text-xl font-extrabold">1. Where is your shop?</p>
      <input className="input text-lg" placeholder="123 Main St, Minneapolis" value={address} onChange={(e) => setAddress(e.target.value)} />
      <p className="text-xl font-extrabold">2. What kind of shop?</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(GROUPS).map((g) => (
          <button key={g} type="button" onClick={() => { setGroup(g); if (GROUPS[g].length === 1) setCategory(GROUPS[g][0]); else setCategory('') }}
            className={`rounded-xl border-2 py-3 font-bold ${group === g ? 'border-orange bg-orange/15' : 'border-neutral-300 dark:border-neutral-600'}`}>{g}</button>
        ))}
      </div>
      {group && GROUPS[group].length > 1 && (
        <div className="flex flex-wrap gap-2">
          {GROUPS[group].map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`rounded-full border-2 px-4 py-2 font-bold ${category === c ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>{c}</button>
          ))}
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-orange w-full py-4 text-lg" onClick={save}>Save</button>
      <p className="muted text-sm">Other shops near you will see your shop’s name, what kind of shop it is, and how far away you are. Not your exact address.</p>
    </div>
  )
}

function FindTab({ me, offer, sugs, act, goDeal }) {
  const [all, setAll] = useState(false)
  const mine = groupOf(me.category)
  const goes = (x) => groupOf(x.category) === mine && x.category !== me.category
  const list = useMemo(() => [...sugs].filter((x) => all || goes(x) || (x.dist_m != null && x.dist_m <= 402))
    .sort((a, b) => (goes(a) ? 0 : 1) - (goes(b) ? 0 : 1) || (a.dist_m ?? 1e9) - (b.dist_m ?? 1e9)), [sugs, all]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me.approved) return <Notice>You’ll see shops here once we approve your business.</Notice>
  return (
    <div className="space-y-3">
      <p className="text-lg"><b>Pick a shop. Put their QR code by your register.</b> When your customer buys there, you get paid.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAll(false)} className={`rounded-full border-2 px-4 py-2 font-bold ${!all ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>Best for me</button>
        <button type="button" onClick={() => setAll(true)} className={`rounded-full border-2 px-4 py-2 font-bold ${all ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>All shops</button>
      </div>
      {!list.length && <div className="card text-center"><p className="text-lg font-bold">No shops near you yet.</p><p className="muted">Tap “All shops,” or check back. New shops join all the time.</p></div>}
      {list.slice(0, 20).map((x) => {
        const link = (x.links || [])[0]
        return (
          <div key={x.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xl font-extrabold">{x.business_name}</p>
                <p className="text-sm">{x.category || 'Shop'} {x.dist_m != null && `· ${walk(x.dist_m)}`}{goes(x) ? ' · ✨ Good match' : ''}</p>
              </div>
            </div>
            {x.offer ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-neutral-100 p-2 dark:bg-neutral-800"><p className="text-xs font-bold">YOUR CUSTOMER GETS</p><p className="font-extrabold">{x.offer.discount}</p></div>
                <div className="rounded-xl bg-green-50 p-2 text-green-900"><p className="text-xs font-bold">YOU GET</p><p className="text-2xl font-extrabold">{money(x.offer.payout_cents)}</p><p className="text-xs">each time</p></div>
              </div>
            ) : <p className="muted text-sm">They don’t have a deal yet.</p>}
            {link ? <p className="rounded-xl bg-neutral-100 p-3 text-center font-bold dark:bg-neutral-800">{link.status === 'active' ? '🤝 You’re partners. See “My partners.”' : '⏳ Asked. Waiting for them to say yes.'}</p> : (
              <>
                {x.offer?.accepting && <button type="button" className="btn-orange w-full py-4 text-lg" onClick={() => act('request_referral_partner', { p_other: x.id, p_i_send: true }, `Asked ${x.business_name}! We’ll show their answer in “My partners.”`)}>Host their QR</button>}
                {offer?.active && <button type="button" className="btn-outline w-full py-3" onClick={() => act('request_referral_partner', { p_other: x.id, p_i_send: false }, `Asked ${x.business_name} to host your QR.`)}>Ask them to host my QR</button>}
              </>
            )}
          </div>
        )
      })}
      {!offer && <button type="button" className="card block w-full text-left" onClick={goDeal}><p className="font-extrabold">Want shops to send customers to you too? →</p><p className="text-sm">Make your deal in “My deal.”</p></button>}
    </div>
  )
}

function MineTab({ waiting, partners, act, goFind }) {
  return (
    <div className="space-y-3">
      {waiting.map((l) => (
        <div key={l.id} className="card space-y-2 border-2 border-orange">
          <p className="text-sm font-bold text-orange">📥 NEEDS YOUR ANSWER</p>
          {l.i_send
            ? <p className="text-lg"><b>{l.other}</b> wants you to host their QR. You get <b>{money(l.payout_cents)}</b> each time your customer buys there.</p>
            : <p className="text-lg"><b>{l.other}</b> wants to host your QR. You pay <b>{money(l.payout_cents + l.fee_cents)}</b> each time they send you a customer who buys.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-orange py-4 text-lg" onClick={() => act('respond_referral_partner', { p_id: l.id, p_action: 'yes' }, `You and ${l.other} are partners! 🤝`)}>Yes</button>
            <button type="button" className="btn-outline py-4 text-lg" onClick={() => act('respond_referral_partner', { p_id: l.id, p_action: 'no' })}>No</button>
          </div>
        </div>
      ))}
      {!partners.length && !waiting.length && (
        <div className="card space-y-3 text-center"><p className="text-lg font-bold">No partners yet.</p><button type="button" className="btn-orange w-full py-4 text-lg" onClick={goFind}>🔎 Find shops</button></div>
      )}
      {partners.map((l) => (
        <div key={l.id} className="card space-y-2">
          {l.i_send ? (
            <>
              <p className="text-sm font-bold text-green-700">YOU HOST THEIR QR</p>
              <p className="text-xl font-extrabold">{l.other}</p>
              <p>{l.walk_ins} {l.walk_ins === 1 ? 'person' : 'people'} bought. <b>You earned {money(l.paid_cents)}.</b></p>
              <a className="btn-orange block w-full py-4 text-center text-lg" href={`/r/${l.code}/print`} target="_blank" rel="noreferrer">🖨️ Print the QR sign</a>
              <button type="button" className="btn-outline w-full py-3" onClick={() => { navigator.clipboard?.writeText(refUrl(l.code)); alert('Link copied. You can text it or post it.') }}>📋 Copy the link</button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-orange">THEY HOST YOUR QR</p>
              <p className="text-xl font-extrabold">{l.other}</p>
              <p>{l.walk_ins} {l.walk_ins === 1 ? 'person' : 'people'} came in and bought. You paid {money(l.paid_cents + l.walk_ins * l.fee_cents)}.</p>
            </>
          )}
          <button type="button" className="w-full text-sm underline" onClick={() => window.confirm(`Stop partnering with ${l.other}?`) && act('respond_referral_partner', { p_id: l.id, p_action: 'end' })}>Stop partnering</button>
        </div>
      ))}
    </div>
  )
}

function DealTab({ me, offer, onDone }) {
  const [edit, setEdit] = useState(!offer)
  const [f, setF] = useState({ discount: offer?.discount || '', terms: offer?.terms || '', pay: offer?.payout_cents || 500, other: '', days: offer?.claim_days || 30, active: offer?.active ?? true })
  const [err, setErr] = useState(null)
  const cents = f.pay === 'other' ? Math.round(Number(f.other) * 100) || 0 : f.pay
  async function save() {
    setErr(null)
    if (f.discount.trim().length < 3) return setErr('Write what the customer gets.')
    if (cents < 100) return setErr('Pay at least $1.')
    if (hasAlcohol(f.discount) || hasAlcohol(f.terms)) return setErr('Deals can’t mention alcohol.')
    const { error } = await supabase.rpc('save_referral_offer', { p_discount: f.discount, p_terms: f.terms, p_payout_cents: cents, p_claim_days: Number(f.days), p_accepting: true, p_active: f.active })
    if (error) return setErr(error.message)
    setEdit(false); onDone()
  }
  if (!me.approved) return <Notice>You can make your deal once we approve your business.</Notice>
  const low = offer && me.balance_cents < offer.payout_cents + offer.fee_cents
  if (!edit && offer) {
    return (
      <div className="card space-y-3">
        <p className="text-sm font-bold">YOUR DEAL</p>
        <p className="text-3xl font-black">{offer.discount}</p>
        {offer.terms && <p className="muted">{offer.terms}</p>}
        <p className="text-lg">Each time a shop sends you a customer who buys, you pay <b>{money(offer.payout_cents + offer.fee_cents)}</b>.</p>
        <p className="muted text-sm">That’s {money(offer.payout_cents)} to the shop + {money(offer.fee_cents)} to Us In It. It comes out of your ad balance.</p>
        <p className="font-bold">{offer.active ? '✅ Deal is on' : '⏸️ Deal is off'}</p>
        {low && <Notice kind="error">Your balance is too low, so your deal is paused. Add money on your business page.</Notice>}
        {!me.has_pin && <Notice kind="error">Set your 4-digit store PIN on your business page (Coupons box). Your staff need it.</Notice>}
        <button type="button" className="btn-black w-full py-4 text-lg" onClick={() => setEdit(true)}>Change my deal</button>
      </div>
    )
  }
  return (
    <div className="card space-y-4">
      <p className="text-sm">Make a deal so other shops can send you customers. Skip this if you only want to host other shops’ QR codes.</p>
      <label className="block"><span className="text-xl font-extrabold">1. What does the customer get?</span>
        <input className="input mt-2 text-lg" maxLength={80} placeholder="$10 off any set of tires" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
      </label>
      <div>
        <p className="text-xl font-extrabold">2. What do you pay the shop that sent them?</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PAYS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, pay: c })} className={`rounded-xl border-2 py-3 text-lg font-extrabold ${f.pay === c ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>{money(c).replace('.00', '')}</button>)}
          <button type="button" onClick={() => setF({ ...f, pay: 'other' })} className={`rounded-xl border-2 py-3 font-bold ${f.pay === 'other' ? 'border-orange bg-orange text-ink' : 'border-neutral-300'}`}>Other</button>
        </div>
        {f.pay === 'other' && <input className="input mt-2 text-lg" inputMode="decimal" placeholder="Amount in dollars, like 7.50" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value.replace(/[^0-9.]/g, '') })} />}
        {cents >= 100 && <p className="mt-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">You pay <b>{money(cents + fee(cents))}</b> per customer who buys: {money(cents)} to the shop + {money(fee(cents))} to Us In It.</p>}
      </div>
      <label className="block"><span className="font-bold">Any rules? (you can skip this)</span>
        <input className="input mt-1" maxLength={200} placeholder="Spend $50 or more. One per customer." value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} />
      </label>
      {offer && <label className="flex items-center gap-2 text-lg"><input type="checkbox" className="h-6 w-6" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Deal is on</label>}
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-orange w-full py-4 text-lg" onClick={save}>Save my deal</button>
      {offer && <button type="button" className="w-full underline" onClick={() => setEdit(false)}>Cancel</button>}
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
