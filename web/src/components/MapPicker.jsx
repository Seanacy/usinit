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

// Address search using OpenStreetMap's free lookup, kept to Minnesota first.
export function AddressSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  async function search(e) {
    e?.preventDefault()
    if (!q.trim()) return
    setBusy(true); setResults(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&viewbox=-94.0,45.4,-92.6,44.6&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const data = await res.json()
      setResults(data || [])
      if (data?.length === 1) pick(data[0])
    } catch {
      setResults([])
    } finally {
      setBusy(false)
    }
  }
  function pick(r) {
    onPick({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })
    setResults(null)
  }
  return (
    <div>
      <div className="flex gap-2">
        <input className="input" placeholder="Type an address or place, like 1477 W Lake St, Minneapolis" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(e) }} />
        <button type="button" className="btn-black shrink-0" onClick={search} disabled={busy}>{busy ? '…' : 'Find'}</button>
      </div>
      {results && results.length === 0 && <p className="mt-2 text-sm font-bold text-red-600">No match. Try adding the city, like "Minneapolis". For a street corner, type a nearby address, then tap the exact corner on the map.</p>}
      {results && results.length > 1 && (
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
          {results.map((r) => (
            <li key={r.place_id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => pick(r)}>{r.display_name}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MapPicker({ point, radius, onPick, circles = [], height = 320 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-600" style={{ height }}>
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
