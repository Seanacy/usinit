import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MPLS = [44.9778, -93.265]

const pin = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#FF6A00;border:3px solid #111111;box-shadow:0 0 0 2px #fff"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function Clicker({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function Follow({ point, radius }) {
  const map = useMap()
  useEffect(() => {
    if (!point) return
    const r = Math.max(radius || 300, 150)
    map.fitBounds(L.latLng(point.lat, point.lng).toBounds(r * 2.6), { maxZoom: 18, animate: true })
  }, [point?.lat, point?.lng, radius]) // eslint-disable-line
  return null
}

// Address and place lookup (free OpenStreetMap services), kept inside the Twin Cities area.
const BOX = { w: -94.0, s: 44.6, e: -92.6, n: 45.4 }
function clean(text) {
  return text.toLowerCase()
    .replace(/[&@]/g, ' ')
    .replace(/\b(on|at|near|by|the|in|of|and|corner|between)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
}
function label(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  return [p.name !== p.street ? p.name : null, street, p.city || p.district].filter(Boolean).join(', ')
}
export async function geocode(text, limit = 6) {
  const out = []
  const add = (lat, lng, lbl) => {
    if (!lbl || out.some((o) => o.label === lbl || (Math.abs(o.lat - lat) < 0.0003 && Math.abs(o.lng - lng) < 0.0003))) return
    out.push({ lat, lng, label: lbl })
  }
  const q = clean(text) || text
  const [photon, nomi] = await Promise.allSettled([
    fetch(`https://photon.komoot.io/api/?limit=${limit}&lat=44.97&lon=-93.26&bbox=${BOX.w},${BOX.s},${BOX.e},${BOX.n}&q=${encodeURIComponent(q)}`).then((r) => r.json()),
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&bounded=1&viewbox=${BOX.w},${BOX.n},${BOX.e},${BOX.s}&q=${encodeURIComponent(text)}`).then((r) => r.json()),
  ])
  if (nomi.status === 'fulfilled' && Array.isArray(nomi.value)) {
    nomi.value.filter((r) => /\d/.test(text.split(' ')[0] || '')).forEach((r) => add(Number(r.lat), Number(r.lon), r.display_name.split(',').slice(0, 3).join(',')))
  }
  if (photon.status === 'fulfilled' && photon.value?.features) {
    photon.value.features.forEach((f) => add(f.geometry.coordinates[1], f.geometry.coordinates[0], label(f.properties)))
  }
  if (nomi.status === 'fulfilled' && Array.isArray(nomi.value)) {
    nomi.value.forEach((r) => add(Number(r.lat), Number(r.lon), r.display_name.split(',').slice(0, 3).join(',')))
  }
  return out.slice(0, limit)
}

export function AddressSearch({ onPick, label: title = 'Find the spot' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  async function search(e) {
    e?.preventDefault()
    if (!q.trim()) return
    setBusy(true); setResults(null)
    try { setResults(await geocode(q)) } catch { setResults([]) } finally { setBusy(false) }
  }
  function pick(r) { onPick(r); setResults(null) }
  return (
    <div>
      <label className="label">{title}</label>
      <div className="flex gap-2">
        <input className="input" placeholder="Address or place, like Target Lake St or 1477 W Lake St" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(e) }} />
        <button type="button" className="btn-black shrink-0" onClick={search} disabled={busy}>{busy ? '…' : 'Find'}</button>
      </div>
      {results && results.length === 0 && <p className="mt-2 text-sm font-bold text-red-600">No match in the Twin Cities. Try fewer words, like "Target Lake St", or tap the spot on the map.</p>}
      {results && results.length > 0 && (
        <div className="mt-2">
          <p className="muted mb-1 text-sm font-bold">Tap the right one:</p>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
            {results.map((r, i) => (
              <li key={i}><button type="button" className="w-full px-3 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => pick(r)}>{r.label}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function MapPicker({ point, radius, onPick, circles = [], height = 320 }) {
  return (
    <div className="relative z-0 overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-600" style={{ height }}>
      <MapContainer center={point ? [point.lat, point.lng] : MPLS} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {onPick && <Clicker onPick={onPick} />}
        <Follow point={point} radius={radius} />
        {circles.map((c) => (
          <Circle key={c.id} center={[c.lat, c.lng]} radius={c.radius_m} pathOptions={{ color: '#111111', weight: 1, fillOpacity: 0.08 }} />
        ))}
        {point && <Circle center={[point.lat, point.lng]} radius={radius} pathOptions={{ color: '#FF6A00', weight: 3, fillOpacity: 0.2 }} />}
        {point && <Marker position={[point.lat, point.lng]} icon={pin} />}
      </MapContainer>
    </div>
  )
}

export const FT_PER_M = 3.28084
export function describeRadius(m) {
  const ft = m * FT_PER_M
  return ft < 2640 ? `${Math.round(ft).toLocaleString()} ft` : `${(ft / 5280).toFixed(ft < 26400 ? 2 : 1)} mi`
}
