import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

const MPLS = [44.9778, -93.265]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ymd = (d) => d.toISOString().slice(0, 10)
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`

function FitTo({ rows }) {
  const map = useMap()
  useEffect(() => {
    if (!rows.length) return
    const lats = rows.map((r) => r.lat), lngs = rows.map((r) => r.lng)
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [30, 30], maxZoom: 17 })
  }, [rows, map])
  return null
}

function top(list, key, n = 3) {
  const c = {}
  list.forEach((r) => { c[r[key]] = (c[r[key]] || 0) + 1 })
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n)
}

// Spreadsheet download. No holder names, IDs, phones, or networks. Ever.
function toCsv(rows) {
  const head = ['latitude', 'longitude', 'gps_accuracy_meters', 'scanned_at_utc', 'local_date', 'local_hour', 'weekday']
  const lines = rows.map((r) => [r.lat.toFixed(6), r.lng.toFixed(6), r.accuracy_m == null ? '' : r.accuracy_m.toFixed(1),
    new Date(r.scanned_at).toISOString(), r.local_day, r.local_hour, r.weekday].join(','))
  return [head.join(','), ...lines].join('\n')
}

export default function LocationData() {
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(ymd(new Date()))
  const [poolOnly, setPoolOnly] = useState(false)
  const [maxAcc, setMaxAcc] = useState('')
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)

  async function load() {
    setRows(null); setErr(null)
    const { data, error } = await supabase.rpc('admin_location_data', {
      p_from: from || null, p_to: to || null, p_pool_only: poolOnly, p_max_acc: maxAcc ? Number(maxAcc) : null, p_limit: 20000,
    })
    if (error) { setErr(error.message); setRows([]) } else setRows(data || [])
  }
  useEffect(() => { load() }, [from, to, poolOnly, maxAcc]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!rows?.length) return null
    const withAcc = rows.filter((r) => r.accuracy_m != null)
    const avg = withAcc.length ? withAcc.reduce((s, r) => s + r.accuracy_m, 0) / withAcc.length : null
    return { hours: top(rows, 'local_hour'), days: top(rows, 'weekday'), avg, good: withAcc.filter((r) => r.accuracy_m <= 25).length }
  }, [rows])

  function download() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `us-in-it-location-data-${from || 'all'}-to-${to || 'now'}${poolOnly ? '-pool' : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">Location data</h2>
        <p className="muted text-sm">Every verified scan: exact spot, time, and the phone's GPS accuracy. The download never includes names, holder IDs, phones, or networks. Before selling any of this, have a lawyer review it (Minnesota treats exact location as sensitive data).</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block"><span className="label">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="block"><span className="label">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="block"><span className="label">GPS accuracy</span>
            <select className="input" value={maxAcc} onChange={(e) => setMaxAcc(e.target.value)}>
              <option value="">Any</option><option value="10">10 m or better</option><option value="25">25 m or better</option>
              <option value="50">50 m or better</option><option value="100">100 m or better</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-3"><input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={poolOnly} onChange={(e) => setPoolOnly(e.target.checked)} /><span>Pool holders only</span></label>
        </div>
      </div>

      {err && <Notice kind="error">{err}</Notice>}
      {rows === null ? <Spinner /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="card"><p className="muted text-sm">Scans</p><p className="text-2xl font-extrabold">{rows.length.toLocaleString()}</p></div>
            <div className="card"><p className="muted text-sm">Avg GPS accuracy</p><p className="text-2xl font-extrabold">{stats?.avg != null ? `${stats.avg.toFixed(0)} m` : '—'}</p></div>
            <div className="card"><p className="muted text-sm">Busiest hours</p><p className="font-bold">{stats ? stats.hours.map(([h, n]) => `${hourLabel(Number(h))} (${n})`).join(', ') : '—'}</p></div>
            <div className="card"><p className="muted text-sm">Busiest days</p><p className="font-bold">{stats ? stats.days.map(([d, n]) => `${d.slice(0, 3)} (${n})`).join(', ') : '—'}</p></div>
          </div>

          <div className="card p-0">
            <div className="h-[420px] overflow-hidden rounded-2xl">
              <MapContainer center={MPLS} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitTo rows={rows} />
                {rows.slice(0, 5000).map((r, i) => (
                  <CircleMarker key={i} center={[r.lat, r.lng]} radius={5}
                    pathOptions={{ color: r.in_pool ? '#FF6A00' : '#111111', weight: 1, fillOpacity: 0.55 }}>
                    <Tooltip>{new Date(r.scanned_at).toLocaleString()} · {r.accuracy_m != null ? `±${r.accuracy_m.toFixed(0)} m` : 'accuracy unknown'}{r.in_pool ? ' · in pool' : ''}</Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <p className="muted px-4 py-2 text-xs">Orange dots = holders in the shared location pool. Black = everyone else. {rows.length > 5000 && 'Map shows the newest 5,000; the download has all of them.'}</p>
          </div>

          <button className="btn-orange w-full" disabled={!rows.length} onClick={download}>Download spreadsheet ({rows.length.toLocaleString()} rows)</button>

          {rows.length > 0 && (
            <div className="card overflow-x-auto">
              <p className="mb-2 font-bold">Newest 100</p>
              <table className="w-full text-left text-sm">
                <thead><tr className="muted"><th className="py-1 pr-3">When</th><th className="pr-3">Latitude</th><th className="pr-3">Longitude</th><th className="pr-3">Accuracy</th><th>Pool</th></tr></thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-neutral-200 dark:border-neutral-700">
                      <td className="py-1 pr-3">{new Date(r.scanned_at).toLocaleString()}</td>
                      <td className="pr-3">{r.lat.toFixed(6)}</td>
                      <td className="pr-3">{r.lng.toFixed(6)}</td>
                      <td className="pr-3">{r.accuracy_m != null ? `${r.accuracy_m.toFixed(0)} m` : '—'}</td>
                      <td>{r.in_pool ? 'Yes' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length === 0 && <p className="muted">No verified scans with a location in these dates yet.</p>}
        </>
      )}
    </div>
  )
}
