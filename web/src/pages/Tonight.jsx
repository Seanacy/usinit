import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, deviceId } from '../lib/supabase'
import { track, getFollows, setFollows, hasAlcohol, REPORT_REASONS } from '../lib/tonight'
import { Spinner } from '../components/Layout'

// Public "Tonight" page: what's special today + search. Built phone-first.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th']
const KIND = {
  food: { tag: '🍔 Food deal', label: 'Food' },
  drink: { tag: '🍹 Drink deal', label: 'Drinks' },
  music: { tag: '🎵 Live music', label: 'Music' },
  dance: { tag: '💃 Dancing', label: 'Dancing' },
  karaoke: { tag: '🎤 Karaoke', label: 'Karaoke' },
  games: { tag: '🎲 Games', label: 'Games' },
  drag: { tag: '👑 Drag', label: 'Drag' },
  comedy: { tag: '😂 Comedy', label: 'Comedy' },
  other: { tag: '⭐ Special', label: 'Other' },
}
const CHIPS = [
  ...['food', 'drink', 'music', 'dance', 'karaoke', 'games', 'comedy', 'drag'].map((k) => ({ id: 'k:' + k, label: KIND[k].label, test: (e) => e.kind === k })),
  ...['Downtown', 'North Loop', 'Northeast', 'Uptown', 'Lake St', 'South Mpls', 'SE / Campus', 'North Mpls'].map((z) => ({ id: 'z:' + z, label: z, test: (e) => e.place?.zone === z })),
]

// Minneapolis time, no matter where the phone is.
export function chicagoNow(addDays = 0) {
  const d = new Date(Date.now() + addDays * 86400000)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', day: 'numeric', hour: 'numeric', hourCycle: 'h23', month: 'short' }).formatToParts(d).map((x) => [x.type, x.value]))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const date = Number(p.day)
  return { dow, date, hour: Number(p.hour), week: Math.ceil(date / 7), label: `${DAY_NAMES[dow]}, ${p.month} ${date}` }
}
export const happensOn = (e, day) => e.days.includes(day.dow) && (!e.weeks || e.weeks.includes(day.week))
const repeats = (e) => {
  const d = e.days.length === 7 ? 'Every day' : e.days.map((x) => DAY_NAMES[x] + 's').join(', ')
  return e.weeks ? `${e.weeks.map((w) => ORD[w]).join(' & ')} ${e.days.map((x) => DAY_NAMES[x]).join(', ')} of the month` : d
}
// Miles between two map points (straight line).
function miles(a, b) {
  const R = 3958.8, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const fmtMi = (d) => (d < 0.1 ? 'Right here' : `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`)
const RANGES = [1, 3, 5]
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } },
}
const mapsLink = (p) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.name} ${p.address || 'Minneapolis MN'}`)

function sortForTime(list, hour) {
  const early = hour < 17
  const rank = (e) => (early ? (['food', 'drink'].includes(e.kind) ? 0 : 1) : (['food', 'drink'].includes(e.kind) ? 1 : 0))
  return [...list].sort((a, b) => rank(a) - rank(b) || String(a.starts_at).localeCompare(String(b.starts_at)) || a.place.name.localeCompare(b.place.name))
}

export default function Tonight() {
  const [events, setEvents] = useState(null)
  const [tab, setTab] = useState('tonight')
  const [q, setQ] = useState('')
  const [chip, setChip] = useState(null)
  const [open, setOpen] = useState(null) // place id
  // Near me: location stays on this phone. We never save or send it.
  const [near, setNear] = useState(store.get('tonight_near') === '1')
  const [range, setRange] = useState(Number(store.get('tonight_range')) || 3)
  const [me, setMe] = useState(null)
  const [geoMsg, setGeoMsg] = useState('')
  const [follows, setFollowsState] = useState(getFollows)
  const [boosts, setBoosts] = useState([])
  const [photos, setPhotos] = useState({})
  const [params] = useSearchParams()
  const now = chicagoNow()

  const openPlace = (id) => { setOpen(id); if (id) track(id, 'open') }
  const toggleFollow = (id) => {
    const next = follows.includes(id) ? follows.filter((x) => x !== id) : [...follows, id]
    if (!follows.includes(id)) track(id, 'follow')
    setFollowsState(next); setFollows(next)
  }

  // Opened from a window sticker or a shared link: show that place right away.
  useEffect(() => {
    const id = params.get('place')
    if (!id) return
    setOpen(id); track(id, 'open')
    if (params.get('from') === 'sticker') track(id, 'sticker')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!near) { setMe(null); setGeoMsg(''); return }
    if (!navigator.geolocation) { setGeoMsg('This phone or browser can’t share location.'); return }
    setGeoMsg('Finding you…')
    const id = navigator.geolocation.watchPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoMsg('') },
      (err) => setGeoMsg(err.code === 1
        ? 'Location is blocked. Tap the “aA” or lock icon by the web address, allow Location, then reload.'
        : 'Couldn’t find your location. Try again outside or turn on Location in your phone settings.'),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [near])

  const toggleNear = () => { const v = !near; setNear(v); store.set('tonight_near', v ? '1' : null) }
  const pickRange = (r) => { setRange(r); store.set('tonight_range', String(r)) }

  useEffect(() => {
    supabase.from('tonight_events').select('*, place:tonight_places(*)').eq('active', true).eq('needs_confirm', false)
      .then(({ data }) => setEvents((data || []).filter((e) => e.place?.active)))
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
    supabase.from('tonight_boosts').select('*, place:tonight_places(*)').eq('day', today)
      .then(({ data }) => setBoosts((data || []).filter((b) => b.place?.active && b.place?.perk)))
    supabase.from('tonight_photos').select('place_id,url').eq('status', 'approved').order('created_at')
      .then(({ data }) => { const m = {}; (data || []).forEach((r) => { (m[r.place_id] ||= []).push(r.url) }); setPhotos(m) })
  }, [])

  const filtered = useMemo(() => {
    if (!events) return []
    const c = CHIPS.find((x) => x.id === chip)
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const out = events.filter((e) => {
      if (chip === 'mine' && !follows.includes(e.place.id)) return false
      if (c && !c.test(e)) return false
      if (me) {
        if (e.place.lat == null) return false
        if (e.dist > range) return false
      }
      if (!words.length) return true
      const hay = [e.title, e.details, e.deal_text, e.kind, KIND[e.kind]?.label, e.place.name, e.place.area, e.place.zone, e.place.address, ...e.days.map((d) => DAY_NAMES[d])].join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    return out
  }, [events, q, chip, me, range, follows])

  // Add distance to each listing when we know where you are.
  useEffect(() => {
    if (!events) return
    setEvents((list) => list.map((e) => ({ ...e, dist: me && e.place.lat != null ? miles(me, e.place) : null })))
  }, [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const closest = me && events ? Math.min(...events.filter((e) => e.dist != null).map((e) => e.dist)) : null

  const searching = q.trim().length > 0
  const place = open && events?.find((e) => e.place.id === open)?.place

  // Paid perks for businesses running a scan ad. No alcohol in these spots.
  const todays = filtered.filter((e) => happensOn(e, now))
  const featured = useMemo(() => {
    const ok = todays.filter((e) => e.place.perk && e.kind !== 'drink' && !hasAlcohol(`${e.title} ${e.deal_text} ${e.details}`))
    const seen = new Set(); const one = ok.filter((e) => !seen.has(e.place.id) && seen.add(e.place.id))
    const seed = now.date * 31 + now.dow
    return one.sort((a, b) => ((a.place.name.length * seed) % 97) - ((b.place.name.length * seed) % 97)).slice(0, 2)
  }, [filtered]) // eslint-disable-line react-hooks/exhaustive-deps
  const boostList = boosts
    .map((b) => ({ ...b, dist: me && b.place.lat != null ? miles(me, b.place) : null }))
    .filter((b) => !me || (b.dist != null && b.dist <= range))
    .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))
  const myTonight = events ? [...new Map(events.filter((e) => follows.includes(e.place.id) && happensOn(e, now)).map((e) => [e.place.id, e])).values()] : []

  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="sticky top-0 z-20 space-y-3 bg-white px-4 pb-3 pt-4 dark:bg-ink">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Tonight</h1>
          <span className="text-right text-sm font-bold text-neutral-500">Minneapolis<br />{now.label}</span>
        </div>
        <input className="input text-lg" type="search" inputMode="search" placeholder="Search: tacos, karaoke, Uptown…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search places and specials" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleNear} aria-pressed={near}
            className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-extrabold ${near ? 'border-orange bg-orange text-ink' : 'border-ink dark:border-white'}`}>📍 Near me{near ? ' ✓' : ''}</button>
          {near && (
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r} type="button" onClick={() => pickRange(r)}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${range === r ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{r} mi</button>
              ))}
            </div>
          )}
        </div>
        {near && geoMsg && <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300">{geoMsg}</p>}
        {near && me && closest > 25 && <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300">You look far from Minneapolis. Nothing is close to you yet.</p>}
        {!searching && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            {[['tonight', 'Today'], ['week', 'This week']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg py-3 text-base font-extrabold ${tab === id ? 'bg-ink text-white dark:bg-white dark:text-ink' : ''}`}>{label}</button>
            ))}
          </div>
        )}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {follows.length > 0 && (
            <button type="button" onClick={() => setChip(chip === 'mine' ? null : 'mine')}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${chip === 'mine' ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>★ My places</button>
          )}
          {CHIPS.map((c) => (
            <button key={c.id} type="button" onClick={() => setChip(chip === c.id ? null : c.id)}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${chip === c.id ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>{c.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4">
        {!events && <div className="py-10"><Spinner /></div>}
        {events && searching && <SearchResults events={filtered} onOpen={openPlace} byDist={!!me} />}
        {events && !searching && tab === 'tonight' && (
          <TopPicks myTonight={myTonight} boosts={boostList} featured={featured} onOpen={openPlace} />
        )}
        {events && !searching && tab === 'tonight' && <DayList day={now} events={filtered} hour={now.hour} onOpen={openPlace} today byDist={!!me} />}
        {events && !searching && tab === 'week' && [0, 1, 2, 3, 4, 5, 6].map((n) => {
          const day = chicagoNow(n)
          return <DayList key={n} day={day} events={filtered} hour={18} onOpen={openPlace} byDist={!!me} heading={n === 0 ? `Today · ${day.label}` : n === 1 ? `Tomorrow · ${day.label}` : day.label} />
        })}
        <p className="pt-4 text-center text-sm text-neutral-500">Times and deals can change. Check with the place before you go.</p>
        <p className="text-center text-sm"><Link to="/advertise" className="font-bold underline">Own a place? Claim your listing for free</Link></p>
      </div>

      {place && <PlaceSheet place={place} events={events.filter((e) => e.place.id === place.id)} photos={photos[place.id] || []}
        following={follows.includes(place.id)} onFollow={() => toggleFollow(place.id)} onClose={() => setOpen(null)} />}
    </div>
  )
}

function DayList({ day, events, hour, onOpen, heading, today, byDist }) {
  const todays = events.filter((e) => happensOn(e, day))
  const list = byDist ? [...todays].sort((a, b) => a.dist - b.dist) : sortForTime(todays, hour)
  return (
    <section className="space-y-3">
      {heading && <h2 className="pt-4 text-lg font-extrabold">{heading}</h2>}
      {today && byDist && <p className="text-sm text-neutral-500">Closest first.</p>}
      {today && !byDist && <p className="text-sm text-neutral-500">{hour < 17 ? 'Food deals first. Nightlife below.' : 'Tonight’s nightlife first. Food deals below.'}</p>}
      {list.length === 0 && <div className="card text-center text-neutral-500">{byDist ? 'Nothing close by' : 'Nothing listed'}{today ? ' today' : ''}{byDist ? '. Try a bigger distance.' : ' yet.'}</div>}
      {list.map((e) => <EventCard key={e.id} e={e} onOpen={onOpen} />)}
    </section>
  )
}

// Counts a place as "seen" once it scrolls onto the screen (for the owner's monthly report).
function useSeen(placeId) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((list) => { if (list.some((x) => x.isIntersecting)) { track(placeId, 'seen'); io.disconnect() } }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [placeId])
  return ref
}

const NeighborTag = () => <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-900">💛 Good Neighbor</span>

function EventCard({ e, onOpen, showDays }) {
  const ref = useSeen(e.place.id)
  return (
    <button ref={ref} type="button" onClick={() => onOpen(e.place.id)} className="card block w-full p-4 text-left active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-500">{e.place.name} · {e.dist != null ? fmtMi(e.dist) : e.place.area}</p>
          <p className="mt-1 text-xl font-extrabold leading-snug">{e.title}</p>
          {e.deal_text && <p className="mt-1 font-bold text-orange-dark dark:text-orange">{e.deal_text}</p>}
          <p className="mt-1 text-sm">{showDays ? `${repeats(e)} · ` : ''}{e.time_text}</p>
          {e.place.perk && <p className="mt-2"><NeighborTag /></p>}
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold dark:bg-neutral-800">{KIND[e.kind]?.tag}</span>
      </div>
    </button>
  )
}

// Top of "Today": your followed places, tonight-only boosts, and featured spots.
function TopPicks({ myTonight, boosts, featured, onOpen }) {
  if (!myTonight.length && !boosts.length && !featured.length) return null
  return (
    <section className="space-y-3">
      {myTonight.length > 0 && (
        <div className="rounded-2xl border-2 border-ink p-3 dark:border-white">
          <p className="font-extrabold">🔔 Your places tonight</p>
          <ul className="mt-2 space-y-1">
            {myTonight.map((e) => (
              <li key={e.place.id}><button type="button" onClick={() => onOpen(e.place.id)} className="w-full text-left"><b>{e.place.name}</b> · {e.title} · <span className="text-neutral-500">{e.time_text}</span></button></li>
            ))}
          </ul>
        </div>
      )}
      {boosts.map((b) => <BoostCard key={b.id} b={b} onOpen={onOpen} />)}
      {featured.map((e) => (
        <div key={'f' + e.id} className="rounded-2xl border-2 border-orange p-1">
          <p className="px-3 pt-1 text-xs font-extrabold uppercase tracking-wide text-orange-dark dark:text-orange">⭐ Featured tonight</p>
          <EventCard e={e} onOpen={onOpen} />
        </div>
      ))}
    </section>
  )
}

function BoostCard({ b, onOpen }) {
  const ref = useSeen(b.place.id)
  return (
    <button ref={ref} type="button" onClick={() => onOpen(b.place.id)} className="block w-full rounded-2xl bg-orange p-4 text-left text-ink active:scale-[0.99]">
      <p className="text-xs font-extrabold uppercase tracking-wide">🔥 Tonight only · {b.place.name}{b.dist != null ? ` · ${fmtMi(b.dist)}` : ''}</p>
      <p className="mt-1 text-xl font-extrabold leading-snug">{b.body}</p>
    </button>
  )
}

function SearchResults({ events, onOpen, byDist }) {
  if (!events.length) return <div className="card text-center text-neutral-500">No matches{byDist ? ' close by' : ''}. Try another word{byDist ? ' or a bigger distance' : ''}.</div>
  const sorted = [...events].sort((a, b) => (byDist ? a.dist - b.dist : 0) || a.place.name.localeCompare(b.place.name) || a.days[0] - b.days[0])
  return <>{<p className="text-sm text-neutral-500">{sorted.length} result{sorted.length === 1 ? '' : 's'}</p>}{sorted.map((e) => <EventCard key={e.id} e={e} onOpen={onOpen} showDays />)}</>
}

function PlaceSheet({ place, events, photos, following, onFollow, onClose }) {
  const [startY, setStartY] = useState(null)
  const [dy, setDy] = useState(0)
  const [reporting, setReporting] = useState(false)
  useEffect(() => {
    const k = (ev) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  const checked = events.map((e) => e.last_checked).sort().pop()
  const link = place.instagram ? `https://www.instagram.com/${place.instagram}/` : place.website
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={place.name}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 dark:bg-neutral-900"
        style={{ transform: `translateY(${dy}px)`, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onTouchStart={(e) => setStartY(e.touches[0].clientY)}
        onTouchMove={(e) => { if (startY !== null && e.currentTarget.scrollTop <= 0) setDy(Math.max(0, e.touches[0].clientY - startY)) }}
        onTouchEnd={() => { if (dy > 100) onClose(); setDy(0); setStartY(null) }}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold">{place.name}</h2>
            <p className="text-neutral-500">{place.address || place.area}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-neutral-100 px-3 py-1 text-xl font-bold dark:bg-neutral-800" aria-label="Close">×</button>
        </div>
        {photos.length > 0 && (
          <div className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
            {photos.map((u) => <img key={u} src={u} alt={`${place.name} photo`} loading="lazy" className="h-44 w-64 shrink-0 snap-start rounded-2xl object-cover" />)}
          </div>
        )}
        {place.perk && (
          <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
            <p className="font-extrabold">💛 Good Neighbor</p>
            <p>This place runs ads on Us In It. That money pays people going through hard times for each real scan.</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={mapsLink(place)} target="_blank" rel="noreferrer" onClick={() => track(place.id, 'directions')} className="btn-orange">📍 Directions</a>
          {link ? <a href={link} target="_blank" rel="noreferrer" onClick={() => track(place.id, 'link')} className="btn-black">{place.instagram ? 'Instagram' : 'Website'}</a> : <span />}
        </div>
        <button type="button" onClick={onFollow} aria-pressed={following}
          className={`mt-2 w-full rounded-xl border-2 py-3 font-extrabold ${following ? 'border-orange bg-orange/10' : 'border-ink dark:border-white'}`}>
          {following ? '★ Following · tap to stop' : '☆ Follow · see it at the top on its nights'}
        </button>
        <h3 className="mt-6 font-extrabold">Every week</h3>
        <ul className="mt-2 space-y-3">
          {[...events].sort((a, b) => a.days[0] - b.days[0]).map((e) => (
            <li key={e.id} className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
              <p className="text-sm font-bold text-neutral-500">{repeats(e)} · {e.time_text}</p>
              <p className="text-lg font-extrabold">{e.title}</p>
              {e.deal_text && <p className="font-bold text-orange-dark dark:text-orange">{e.deal_text}</p>}
              {e.details && <p className="text-sm">{e.details}</p>}
            </li>
          ))}
        </ul>
        {checked && <p className="mt-4 text-xs text-neutral-500">Last checked {new Date(checked + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
        {reporting ? <ReportForm place={place} events={events} onDone={() => setReporting(false)} />
          : <button type="button" onClick={() => setReporting(true)} className="mt-4 text-sm font-bold underline">⚠️ Something’s wrong? Tell us</button>}
      </div>
    </div>
  )
}

function ReportForm({ place, events, onDone }) {
  const [reason, setReason] = useState('')
  const [eventId, setEventId] = useState(events.length === 1 ? events[0].id : '')
  const [note, setNote] = useState('')
  const [state, setState] = useState(null)
  async function send() {
    if (!reason) return setState('pick')
    setState('sending')
    const { data } = await supabase.rpc('tonight_report', { p_place: place.id, p_event: eventId || null, p_reason: reason, p_note: note, p_device: deviceId() || 'none' })
    setState(data === 'ok' || data === 'dupe' ? 'done' : data === 'limit' ? 'limit' : 'error')
  }
  if (state === 'done') return <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-900">Thanks! We’ll check it and fix it.</p>
  return (
    <div className="mt-4 space-y-2 rounded-xl border-2 border-neutral-200 p-3 dark:border-neutral-700">
      <p className="font-extrabold">What’s wrong?</p>
      {REPORT_REASONS.map(([id, label]) => (
        <label key={id} className="flex items-center gap-2 text-sm"><input type="radio" name="reason" checked={reason === id} onChange={() => setReason(id)} className="h-5 w-5" /> {label}</label>
      ))}
      {events.length > 1 && (
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Which special">
          <option value="">Which special? (optional)</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      )}
      <input className="input" maxLength={200} placeholder="Tell us more (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {state === 'pick' && <p className="text-sm font-bold text-red-600">Pick one answer first.</p>}
      {state === 'limit' && <p className="text-sm font-bold text-red-600">You’ve sent a lot today. Try again tomorrow.</p>}
      {state === 'error' && <p className="text-sm font-bold text-red-600">That didn’t send. Try again.</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-outline flex-1">Cancel</button>
        <button type="button" onClick={send} disabled={state === 'sending'} className="btn-black flex-1">Send</button>
      </div>
    </div>
  )
}
