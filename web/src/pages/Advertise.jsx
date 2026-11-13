import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { money, startCheckout, supabase, useSession, useStats } from '../lib/supabase'
import AuthBox from '../components/AuthBox'
import ZoneManager from '../components/ZoneManager'
import { CROWDS } from './Champion'
import PlugPanel from './Plug'
import { BookingManager, BusinessShares } from './Booking'
import { describeRadius } from '../components/MapPicker'
import { Notice, Spinner } from '../components/Layout'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function AdForm({ advertiser, existing, onDone }) {
  const e0 = existing || {}
  const [f, setF] = useState({
    ad_type: e0.ad_type || 'standard', headline: e0.headline || '', body: e0.body || '', image_url: e0.image_url || '',
    button_text: e0.button_text ?? 'Learn more', button_url: e0.button_url || '',
    champion_scans: e0.champion_scans || false, crowd_types: e0.crowd_types || [],
    digital_on: e0.digital_on || false, digital_kinds: e0.digital_kinds || ['holder'], digital_cap: existing ? (e0.digital_daily_cap_cents / 100) : 10,
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
    if (!zoneIds.length && !f.digital_on) return setErr('Pick at least one zone where your ad should show, or turn on online (digital) scans.')
    if (f.button_url && !/^https?:\/\//i.test(f.button_url)) return setErr('The button link must start with https://')
    if (f.ad_type === 'event' && (!f.event_name || !f.event_start || !f.event_end)) return setErr('Add the event name, start, and end time.')
    if (f.ad_type === 'political' && (!f.political_committee || !f.political_address)) return setErr('Political ads need the committee name and address for the Minnesota disclaimer.')
    if (!f.days.length) return setErr('Pick at least one day.')
    if (f.digital_on && !f.digital_kinds.length) return setErr('Pick who your online scans help: holders, creators, or both.')
    if (f.champion_scans && !f.crowd_types.length) return setErr('Pick at least one Champion crowd type, or turn Champion scans off.')
    setBusy(true)
    const row = {
      advertiser_id: advertiser.id, ad_type: f.ad_type, headline: f.headline.trim(), body: f.body.trim() || null, image_url: f.image_url.trim() || null,
      button_text: f.button_text.trim() || null, button_url: f.button_url.trim() || null, zone_ids: zoneIds,
      days: f.days, start_hour: Number(f.start_hour), end_hour: Number(f.end_hour), daily_budget_cents: Math.round(Number(f.daily_budget) * 100),
    }
    if (f.ad_type === 'event') Object.assign(row, { event_name: f.event_name, event_start: new Date(f.event_start).toISOString(), event_end: new Date(f.event_end).toISOString(), event_address: f.event_address || null, ticket_url: f.ticket_url || null })
    if (f.ad_type === 'political') Object.assign(row, { political_committee: f.political_committee, political_address: f.political_address, political_registration: f.political_registration || null })
    const { error } = existing
      ? await supabase.from('ads').update((({ advertiser_id, ...rest }) => rest)(row)).eq('id', existing.id)
      : await supabase.from('ads').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="h2">{existing ? 'Edit ad' : 'New ad'}</h2>
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
      <div className="space-y-2">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.digital_on} onChange={(e) => setF({ ...f, digital_on: e.target.checked })} />
          <span><b>Also show online (digital scans)</b><span className="muted block text-sm">People watching videos or livestreams scan a code and see your ad, anywhere. $0.25 per scan.</span></span></label>
        {f.digital_on && (
          <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <p className="text-sm font-bold">Who should your online scans help?</p>
            <div className="flex flex-wrap gap-2">
              {[['holder', 'People in hard times (holders)'], ['creator', 'Content creators']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, digital_kinds: f.digital_kinds.includes(k) ? f.digital_kinds.filter((x) => x !== k) : [...f.digital_kinds, k] })}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${f.digital_kinds.includes(k) ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{l}</button>
              ))}
            </div>
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
        <button type="button" className="btn-outline" onClick={onDone}>Cancel</button>
        <button className="btn-orange" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Send for approval'}</button>
      </div>
    </form>
  )
}

function fmtHour(h) { return h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM` }

function AddFunds({ stats }) {
  const [amt, setAmt] = useState('50')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const s = stats?.settings || {}
  const cents = Math.round(Number(amt) * 100) || 0
  const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30)
  const total = s.advertiser_fee_on_top === false ? cents : Math.ceil((cents + fixed) / (1 - pct))
  async function pay() {
    setErr(null)
    if (cents < 1000) return setErr('Add at least $10.')
    setBusy(true)
    try { await startCheckout({ kind: 'ad_deposit', amount_cents: cents }) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="card">
      <h2 className="h2">Add funds</h2>
      <input className="input mt-3" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount in dollars" />
      {cents >= 1000 && <p className="mt-2 font-bold">Ad balance {money(cents)} + processing fee {money(total - cents)} = {money(total)}</p>}
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <button className="btn-orange mt-3 w-full" onClick={pay} disabled={busy}>{busy ? 'Opening checkout…' : 'Add funds'}</button>
    </div>
  )
}

export default function Advertise() {
  const session = useSession()
  const stats = useStats()
  const [params] = useSearchParams()
  const [adv, setAdv] = useState(undefined)
  const [ads, setAds] = useState([])
  const [creating, setCreating] = useState(false)
  const [editingAd, setEditingAd] = useState(null)
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
      : await supabase.from('advertisers').insert({ ...biz, user_id: session.user.id })
    if (error) return setErr(error.message)
    setEditingBiz(false); load()
  }
  function startBizEdit() { setBiz({ business_name: adv.business_name || '', contact_name: adv.contact_name || '', phone: adv.phone || '' }); setErr(null); setEditingBiz(true) }
  async function setStatus(ad, status) { await supabase.from('ads').update({ status }).eq('id', ad.id); load() }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="h1">Advertise with Us In It</h1>
      <p className="muted mt-2">Draw the zone around your business. Pay {money(price)} only for real scans by real people standing in your zone. No bidding, same price for everyone.</p>
      <div className="mt-6">
        {session === undefined ? <Spinner /> : !session ? <AuthBox title="Business account" intro="Create an account to set up your ads." redirectPath="/advertise" role="business" />
          : adv === undefined ? <Spinner />
          : (adv === null || editingBiz) ? (
            <form onSubmit={createAdv} className="card space-y-3">
              <h2 className="h2">{adv ? 'Edit business info' : 'Your business'}</h2>
              <input className="input" placeholder="Business or nonprofit name" value={biz.business_name} onChange={(e) => setBiz({ ...biz, business_name: e.target.value })} />
              <input className="input" placeholder="Your name" value={biz.contact_name} onChange={(e) => setBiz({ ...biz, contact_name: e.target.value })} />
              <input className="input" placeholder="Phone (optional)" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
              {!adv && <p className="muted text-sm">By continuing you agree to the Advertiser Agreement. Not allowed: payday loans, gambling, alcohol, cannabis, vape, adult content.</p>}
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
          ) : (creating || editingAd) ? <AdForm advertiser={adv} existing={editingAd} onDone={() => { setCreating(false); setEditingAd(null); load() }} /> : (
            <div className="space-y-4">
              {params.get('paid') && <Notice kind="ok">Payment received. Your balance updates in a few seconds. Refresh if you don't see it.</Notice>}
              {adv.status === 'pending' && <Notice>Your business account is waiting for approval. You can add funds and create ads now. They start running once approved.</Notice>}
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="muted text-sm">Ad balance</p><p className="text-3xl font-extrabold">{money(adv.balance_cents)}</p><p className="muted text-xs">≈ {Math.floor(adv.balance_cents / price)} scans</p></div>
                <div className="card"><p className="muted text-sm">Total scans</p><p className="text-3xl font-extrabold">{ads.reduce((a, x) => a + x.views, 0)}</p><p className="muted text-xs">{ads.reduce((a, x) => a + x.clicks, 0)} button taps (ads + outreach)</p></div>
              </div>
              <div className="card flex items-center justify-between gap-2">
                <span><b>{adv.business_name}</b>{adv.contact_name ? ` · ${adv.contact_name}` : ''}{adv.phone ? ` · ${adv.phone}` : ''}</span>
                <button className="btn-black py-2" onClick={startBizEdit}>Edit</button>
              </div>
              <AddFunds stats={stats} />
              <BookingManager adv={adv} />
              <BusinessShares />
              <PlugPanel adv={adv} ads={ads} reloadAds={load} />
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
                      <p className="muted text-sm">{a.ad_type} · {(a.zone_ids || []).length} zone{(a.zone_ids || []).length === 1 ? '' : 's'} · {a.views} scans · {a.clicks} taps · cost {money(a.views * price)}</p>
                    </div>
                    <span className={`pill ${a.status === 'active' ? 'bg-green-100 text-green-800' : a.status === 'pending' ? 'bg-orange/20 text-ink dark:text-white' : 'bg-neutral-200 text-neutral-700'}`}>{a.status === 'pending' ? 'waiting for approval' : a.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-black py-2" onClick={() => setEditingAd(a)}>Edit</button>
                    {a.status === 'active' && <button className="btn-outline py-2" onClick={() => setStatus(a, 'paused')}>Pause</button>}
                    {a.status === 'paused' && a.approved && <button className="btn-orange py-2" onClick={() => setStatus(a, 'active')}>Resume</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
