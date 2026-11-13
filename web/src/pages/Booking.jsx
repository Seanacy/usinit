import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { SITE_URL, money, supabase, startCheckout } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import { BookingSign, useQR } from '../components/Printables'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TZ = 'America/Chicago'
export const bookingUrl = (slug, via) => `${SITE_URL}/b/${slug}${via ? `?via=${via}` : ''}`
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const minToLabel = (m) => { const h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 && h < 24 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${ap}` }
const TIMES = Array.from({ length: 97 }, (_, i) => i * 15)
const fmtWhen = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const dollars = (c) => (c / 100).toFixed(2).replace(/\.00$/, '')

function Copy({ text }) {
  const [done, setDone] = useState(false)
  return <button type="button" className="btn-outline py-2" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>{done ? 'Copied!' : 'Copy link'}</button>
}

// ================= Business side =================
function PageForm({ adv, page, onSaved }) {
  const [f, setF] = useState({ title: page?.title || adv.business_name || '', slug: page?.slug || slugify(adv.business_name || ''), about: page?.about || '', area: page?.area || '',
    holder_cut: page ? dollars(page.holder_cut_cents) : '5', holders_can_share: page?.holders_can_share ?? true, businesses_can_share: page?.businesses_can_share ?? true, active: page?.active ?? true })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function save(e) {
    e.preventDefault(); setErr(null)
    const slug = slugify(f.slug)
    if (!f.title.trim()) return setErr('Add a title.')
    if (slug.length < 3) return setErr('The page link needs at least 3 letters or numbers.')
    const row = { title: f.title.trim(), slug, about: f.about.trim() || null, area: f.area.trim() || null, holder_cut_cents: Math.round(Number(f.holder_cut || 0) * 100), holders_can_share: f.holders_can_share, businesses_can_share: f.businesses_can_share, active: f.active }
    const { error } = page ? await supabase.from('booking_pages').update(row).eq('id', page.id) : await supabase.from('booking_pages').insert({ ...row, advertiser_id: adv.id })
    if (error) return setErr(error.message.includes('slug') || error.code === '23505' ? 'That page link is taken. Try another.' : error.message)
    onSaved()
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <div><label className="label">Page title</label><input className="input" maxLength={80} value={f.title} onChange={set('title')} placeholder="Brows by Jasmine" /></div>
      <div><label className="label">Page link</label>
        <div className="flex items-center gap-1"><span className="muted text-sm">{new URL(SITE_URL).host}/b/</span><input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} placeholder="brows-by-jasmine" /></div></div>
      <div><label className="label">About (optional)</label><textarea className="input min-h-[80px]" maxLength={600} value={f.about} onChange={set('about')} placeholder="What you do and anything clients should know." /></div>
      <div><label className="label">Where (optional)</label><input className="input" maxLength={120} value={f.area} onChange={set('area')} placeholder="Uptown, Minneapolis (your address goes in the confirmation)" /></div>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.holders_can_share} onChange={set('holders_can_share')} /><span>Let Us In It holders share my page and get paid for bookings they send</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.businesses_can_share} onChange={set('businesses_can_share')} /><span>Let other businesses carry my code (The Plug) and get paid for bookings they send</span></label>
      {(f.holders_can_share || f.businesses_can_share) && (
        <div><label className="label">Cut per booking for whoever sends you a client ($)</label><input className="input w-32" inputMode="decimal" value={f.holder_cut} onChange={(e) => setF({ ...f, holder_cut: e.target.value.replace(/[^0-9.]/g, '') })} />
          <p className="muted mt-1 text-xs">Paid to the holder or business that sent the client, from the deposit, as soon as the customer pays it. Never more than the deposit. You keep the rest.</p></div>
      )}
      {page && <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.active} onChange={set('active')} /><span>Page is open for bookings</span></label>}
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full">{page ? 'Save page' : 'Create my booking page'}</button>
    </form>
  )
}

function Services({ page }) {
  const [rows, setRows] = useState(null)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState(null)
  const load = () => supabase.from('booking_services').select('*').eq('page_id', page.id).order('sort').order('created_at').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [page.id]) // eslint-disable-line
  async function save(e) {
    e.preventDefault(); setErr(null)
    const row = { name: edit.name.trim(), duration_min: Number(edit.duration_min), price_cents: Math.round(Number(edit.price || 0) * 100), deposit_cents: Math.round(Number(edit.deposit || 0) * 100) }
    if (!row.name) return setErr('Name the service.')
    if (row.deposit_cents > row.price_cents && row.price_cents > 0) return setErr('The deposit can\'t be more than the price.')
    const { error } = edit.id ? await supabase.from('booking_services').update(row).eq('id', edit.id) : await supabase.from('booking_services').insert({ ...row, page_id: page.id })
    if (error) return setErr(error.message)
    setEdit(null); load()
  }
  async function toggle(s) { await supabase.from('booking_services').update({ active: !s.active }).eq('id', s.id); load() }
  if (!rows) return <Spinner />
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-extrabold">Services</h3>
      {rows.length === 0 && !edit && <p className="muted text-sm">Add at least one service so people can book.</p>}
      {rows.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
          <span><b>{s.name}</b> <span className="muted text-sm">· {s.duration_min} min · {money(s.price_cents)} · deposit {money(s.deposit_cents)}{s.active ? '' : ' · off'}</span></span>
          <span className="flex gap-2"><button className="btn-black py-2" onClick={() => setEdit({ ...s, price: dollars(s.price_cents), deposit: dollars(s.deposit_cents) })}>Edit</button><button className="btn-outline py-2" onClick={() => toggle(s)}>{s.active ? 'Turn off' : 'Turn on'}</button></span>
        </div>
      ))}
      {edit ? (
        <form onSubmit={save} className="space-y-2 rounded-xl border border-neutral-300 p-3 dark:border-neutral-600">
          <input className="input" maxLength={80} placeholder="Service name, like Brow lamination" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm font-bold">Minutes<select className="input" value={edit.duration_min} onChange={(e) => setEdit({ ...edit, duration_min: e.target.value })}>{[15, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
            <label className="text-sm font-bold">Price ($)<input className="input" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value.replace(/[^0-9.]/g, '') })} /></label>
            <label className="text-sm font-bold">Deposit ($)<input className="input" inputMode="decimal" value={edit.deposit} onChange={(e) => setEdit({ ...edit, deposit: e.target.value.replace(/[^0-9.]/g, '') })} /></label>
          </div>
          {err && <Notice kind="error">{err}</Notice>}
          <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-orange">Save service</button></div>
        </form>
      ) : <button className="btn-outline w-full" onClick={() => setEdit({ name: '', duration_min: 60, price: '', deposit: '' })}>Add a service</button>}
    </div>
  )
}

function Hours({ page }) {
  const [days, setDays] = useState(null)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    supabase.from('booking_hours').select('*').eq('page_id', page.id).then(({ data }) => {
      const d = DAYS.map((_, i) => { const h = (data || []).find((x) => x.dow === i); return h ? { on: true, start: h.start_min, end: h.end_min } : { on: false, start: 540, end: 1020 } })
      setDays(d)
    })
  }, [page.id])
  async function save() {
    setMsg(null)
    if (days.some((d) => d.on && d.end <= d.start)) return setMsg({ kind: 'error', text: 'Each open day needs an end time after its start time.' })
    await supabase.from('booking_hours').delete().eq('page_id', page.id)
    const rows = days.map((d, i) => d.on && { page_id: page.id, dow: i, start_min: Number(d.start), end_min: Number(d.end) }).filter(Boolean)
    if (rows.length) { const { error } = await supabase.from('booking_hours').insert(rows); if (error) return setMsg({ kind: 'error', text: error.message }) }
    setMsg({ kind: 'ok', text: 'Hours saved.' })
  }
  if (!days) return <Spinner />
  const upd = (i, k, v) => setDays(days.map((d, j) => (j === i ? { ...d, [k]: v } : d)))
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-extrabold">Hours people can book</h3>
      {days.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <label className="flex w-20 items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={d.on} onChange={(e) => upd(i, 'on', e.target.checked)} />{DAYS[i]}</label>
          {d.on ? <>
            <select className="input w-32" value={d.start} onChange={(e) => upd(i, 'start', Number(e.target.value))}>{TIMES.slice(0, 96).map((m) => <option key={m} value={m}>{minToLabel(m)}</option>)}</select>
            <span>to</span>
            <select className="input w-32" value={d.end} onChange={(e) => upd(i, 'end', Number(e.target.value))}>{TIMES.slice(1).map((m) => <option key={m} value={m}>{m === 1440 ? 'Midnight' : minToLabel(m)}</option>)}</select>
          </> : <span className="muted text-sm">Closed</span>}
        </div>
      ))}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn-black w-full" onClick={save}>Save hours</button>
    </div>
  )
}

function BookingsList({ page }) {
  const [rows, setRows] = useState(null)
  const [past, setPast] = useState(false)
  const load = () => {
    let q = supabase.from('bookings').select('*').eq('page_id', page.id)
    q = past ? q.lt('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }) : q.gte('starts_at', new Date(Date.now() - 3 * 3600e3).toISOString()).order('starts_at')
    q.limit(100).then(({ data }) => setRows(data || []))
  }
  useEffect(() => { load() }, [page.id, past]) // eslint-disable-line
  async function setStatus(b, status) { await supabase.from('bookings').update({ status }).eq('id', b.id); load() }
  if (!rows) return <Spinner />
  const btn = (b, s, label, cls = 'btn-outline') => <button className={`${cls} py-2`} onClick={() => setStatus(b, s)}>{label}</button>
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><h3 className="text-lg font-extrabold">Bookings</h3>
        <button className="text-sm font-bold underline" onClick={() => setPast(!past)}>{past ? 'Show upcoming' : 'Show past'}</button></div>
      {rows.length === 0 && <p className="muted text-sm">{past ? 'No past bookings.' : 'No upcoming bookings yet.'}</p>}
      {rows.map((b) => (
        <div key={b.id} className="space-y-1 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
          <p className="font-bold">{fmtWhen(b.starts_at)} · {b.service_name} <span className="pill ml-1 bg-neutral-200 text-neutral-800">{b.status === 'requested' ? 'new request' : b.status.replace('_', '-')}</span></p>
          <p className="text-sm">{b.customer_name}{b.customer_phone ? ` · ${b.customer_phone}` : ''}{b.customer_email ? ` · ${b.customer_email}` : ''}</p>
          {b.note && <p className="muted text-sm">Note: {b.note}</p>}
          <p className="muted text-sm">Deposit {money(b.deposit_cents)} · {b.deposit_status === 'paid' ? 'paid' : 'not collected yet'}{b.via_label ? ` · sent by ${b.via_advertiser_id ? 'business' : 'holder'} ${b.via_label} (their cut ${money(b.holder_cut_cents)})` : ''}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {b.status === 'requested' && <>{btn(b, 'confirmed', 'Confirm', 'btn-orange')}{btn(b, 'declined', 'Decline')}</>}
            {b.status === 'confirmed' && <>{btn(b, 'completed', 'Done', 'btn-black')}{btn(b, 'no_show', 'No-show')}{btn(b, 'canceled', 'Cancel')}</>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BookingManager({ adv }) {
  const [page, setPage] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const load = () => supabase.from('booking_pages').select('*').eq('advertiser_id', adv.id).maybeSingle().then(({ data }) => { setPage(data ?? null); setEditing(false) })
  useEffect(() => { load() }, [adv.id]) // eslint-disable-line
  const url = page ? bookingUrl(page.slug) : 'https://usinit.com'
  const qr = useQR(url)
  if (page === undefined) return <Spinner />
  return (
    <div className="card space-y-5">
      <h2 className="h2">Booking page</h2>
      {!page ? (
        <>
          <p className="muted">Let customers book you on Us In It. Holders can share your page, and you choose how much of each deposit they earn for sending you a client.</p>
          <PageForm adv={adv} onSaved={load} />
        </>
      ) : editing ? <PageForm adv={adv} page={page} onSaved={load} /> : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {qr && <img src={qr} alt="QR code for your booking page" className="h-24 w-24 rounded-lg" />}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">{page.title} {page.active ? '' : <span className="pill ml-1 bg-neutral-200 text-neutral-800">closed</span>}</p>
              <a href={url} target="_blank" rel="noreferrer" className="break-all text-sm font-bold underline">{url}</a>
              <p className="muted text-sm">{[page.holders_can_share && 'holders', page.businesses_can_share && 'other businesses'].filter(Boolean).join(' and ') || 'Nobody'} can share it{(page.holders_can_share || page.businesses_can_share) ? ` · ${money(page.holder_cut_cents)} per booking` : ''}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Copy text={url} /><button className="btn-black py-2" onClick={() => setEditing(true)}>Edit page</button></div>
            </div>
          </div>
          {adv.status !== 'approved' && <Notice kind="error">Your page goes live once Us In It approves your business account. You can set it up now.</Notice>}
          <Notice>Deposits turn on when Us In It payments open. Until then, bookings come in as requests, and the sharer's cut is tracked so they're paid once deposits start.</Notice>
          <Services page={page} />
          <Hours page={page} />
          <BookingsList page={page} />
        </>
      )}
    </div>
  )
}

// ================= Holder side: share pages and earn =================
export function HolderShares({ code }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { supabase.rpc('holder_booking_shares').then(({ data }) => setRows(data || [])) }, [])
  if (!rows || rows.length === 0) return null
  return (
    <div className="card space-y-3">
      <h2 className="h2">Share a booking page and earn</h2>
      <p className="muted text-sm">When someone books through your link, you earn your cut from their deposit. Deposits turn on soon, and every booking you send is counted now.</p>
      {rows.map((r) => {
        const link = bookingUrl(r.slug, code)
        return (
          <div key={r.slug} className="space-y-1 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="font-bold">{r.title}{r.area ? <span className="muted text-sm font-normal"> · {r.area}</span> : null}</p>
            <p className="text-sm">You earn {money(r.holder_cut_cents)} per booking · {r.referred} booking{r.referred === 1 ? '' : 's'} sent · {money(r.earned_cents)} earned</p>
            <p className="break-all text-xs">{link}</p>
            <div className="flex gap-2"><Copy text={link} /><a className="btn-outline py-2" href={link} target="_blank" rel="noreferrer">Open</a></div>
          </div>
        )
      })}
    </div>
  )
}

// ================= Business side: carry other businesses' codes (The Plug) =================
export function BusinessShares() {
  const [d, setD] = useState(null)
  const [printing, setPrinting] = useState(null)
  useEffect(() => { supabase.rpc('business_booking_shares').then(({ data }) => setD(data || null)) }, [])
  if (!d || !d.code) return null
  if (printing) return (
    <div>
      <button className="no-print mb-4 font-bold underline" onClick={() => setPrinting(null)}>← Back</button>
      <BookingSign url={bookingUrl(printing.slug, d.code)} title={printing.title} />
    </div>
  )
  return (
    <div className="card space-y-3">
      <h2 className="h2">The Plug: carry other businesses' codes</h2>
      <p className="muted text-sm">Post another local business's code at your place (like a nail tech's code at your booth). When someone books through it, you earn their cut from the deposit. Deposits turn on soon; every booking you send is counted now. Your share code: <b>{d.code}</b></p>
      {d.pages.length === 0 && <p className="muted text-sm">No other businesses are open for sharing yet.</p>}
      {d.pages.map((r) => {
        const link = bookingUrl(r.slug, d.code)
        return (
          <div key={r.slug} className="space-y-1 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="font-bold">{r.title}{r.area ? <span className="muted text-sm font-normal"> · {r.area}</span> : null}</p>
            <p className="text-sm">You earn {money(r.cut_cents)} per booking · {r.referred} booking{r.referred === 1 ? '' : 's'} sent · {money(r.earned_cents)} earned</p>
            <p className="break-all text-xs">{link}</p>
            <div className="flex flex-wrap gap-2"><Copy text={link} /><button className="btn-black py-2" onClick={() => setPrinting(r)}>Print their code</button></div>
          </div>
        )
      })}
    </div>
  )
}

// ================= Public booking page: /b/:slug =================
function nextDays(n) {
  const out = []
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  for (let i = 0; i < n; i++) { const d = new Date(today); d.setDate(today.getDate() + i); out.push(d) }
  return out
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function BookingPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const via = params.get('via') || ''
  const [page, setPage] = useState(undefined)
  const [svc, setSvc] = useState(null)
  const [day, setDay] = useState(null)
  const [slots, setSlots] = useState(null)
  const [time, setTime] = useState(null)
  const [f, setF] = useState({ name: '', email: '', phone: '', note: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [viaKind, setViaKind] = useState(null)
  useEffect(() => { supabase.rpc('get_booking_page', { p_slug: slug }).then(({ data }) => setPage(data || null)) }, [slug])
  useEffect(() => { if (via) supabase.rpc('booking_via_kind', { p_via: via }).then(({ data }) => setViaKind(data || null)) }, [via])
  const loadSlots = () => {
    if (!svc || !day) return
    setSlots(null); setTime(null)
    supabase.rpc('booking_slots', { p_slug: slug, p_service: svc.id, p_day: day }).then(({ data }) => setSlots(data || []))
  }
  useEffect(loadSlots, [svc, day, slug]) // eslint-disable-line

  async function book(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { data, error } = await supabase.rpc('create_booking', { p_slug: slug, p_service: svc.id, p_start: time, p_name: f.name, p_email: f.email, p_phone: f.phone, p_note: f.note, p_via: via })
    if (error) { setBusy(false); setErr(error.message); if (/took that time/.test(error.message)) loadSlots(); return }
    if (svc.deposit_cents > 0) {
      try { await startCheckout({ kind: 'booking_deposit', booking_id: data.id }); return } catch (x) { setBusy(false); setErr(x.message); return }
    }
    setBusy(false)
    setDone(data)
  }

  if (page === undefined) return <Spinner />
  if (!page) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">This booking page isn't open.</h1></div>
  if (done) return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card space-y-2">
        <h1 className="h2">Request sent! 🧡</h1>
        <p><b>{done.service}</b> with <b>{done.business}</b></p>
        <p className="text-lg font-extrabold">{fmtWhen(done.starts_at)}</p>
        <p className="muted">They'll confirm with you by email or phone.</p>
      </div>
    </div>
  )
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div>
        <h1 className="h1">{page.title}</h1>
        {page.area && <p className="muted mt-1">{page.area}</p>}
        {page.about && <p className="mt-3 whitespace-pre-line">{page.about}</p>}
      </div>

      <div className="space-y-2">
        <p className="label">1. Pick a service</p>
        {page.services.length === 0 && <p className="muted">No services listed yet.</p>}
        {page.services.map((s) => (
          <button key={s.id} onClick={() => { setSvc(s); setDay(null); setSlots(null); setTime(null) }}
            className={`w-full rounded-xl border p-3 text-left ${svc?.id === s.id ? 'border-orange bg-orange/10' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <span className="font-bold">{s.name}</span><span className="muted block text-sm">{s.duration_min} min · {money(s.price_cents)}{s.deposit_cents ? ` · ${money(s.deposit_cents)} deposit` : ''}</span>
          </button>
        ))}
      </div>

      {svc && (
        <div className="space-y-2">
          <p className="label">2. Pick a day</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {nextDays(21).map((d) => {
              const v = ymd(d)
              return <button key={v} onClick={() => setDay(v)} className={`shrink-0 rounded-xl border px-3 py-2 text-center ${day === v ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <span className="block text-xs font-bold">{DAYS[d.getDay()]}</span><span className="block text-lg font-extrabold">{d.getDate()}</span></button>
            })}
          </div>
        </div>
      )}

      {svc && day && (
        <div className="space-y-2">
          <p className="label">3. Pick a time</p>
          {slots === null ? <Spinner /> : slots.length === 0 ? <p className="muted">No open times this day. Try another day.</p> : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((t) => <button key={t} onClick={() => setTime(t)} className={`rounded-lg border px-2 py-2 font-bold ${time === t ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>
                {new Date(t).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })}</button>)}
            </div>
          )}
        </div>
      )}

      {time && (
        <form onSubmit={book} className="space-y-3">
          <p className="label">4. Your info</p>
          <input className="input" placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="input" type="tel" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className="input" maxLength={300} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {svc.deposit_cents > 0 && (
            <Notice>Deposit: {money(svc.deposit_cents)}. {viaKind ? `Part of your deposit can't be refunded, because the ${viaKind === 'business' ? 'business' : 'person'} who shared this page with you is paid as soon as you pay it.` : 'Ask the business about their refund rules.'} Online deposits are coming soon; for now the business will reach out to collect it.</Notice>
          )}
          {err && <Notice kind="error">{err}</Notice>}
          <button className="btn-orange w-full" disabled={busy}>{busy ? 'Sending…' : `Request ${new Date(time).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })}`}</button>
        </form>
      )}
      <p className="muted pt-4 text-center text-xs">Booking through Us In It{viaKind === 'holder' ? ', shared by an Us In It holder' : viaKind === 'business' ? ', shared by a local business' : ''}.</p>
    </div>
  )
}
