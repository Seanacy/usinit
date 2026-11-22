import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KEY, SUPABASE_URL, money, startCheckout, supabase, useSession, useStats } from '../lib/supabase'
import AuthBox from '../components/AuthBox'
import ZoneManager from '../components/ZoneManager'
import { CROWDS } from './Champion'
import PlugPanel from './Plug'
import StripePayouts from '../components/StripePayouts'
import { BookingManager, BusinessShares } from './Booking'
import { describeRadius } from '../components/MapPicker'
import { Notice, Spinner } from '../components/Layout'
import TonightBiz from '../components/TonightBiz'
import TrialReport from '../components/TrialReport'
import { ReferralPanel } from '../components/Referrals'
import SpotlightPanel from '../components/SpotlightPanel'
import { getRef } from '../lib/ref'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function AdForm({ advertiser, existing, prefill, onDone }) {
  const e0 = existing || prefill || {}
  const [f, setF] = useState({
    ad_type: e0.ad_type || 'standard', headline: e0.headline || '', body: e0.body || '', image_url: e0.image_url || '',
    button_text: e0.button_text ?? 'Learn more', button_url: e0.button_url || '',
    coupon_on: !!e0.coupon_text, coupon_text: e0.coupon_text || '', coupon_terms: e0.coupon_terms || '', coupon_days: e0.coupon_days || 7,
    champion_scans: e0.champion_scans || false, crowd_types: e0.crowd_types || [],
    gift_tree: e0.gift_tree || false, digital_on: e0.digital_on || false, digital_kinds: e0.digital_kinds || ['holder'], digital_cap: existing ? (e0.digital_daily_cap_cents / 100) : 10, digital_mn_only: e0.digital_mn_only || false,
    days: e0.days || [0, 1, 2, 3, 4, 5, 6], start_hour: e0.start_hour ?? 7, end_hour: e0.end_hour ?? 21,
    daily_budget: existing ? e0.daily_budget_cents / 100 : 10,
    event_name: e0.event_name || '', event_start: toLocalInput(e0.event_start), event_end: toLocalInput(e0.event_end), event_address: e0.event_address || '', ticket_url: e0.ticket_url || '',
    political_committee: e0.political_committee || '', political_address: e0.political_address || '', political_registration: e0.political_registration || '' })
  const [zoneIds, setZoneIds] = useState(e0.zone_ids || [])
  const [zones, setZones] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => {
    supabase.from('advertising_zones').select('id,name,radius_m,active,admin_off').order('created_at').then(({ data }) => {
      setZones(data || [])
      if (!existing && data?.length === 1) setZoneIds([data[0].id])
    })
  }, []) // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setErr(null)
    if (!f.headline.trim()) return setErr('Add a headline.')
    if (!zoneIds.length && !f.digital_on && !f.gift_tree) return setErr('Pick at least one zone where your ad should show, or turn on online scans or the Gift Tree.')
    if (f.button_url && !/^https?:\/\//i.test(f.button_url)) return setErr('The button link must start with https://')
    if (f.ad_type === 'event' && (!f.event_name || !f.event_start || !f.event_end)) return setErr('Add the event name, start, and end time.')
    if (f.ad_type === 'political' && (!f.political_committee || !f.political_address)) return setErr('Political ads need the committee name and address for the Minnesota disclaimer.')
    if (!f.days.length) return setErr('Pick at least one day.')
    if (f.coupon_on && !f.coupon_text.trim()) return setErr('Write your deal, like "$2 off entry", or turn the coupon off.')
    if (f.digital_on && !f.digital_kinds.length) return setErr('Pick who your online scans help: holders, creators, or both.')
    if (f.champion_scans && !f.crowd_types.length) return setErr('Pick at least one Champion crowd type, or turn Champion scans off.')
    setBusy(true)
    const row = {
      advertiser_id: advertiser.id, ad_type: f.ad_type, headline: f.headline.trim(), body: f.body.trim() || null, image_url: f.image_url.trim() || null,
      button_text: f.button_text.trim() || null, button_url: f.button_url.trim() || null, zone_ids: zoneIds, gift_tree: f.gift_tree,
      coupon_text: f.coupon_on ? f.coupon_text.trim() : null, coupon_terms: f.coupon_on ? (f.coupon_terms.trim() || null) : null, coupon_days: Math.min(90, Math.max(1, Number(f.coupon_days) || 7)),
      champion_scans: f.champion_scans, crowd_types: f.champion_scans ? f.crowd_types : [],
      digital_on: f.digital_on, digital_kinds: f.digital_kinds, digital_daily_cap_cents: Math.round(Number(f.digital_cap || 0) * 100), digital_mn_only: f.digital_on && f.digital_mn_only,
      days: f.days, start_hour: Number(f.start_hour), end_hour: Number(f.end_hour), daily_budget_cents: Math.round(Number(f.daily_budget) * 100),
    }
    if (f.ad_type === 'event') Object.assign(row, { event_name: f.event_name, event_start: new Date(f.event_start).toISOString(), event_end: new Date(f.event_end).toISOString(), event_address: f.event_address || null, ticket_url: f.ticket_url || null })
    if (f.ad_type === 'political') Object.assign(row, { political_committee: f.political_committee, political_address: f.political_address, political_registration: f.political_registration || null })
    let newId = null
    const { error } = existing
      ? await supabase.from('ads').update((({ advertiser_id, ...rest }) => rest)(row)).eq('id', existing.id)
      : await supabase.from('ads').insert(row).select('id').single().then((r) => { newId = r.data?.id; return r })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(newId)
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="h2">{existing ? 'Edit ad' : prefill ? '🚀 Boost your spotlight' : 'New ad'}</h2>
      {prefill && <Notice>We filled this in from your spotlight. Pick the zone where it should show and your daily max, then save. Ads are shorter than spotlights, so check your headline (60 letters) and line of text (150 letters).</Notice>}
      {existing && <Notice>Changing the words, picture, or link sends the ad back for a quick approval. Changing the zones, days, hours, or daily max does not.</Notice>}
      <div className="grid grid-cols-3 gap-2">
        {[['standard', 'Business'], ['event', 'Event'], ['political', 'Political']].map(([k, l]) => (
          <button type="button" key={k} onClick={() => setF({ ...f, ad_type: k })} className={f.ad_type === k ? 'btn-black' : 'btn-outline'}>{l}</button>
        ))}
      </div>
      <div><label className="label">Headline (60 max)</label><input className="input" maxLength={60} value={f.headline} onChange={set('headline')} placeholder="Fresh tacos 2 blocks away" /></div>
      <div><label className="label">One line of text (150 max)</label><input className="input" maxLength={150} value={f.body} onChange={set('body')} placeholder="Show this screen for $2 off today." /></div>
      <div><label className="label">Image link (optional)</label><input className="input" value={f.image_url} onChange={set('image_url')} placeholder="https://…" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Button text</label><input className="input" maxLength={24} value={f.button_text} onChange={set('button_text')} /></div>
        <div><label className="label">Button link</label><input className="input" value={f.button_url} onChange={set('button_url')} placeholder="https://yourshop.com" /></div>
      </div>
      <div className="space-y-3 rounded-xl border-2 border-dashed border-orange p-3">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={f.coupon_on} onChange={(e) => setF({ ...f, coupon_on: e.target.checked })} /> 🎟️ Add a coupon to this ad (recommended)</label>
        <p className="muted text-sm">People who scan can save your deal and show it at your counter. Your staff types your store PIN to use it, so you see exactly how many customers we sent you. <b>Ads with a coupon get shown more often.</b></p>
        {f.coupon_on && (
          <div className="space-y-3">
            <div><label className="label">Your deal (60 max)</label><input className="input" maxLength={60} value={f.coupon_text} onChange={set('coupon_text')} placeholder="$2 off entry tonight" /></div>
            <div><label className="label">Fine print (optional)</label><input className="input" maxLength={200} value={f.coupon_terms} onChange={set('coupon_terms')} placeholder="One per person. 21+ with ID." /></div>
            <div><label className="label">Good for how many days after it's saved?</label><input className="input w-32" type="number" min={1} max={90} value={f.coupon_days} onChange={set('coupon_days')} /></div>
            <p className="muted text-xs">No alcohol deals. Food, entry, events, and services are fine.</p>
          </div>
        )}
      </div>
      {f.ad_type === 'event' && (
        <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
          <input className="input" placeholder="Event name" value={f.event_name} onChange={set('event_name')} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-bold">Starts<input type="datetime-local" className="input" value={f.event_start} onChange={set('event_start')} /></label>
            <label className="text-sm font-bold">Ends<input type="datetime-local" className="input" value={f.event_end} onChange={set('event_end')} /></label>
          </div>
          <input className="input" placeholder="Event address" value={f.event_address} onChange={set('event_address')} />
          <input className="input" placeholder="Ticket link (optional)" value={f.ticket_url} onChange={set('ticket_url')} />
        </div>
      )}
      {f.ad_type === 'political' && (
        <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
          <p className="text-sm">Shown on the ad as: "Prepared and paid for by the [committee], [address]." Every political ad is checked before it runs. Same price for every candidate.</p>
          <input className="input" placeholder="Committee or organization name" value={f.political_committee} onChange={set('political_committee')} />
          <input className="input" placeholder="Committee address" value={f.political_address} onChange={set('political_address')} />
          <input className="input" placeholder="Registration number (if any)" value={f.political_registration} onChange={set('political_registration')} />
        </div>
      )}
      <div>
        <p className="label">Where should it show? Pick one or more of your zones.</p>
        {zones === null ? <Spinner /> : zones.length === 0 ? (
          <Notice>No zones yet. For street scans, click Cancel, then "Draw your first zone". For online-only ads, turn on "Also show online" below.</Notice>
        ) : (
          <div className="space-y-2">
            {zones.map((z) => (
              <label key={z.id} className="flex items-center gap-3 rounded-xl border border-neutral-300 p-3 dark:border-neutral-600">
                <input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={zoneIds.includes(z.id)}
                  onChange={() => setZoneIds(zoneIds.includes(z.id) ? zoneIds.filter((x) => x !== z.id) : [...zoneIds, z.id])} />
                <span><b>{z.name}</b> <span className="muted text-sm">· {describeRadius(z.radius_m)} from center{z.admin_off ? ' · turned off by Us In It' : !z.active ? ' · paused' : ''}</span></span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="label">Scan sources</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setF({ ...f, champion_scans: false })} className={!f.champion_scans ? 'btn-black' : 'btn-outline'}>Street scans only</button>
          <button type="button" onClick={() => setF({ ...f, champion_scans: true })} className={f.champion_scans ? 'btn-black' : 'btn-outline'}>Street + Champion scans</button>
        </div>
        {f.champion_scans && (
          <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <p className="text-sm">Champions share a holder's code at school, work, church, games, or online. Champion scans cost $0.25 each (street scans $0.50), at most 2 paid scans per spot per Champion code per day. Which crowds do you want?</p>
            <div className="flex flex-wrap gap-2">
              {CROWDS.map(([k, l]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, crowd_types: f.crowd_types.includes(k) ? f.crowd_types.filter((x) => x !== k) : [...f.crowd_types, k] })}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${f.crowd_types.includes(k) ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <label className="flex items-start gap-3 rounded-xl border-2 border-green-600 p-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.gift_tree} onChange={(e) => setF({ ...f, gift_tree: e.target.checked })} />
        <span><b>🎄 Sponsor the Gift Tree</b><span className="muted block text-sm">Show your ad when people scan the Us In It Gift Tree code. $0.30 per scan, and $0.25 of it buys Christmas gifts for local kids. Your daily max still applies.</span></span></label>
      <div className="space-y-2">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.digital_on} onChange={(e) => setF({ ...f, digital_on: e.target.checked })} />
          <span><b>Also show online (digital scans)</b><span className="muted block text-sm">People watching videos or livestreams scan a code and see your ad, anywhere. $0.25 per scan from holders' online codes, $0.05 per scan from content creators' codes.</span></span></label>
        {f.digital_on && (
          <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <p className="text-sm font-bold">Who should your online scans help?</p>
            <div className="flex flex-wrap gap-2">
              {[['holder', 'People in hard times (holders) · $0.25'], ['creator', 'Content creators · $0.05']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, digital_kinds: f.digital_kinds.includes(k) ? f.digital_kinds.filter((x) => x !== k) : [...f.digital_kinds, k] })}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${f.digital_kinds.includes(k) ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{l}</button>
              ))}
            </div>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.digital_mn_only} onChange={(e) => setF({ ...f, digital_mn_only: e.target.checked })} />
              <span><b>Minnesota viewers only</b><span className="muted block">You only pay for online scans from people in Minnesota. Scans from other states don't show your ad and don't cost you anything.</span></span></label>
            <label className="text-sm font-bold">Online daily max ($)<input className="input w-32" inputMode="decimal" value={f.digital_cap} onChange={(e) => setF({ ...f, digital_cap: e.target.value.replace(/[^0-9.]/g, '') })} /></label>
          </div>
        )}
      </div>
      <div>
        <p className="label">Days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <button type="button" key={d} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${f.days.includes(i) ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{d}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm font-bold">From<select className="input" value={f.start_hour} onChange={set('start_hour')}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}</select></label>
        <label className="text-sm font-bold">To<select className="input" value={f.end_hour} onChange={set('end_hour')}>{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}</select></label>
        <label className="text-sm font-bold">Daily max ($)<input className="input" inputMode="decimal" value={f.daily_budget} onChange={set('daily_budget')} /></label>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-outline" onClick={() => onDone(null)}>Cancel</button>
        <button className="btn-orange" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Send for approval'}</button>
      </div>
    </form>
  )
}

function fmtHour(h) { return h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM` }

const MONTHLY = [5000, 10000, 25000]

function AddFunds({ stats, adv }) {
  const [mode, setMode] = useState('once')
  const [amt, setAmt] = useState('50')
  const [pick, setPick] = useState(10000)
  const [other, setOther] = useState('')
  const [plan, setPlan] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const s = stats?.settings || {}
  const price = stats?.price_per_scan_cents || 50
  const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30)
  const withFee = (c) => (s.advertiser_fee_on_top === false ? c : Math.ceil((c + fixed) / (1 - pct)))
  const cents = mode === 'once' ? Math.round(Number(amt) * 100) || 0 : pick === 'other' ? (Number(other) || 0) * 100 : pick
  const total = withFee(cents)

  async function loadPlan() {
    const { data } = await supabase.from('advertiser_plans').select('*').eq('advertiser_id', adv.id).in('status', ['active', 'canceling']).order('created_at', { ascending: false }).limit(1)
    setPlan(data?.[0] ?? null)
  }
  useEffect(() => { loadPlan() }, [adv.id])

  async function pay() {
    setErr(null)
    if (cents < 1000) return setErr('The smallest amount is $10.')
    if (mode === 'monthly' && cents > 1000000) return setErr('The biggest monthly amount is $10,000.')
    setBusy(true)
    try {
      await startCheckout(mode === 'once' ? { kind: 'ad_deposit', amount_cents: cents } : { kind: 'ad_monthly', amount_cents: cents })
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  async function cancelPlan() {
    if (!window.confirm('Stop your monthly plan? Your balance stays. No more monthly charges after this month.')) return
    setErr(null); setBusy(true)
    const { data: ses } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${ses?.session?.access_token}` },
      body: JSON.stringify({ kind: 'ad_monthly_cancel' }),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setErr(out.error || "Couldn't cancel. Please try again.")
    setMsg('Your monthly plan is canceled. You won\'t be charged again.')
    loadPlan()
  }

  const tab = (id, label) => (
    <button type="button" onClick={() => { setMode(id); setErr(null) }}
      className={`flex-1 rounded-xl px-3 py-2 font-bold ${mode === id ? 'bg-black text-white dark:bg-white dark:text-black' : 'border border-neutral-300'}`}>{label}</button>
  )

  return (
    <div className="card">
      <h2 className="h2">Add funds</h2>
      {plan && (
        <div className="mt-3 rounded-xl border-2 border-orange bg-orange/10 p-3">
          <p className="font-bold">Monthly plan: {money(plan.amount_cents)} every month</p>
          <p className="muted text-sm">{plan.status === 'canceling' ? 'Canceled. No more charges after this month.' : `Adds about ${Math.floor(plan.amount_cents / price)} scans to your balance each month. Payments so far: ${plan.payments_made}.`}</p>
          {plan.status === 'active' && <button className="btn-outline mt-2 py-2" onClick={cancelPlan} disabled={busy}>Cancel monthly plan</button>}
        </div>
      )}
      {msg && <div className="mt-2"><Notice kind="ok">{msg}</Notice></div>}
      <div className="mt-3 flex gap-2">{tab('once', 'One time')}{tab('monthly', 'Every month')}</div>
      {mode === 'once' ? (
        <input className="input mt-3" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount in dollars" />
      ) : plan ? (
        <p className="muted mt-3 text-sm">You already have a monthly plan. Cancel it first if you want a different amount.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MONTHLY.map((c) => (
              <button key={c} type="button" onClick={() => setPick(c)} className={`rounded-xl px-3 py-2 font-bold ${pick === c ? 'bg-orange text-black' : 'border border-neutral-300'}`}>{money(c)}</button>
            ))}
            <button type="button" onClick={() => setPick('other')} className={`rounded-xl px-3 py-2 font-bold ${pick === 'other' ? 'bg-orange text-black' : 'border border-neutral-300'}`}>Other</button>
          </div>
          {pick === 'other' && (
            <label className="flex items-center gap-2"><span className="text-xl font-bold">$</span>
              <input className="input" inputMode="numeric" maxLength={5} placeholder="Type an amount" value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Monthly amount in dollars" />
            </label>
          )}
          <p className="muted text-sm">Charged on this same day every month. Cancel anytime. Your balance never expires.</p>
        </div>
      )}
      {cents >= 1000 && !(mode === 'monthly' && plan) && (
        <p className="mt-2 font-bold">Ad balance {money(cents)} + processing fee {money(total - cents)} = {money(total)}{mode === 'monthly' ? ' every month' : ''}<span className="muted block text-sm font-normal">≈ {Math.floor(cents / price)} scans{mode === 'monthly' ? ' a month' : ''}</span></p>
      )}
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      {!(mode === 'monthly' && plan) && (
        <button className="btn-orange mt-3 w-full" onClick={pay} disabled={busy}>{busy ? 'Opening checkout…' : mode === 'monthly' ? 'Start monthly plan' : 'Add funds'}</button>
      )}
    </div>
  )
}

// Coupons: store PIN + how many customers came in with a coupon.
function CouponPanel({ adv }) {
  const [st, setSt] = useState(null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(false)
  const load = () => supabase.rpc('my_coupon_stats').then(({ data }) => setSt(data))
  useEffect(() => { load() }, [adv?.id]) // eslint-disable-line
  async function savePin() {
    setMsg(null)
    const { error } = await supabase.rpc('set_redeem_pin', { p_pin: pin })
    if (error) return setMsg({ kind: 'error', text: error.message })
    setPin(''); setEditing(false); setMsg({ text: 'Store PIN saved. Share it with your staff.' }); load()
  }
  if (!st) return null
  return (
    <div className="card space-y-3 border-2 border-orange">
      <p className="h2">🎟️ Coupons</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-3xl font-extrabold">{st.redeemed_week}</p><p className="muted text-xs">customers this week</p></div>
        <div><p className="text-3xl font-extrabold">{st.redeemed}</p><p className="muted text-xs">customers all time</p></div>
        <div><p className="text-3xl font-extrabold">{st.saved}</p><p className="muted text-xs">coupons saved</p></div>
      </div>
      <div className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
        <p className="font-bold">Store PIN {st.has_pin ? '✅ set' : '⚠️ not set yet'}</p>
        <p className="muted text-sm">Your staff types this 4-digit PIN on the customer's phone to use a coupon. Change it anytime, like when someone leaves.</p>
        {(!st.has_pin || editing) ? (
          <div className="mt-2 flex gap-2">
            <input className="input w-32 text-center text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} aria-label="New store PIN" />
            <button className="btn-orange" disabled={pin.length !== 4} onClick={savePin}>Save PIN</button>
          </div>
        ) : <button className="btn-outline mt-2 py-2" onClick={() => setEditing(true)}>Change PIN</button>}
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {st.recent.length > 0 && (
        <div><p className="font-bold">Recent customers</p>
          <ul className="muted text-sm">{st.recent.map((r, i) => <li key={i}>{r.text} · {new Date(r.at).toLocaleString()}</li>)}</ul>
        </div>
      )}
      <p className="muted text-xs">Add a deal to any ad: tap Edit on the ad, then turn on "Add a coupon."</p>
    </div>
  )
}

export default function Advertise() {
  const session = useSession()
  const stats = useStats()
  const [params, setParams] = useSearchParams()
  const sec = params.get('tab')
  const openSec = (x) => { setParams(x ? { tab: x } : {}); window.scrollTo({ top: 0 }) }
  const [adv, setAdv] = useState(undefined)
  const [ads, setAds] = useState([])
  const [creating, setCreating] = useState(false)
  const [editingAd, setEditingAd] = useState(null)
  const [boosting, setBoosting] = useState(null)
  const [editingBiz, setEditingBiz] = useState(false)
  const [managingZones, setManagingZones] = useState(false)
  const [zoneCount, setZoneCount] = useState(0)
  const [biz, setBiz] = useState({ business_name: '', contact_name: '', phone: '' })
  const [err, setErr] = useState(null)
  const price = stats?.price_per_scan_cents || 50

  async function load() {
    const { data } = await supabase.from('advertisers').select('*').maybeSingle()
    setAdv(data ?? null)
    if (data) {
      const { data: a } = await supabase.from('ads').select('*').order('created_at', { ascending: false }); setAds(a || [])
      const { count } = await supabase.from('advertising_zones').select('id', { count: 'exact', head: true }); setZoneCount(count || 0)
    }
  }
  useEffect(() => { if (session) load() }, [session])

  async function createAdv(e) {
    e.preventDefault(); setErr(null)
    if (!biz.business_name.trim()) return setErr('Add your business name.')
    const { error } = adv
      ? await supabase.from('advertisers').update(biz).eq('id', adv.id)
      : await supabase.from('advertisers').insert({ ...biz, user_id: session.user.id, ref_code: getRef() || null })
    if (error) return setErr(error.message)
    setEditingBiz(false); load()
  }
  function startBizEdit() { setBiz({ business_name: adv.business_name || '', contact_name: adv.contact_name || '', phone: adv.phone || '' }); setErr(null); setEditingBiz(true) }
  async function setStatus(ad, status) { await supabase.from('ads').update({ status }).eq('id', ad.id); load() }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="h1">{adv ? 'My business' : 'Advertise with Us In It'}</h1>
      {!adv && <p className="muted mt-2">Draw the zone around your business. Pay {money(price)} only for real scans by real people standing in your zone. No bidding, same price for everyone.</p>}
      {(session === null || adv === null) && (
        <Link to="/spotlight" className="group mt-5 flex flex-col gap-3 rounded-2xl border-2 border-orange bg-orange/10 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-orange/20 hover:shadow-md sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-orange">New · Free</p>
            <p className="text-lg font-extrabold">Get your business in the Community Spotlight</p>
            <p className="muted text-sm">Show off a special product or service for free. Boost it later if you want more views.</p>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange px-5 py-3 font-extrabold text-black group-hover:brightness-110">See how →</span>
        </Link>
      )}
      <div className="mt-6">
        {session === undefined ? <Spinner /> : !session ? <AuthBox title="Business account" intro="Create an account to set up your ads." redirectPath="/advertise" role="business" />
          : adv === undefined ? <Spinner />
          : (adv === null || editingBiz) ? (
            <form onSubmit={createAdv} className="card space-y-3">
              <h2 className="h2">{adv ? 'Edit business info' : 'Your business'}</h2>
              <input className="input" placeholder="Business or nonprofit name" value={biz.business_name} onChange={(e) => setBiz({ ...biz, business_name: e.target.value })} />
              <input className="input" placeholder="Your name" value={biz.contact_name} onChange={(e) => setBiz({ ...biz, contact_name: e.target.value })} />
              <input className="input" placeholder="Phone (optional)" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
              {!adv && <p className="muted text-sm">By continuing you agree to the Advertiser Agreement. Not allowed: payday loans, gambling, alcohol, cannabis, vape, adult content. Bars and breweries can promote food and events, with no alcohol in the ad.</p>}
              {err && <Notice kind="error">{err}</Notice>}
              <div className="flex gap-2">
                {adv && <button type="button" className="btn-outline flex-1" onClick={() => setEditingBiz(false)}>Cancel</button>}
                <button className="btn-orange flex-1">{adv ? 'Save changes' : 'Create business account'}</button>
              </div>
            </form>
          ) : managingZones ? (
            <div className="space-y-4">
              <button className="btn-outline w-full" onClick={() => { setManagingZones(false); load() }}>← Back to my ads</button>
              <ZoneManager advertiser={adv} />
              <button className="btn-outline w-full" onClick={() => { setManagingZones(false); load() }}>← Back to my ads</button>
            </div>
          ) : (creating || editingAd || boosting) ? (
            <AdForm advertiser={adv} existing={editingAd}
              prefill={boosting ? { headline: (boosting.headline || '').slice(0, 60), body: (boosting.body || '').slice(0, 150), image_url: boosting.image_url || '', button_text: boosting.button_text || 'Learn more', button_url: boosting.button_url || '' } : null}
              onDone={async (newId) => {
                if (boosting && newId) await supabase.rpc('link_spotlight_boost', { p_id: boosting.id, p_ad: newId })
                setCreating(false); setEditingAd(null); setBoosting(null); load()
              }} />
          ) : (
            <div className="space-y-4">
              {params.get('paid') && <Notice kind="ok">Payment received. Your balance updates in a few seconds. Refresh if you don't see it.</Notice>}
              {adv.status === 'pending' && <Notice>We're checking your business. You can set everything up now. Your ads start once we approve you.</Notice>}
              {!sec ? (
                <>
                  <div className="card flex items-center justify-between gap-2">
                    <div>
                      <p className="text-2xl font-extrabold">{adv.business_name}</p>
                      <p className="text-lg">Ad money: <b>{money(adv.balance_cents)}</b> <span className="muted text-sm">(about {Math.floor(adv.balance_cents / price)} scans)</span></p>
                    </div>
                    <button className="btn-outline shrink-0 py-2" onClick={startBizEdit}>Edit</button>
                  </div>
                  <StartHere steps={[
                    ['Draw your zone', zoneCount > 0, () => setManagingZones(true)],
                    ['Add ad money', adv.balance_cents > 0, () => openSec('money')],
                    ['Make your first ad', ads.some((x) => x.ad_type !== 'outreach'), () => openSec('ads')],
                    ...('redeem_pin_hash' in adv ? [['Set your store PIN', !!adv.redeem_pin_hash, () => openSec('coupons')]] : []),
                  ]} />
                  <div className="grid grid-cols-2 gap-3">
                    <Tile icon="📢" title="My ads" sub="Make ads. Draw zones." onClick={() => openSec('ads')} />
                    <Tile icon="💵" title="My money" sub="Add money. Cash out." onClick={() => openSec('money')} />
                    <Tile icon="🎟️" title="Coupons" sub="Deals + store PIN" onClick={() => openSec('coupons')} />
                    <Tile icon="🤝" title="Referral Partners" sub="Send customers. Get paid." to="/partners" />
                    <Tile icon="🌙" title="Tonight listing" sub="Your specials page" onClick={() => openSec('tonight')} />
                    <Tile icon="⭐" title="Free Spotlight" sub="Show off for free" onClick={() => openSec('spotlight')} />
                    <Tile icon="📅" title="Bookings" sub="Let people book you" onClick={() => openSec('bookings')} />
                    <Tile icon="🔌" title="The Plug" sub="Carry other shops' codes" onClick={() => openSec('plug')} />
                  </div>
                </>
              ) : (
                <>
                  <button className="btn-black w-full py-4 text-lg" onClick={() => openSec(null)}>← Back</button>
                  {sec === 'money' && (
                    <>
                      <h2 className="h2">💵 My money</h2>
                      <p className="muted -mt-2"><b>Ad money</b> pays for scans and deals. <b>Earnings</b> is money you made, and you can cash it out.</p>
                      <div className="card"><p className="muted text-sm">Ad money</p><p className="text-3xl font-extrabold">{money(adv.balance_cents)}</p><p className="muted text-xs">About {Math.floor(adv.balance_cents / price)} scans · {ads.reduce((x, y) => x + y.views, 0)} scans so far · {ads.reduce((x, y) => x + y.clicks, 0)} button taps</p></div>
                      <AddFunds stats={stats} adv={adv} />
                      {adv.status === 'approved'
                        ? <StripePayouts kind="business" title="Earnings (bookings, The Plug, Referral Partners)" handNote="Money you earn lands here. Card fees for your deposits come out of your share." />
                        : <div className="card"><p className="muted text-sm">Earnings</p><p className="text-3xl font-extrabold">$0.00</p><p className="muted text-xs">Cash-outs open once Us In It approves your business.</p></div>}
                    </>
                  )}
                  {sec === 'coupons' && <><h2 className="h2">🎟️ Coupons</h2><CouponPanel adv={adv} /></>}
                  {sec === 'tonight' && <TonightBiz adv={adv} />}
                  {sec === 'spotlight' && <><h2 className="h2">⭐ Free Spotlight</h2><SpotlightPanel adv={adv} onBoost={(x) => { setBoosting(x); window.scrollTo({ top: 0, behavior: 'smooth' }) }} /></>}
                  {sec === 'bookings' && <><h2 className="h2">📅 Bookings</h2><BookingManager adv={adv} /></>}
                  {sec === 'plug' && <><h2 className="h2">🔌 The Plug</h2><p className="muted">Carry another business's QR code at your place. Get paid when it brings them a customer.</p><BusinessShares /><PlugPanel adv={adv} ads={ads} reloadAds={load} /></>}
                  {sec === 'ads' && (
                    <>
                      <h2 className="h2">📢 My ads</h2>
              <div className="card flex flex-wrap items-center justify-between gap-2">
                <span><b>Your zones:</b> {zoneCount}<span className="muted block text-sm">The areas where your ads show, with live scan counts.</span></span>
                <button className="btn-black py-2" onClick={() => setManagingZones(true)}>{zoneCount ? 'Add or edit zones' : 'Draw your first zone'}</button>
              </div>
              <button className="btn-black w-full" onClick={() => setCreating(true)}>Create a new ad</button>
              <h2 className="h2 pt-2">Your ads</h2>
              {ads.filter((a) => a.ad_type !== 'outreach').map((a) => (
                <div key={a.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold">{a.headline}</p>
                      <p className="muted text-sm">{a.ad_type} · {(a.zone_ids || []).length} zone{(a.zone_ids || []).length === 1 ? '' : 's'} · {a.views} paid scans · {a.clicks} taps · cost {money(a.views * price)}</p>
                      {a.coupon_text && <p className="text-sm font-bold">🎟️ {a.coupon_text}</p>}
                    </div>
                    <span className={`pill ${a.status === 'active' ? 'bg-green-100 text-green-800' : a.status === 'pending' ? 'bg-orange/20 text-ink dark:text-white' : 'bg-neutral-200 text-neutral-700'}`}>{a.status === 'pending' ? 'waiting for approval' : a.status}</span>
                  </div>
                  {a.trial_started_at && <TrialReport adId={a.id} />}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-black py-2" onClick={() => setEditingAd(a)}>Edit</button>
                    {a.status === 'active' && <button className="btn-outline py-2" onClick={() => setStatus(a, 'paused')}>Pause</button>}
                    {a.status === 'paused' && a.approved && <button className="btn-orange py-2" onClick={() => setStatus(a, 'active')}>Resume</button>}
                  </div>
                </div>
              ))}
                    </>
                  )}
                  <button className="btn-outline w-full" onClick={() => openSec(null)}>← Back</button>
                </>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

function Tile({ icon, title, sub, onClick, to }) {
  const cls = 'card block w-full p-4 text-left active:scale-[0.98]'
  const inner = <><span className="block text-3xl">{icon}</span><span className="mt-1 block text-lg font-extrabold leading-tight">{title}</span><span className="muted block text-sm">{sub}</span></>
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

function StartHere({ steps }) {
  const left = steps.filter(([, done]) => !done)
  if (!left.length) return null
  return (
    <div className="card space-y-2 border-2 border-orange">
      <p className="text-lg font-extrabold">Start here ({steps.length - left.length} of {steps.length} done)</p>
      {steps.map(([label, done, go]) => (
        <button key={label} type="button" disabled={done} onClick={go}
          className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-lg font-bold ${done ? 'border-green-300 bg-green-50 text-green-900' : 'border-neutral-300 dark:border-neutral-600'}`}>
          <span>{done ? '✅' : '⬜'} {label}</span>{!done && <span>→</span>}
        </button>
      ))}
    </div>
  )
}
