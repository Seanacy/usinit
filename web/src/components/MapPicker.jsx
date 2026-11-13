import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const MPLS = [44.9778, -93.265]

function Clicker({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export default function MapPicker({ point, radius, onPick, circles = [], height = 320 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-600" style={{ height }}>
      <MapContainer center={point ? [point.lat, point.lng] : MPLS} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {onPick && <Clicker onPick={onPick} />}
        {circles.map((c) => (
          <Circle key={c.id} center={[c.lat, c.lng]} radius={c.radius_m} pathOptions={{ color: '#111111', weight: 1, fillOpacity: 0.08 }} />
        ))}
        {point && <Circle center={[point.lat, point.lng]} radius={radius} pathOptions={{ color: '#FF6A00', weight: 3, fillOpacity: 0.2 }} />}
      </MapContainer>
    </div>
  )
}
