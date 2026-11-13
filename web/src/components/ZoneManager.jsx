import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MapPicker, { AddressSearch, FT_PER_M, describeRadius, geocode, radiusParts } from './MapPicker'
import { Notice, Spinner } from './Layout'

export const BUFFER_FT = 50
export const BUFFER_M = BUFFER_FT / FT_PER_M
const MIN_RADIUS_FT = 75 // 150 ft across
const PRESETS = [[75, 'ft'], [150, 'ft'], [300, 'ft'], [500, 'ft'], [1000, 'ft'], [0.5, 'mi'], [1, 'mi'], [3, 'mi']]
const toMeters = (n, unit) => (unit === 'mi' ? n * 1609.34 : n / FT_PER_M)
const across = (m) => describeRadius(m * 2)

export function WhyBuffer({ agree = false }) {
  return (
    <div className="rounded-xl border border-neutral-300 p-3 text-sm dark:border-neutral-600">
      <p className="font-bold">Every zone has a {BUFFER_FT} ft GPS buffer (the dashed ring on the map).</p>
      <p className="mt-1">Scans within {BUFFER_FT} feet outside your zone's edge count as inside your zone.</p>
      <p className="mt-2 font-bold">Why {BUFFER_FT} feet?</p>
      <p className="mt-1">Phone GPS isn't exact. In a city it's often off by 30 to 50 feet, because buildings bounce the signal. A 10 or 20 foot buffer would be smaller than that error, so real scans would get missed or counted in the wrong place. {BUFFER_FT} feet covers normal phone error and still keeps your zone close to your business.</p>
      {agree && <p className="mt-2 font-bold">By adding a zone, you agree that scans inside this {BUFFER_FT} ft buffer count as scans in your zone.</p>}
    </div>
  )
}

// One zone page for everyone: admin (all zones) and advertisers (their own zones).
export default function ZoneManager({ advertiser = null, isAdmin = false }) {
  const [rows, setRows] = useState(null)
  const [owners, setOwners] = useState({})
  const [stats, setStats] = useState({})
  const [point, setPoint] = useState(null)
  const [name, setName] = useState('')
  const [size, setSize] = useState('150')
  const [unit, setUnit] = useState('ft')
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const radiusM = toMeters(Number(size) || 0, unit)

  async function load() {
    const { data } = await supabase.from('advertising_zones').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    if (isAdmin) {
      const { data: a } = await supabase.from('advertisers').select('id,business_name')
      setOwners(Object.fromEntries((a || []).map((x) => [x.id, x.business_name])))
    } else {
      const { data: s } = await supabase.rpc('my_zone_stats')
      setStats(Object.fromEntries((s || []).map((x) => [x.zone_id, x])))
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  // Live stats for advertisers: refresh every 30 seconds.
  useEffect(() => {
    if (isAdmin) return
    const t = setInterval(() => supabase.rpc('my_zone_stats').then(({ data: s }) => setStats(Object.fromEntries((s || []).map((x) => [x.zone_id, x])))), 30000)
    return () => clearInterval(t)
  }, [isAdmin])

  function startEdit(z) {
    const r = radiusParts(z.radius_m)
    setEditing(z); setPoint({ lat: z.lat, lng: z.lng }); setName(z.name); setSize(r.size); setUnit(r.unit); setErr(null); setOk(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditing(null); setPoint(null); setName(''); setSize('150'); setUnit('ft'); setErr(null) }
  function picked(p) {
    setPoint(p)
    if (p.label && !name) setName(p.label.split(',').slice(0, 2).join(',').trim())
  }

  async function save() {
    setErr(null); setOk(null)
    if (!name.trim()) return setErr('Give the zone a name, like "Joe\'s Deli, Lake St".')
    let p = point
    if (!p) {
      const found = await geocode(name, 1).catch(() => [])
      if (!found.length) return setErr('Type an address in Step 1 and click Find, or tap the map.')
      p = { lat: found[0].lat, lng: found[0].lng }
      setPoint(p)
    }
    if (!(radiusM * FT_PER_M >= MIN_RADIUS_FT - 0.5)) return setErr(`The smallest zone is ${MIN_RADIUS_FT} ft from the center to the edge (150 ft across), about the size of a small store and its parking lot.`)
    if (radiusM > 50000) return setErr('That zone is too big. Keep it under 30 miles from the center.')
    setBusy(true)
    const row = { name: name.trim(), lat: p.lat, lng: p.lng, radius_m: Math.max(23, Math.round(radiusM)) }
    if (!editing && advertiser) row.advertiser_id = advertiser.id
    const { error } = editing
      ? await supabase.from('advertising_zones').update(row).eq('id', editing.id)
      : await supabase.from('advertising_zones').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    setOk(editing ? 'Zone saved.' : 'Zone added. It is ready to use right away.')
    reset(); load()
  }

  async function togglePause(z) { await supabase.from('advertising_zones').update({ active: !z.active }).eq('id', z.id); load() }
  async function toggleAdminOff(z) { await supabase.from('advertising_zones').update({ admin_off: !z.admin_off }).eq('id', z.id); load() }
  async function del(z) {
    if (!confirm(`Delete zone "${z.name}"? Ads using only this zone will stop showing.`)) return
    const { error } = await supabase.from('advertising_zones').delete().eq('id', z.id)
    if (error) setErr(error.message); else load()
  }

  if (!rows) return <Spinner />
  const others = rows.filter((z) => z.id !== editing?.id && z.active && !z.admin_off)

  return (
    <div className="space-y-4">
      {isAdmin
        ? <p className="muted">Businesses draw their own zones, and they're ready right away. A scan only pays when the person scanning is inside a zone (plus the {BUFFER_FT} ft buffer). You can still make your own zones, and you can turn off any zone.</p>
        : <p className="muted">A zone is the area where your ads show. Draw as many as you want. They're ready right away. Your ads still need a quick approval before they run.</p>}
      {editing && <Notice>Editing "{editing.name}". Move the pin, change the size or name, then click Save changes.</Notice>}

      <AddressSearch onPick={picked} label="Step 1: Find the spot (type an address, then click Find, or tap the map)" />
      <MapPicker point={point} radius={radiusM} onPick={setPoint} circles={others} height={380} bufferM={BUFFER_M} />
      <p className="muted text-xs">Solid orange = your zone. Dashed ring = the {BUFFER_FT} ft GPS buffer.{others.length ? ' Gray circles = your other zones.' : ''}</p>

      <div>
        <p className="label">Step 2: Zone size (distance from the center to the edge)</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([n, u]) => (
            <button key={`${n}${u}`} type="button" onClick={() => { setSize(String(n)); setUnit(u) }}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${Number(size) === n && unit === u ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{n} {u}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input className="input w-32" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Zone size" />
          <select className="input w-32" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="ft">feet</option><option value="mi">miles</option></select>
          {radiusM > 0 && <span className="muted text-sm">= {across(radiusM)} across</span>}
        </div>
        <p className="muted mt-1 text-xs">Smallest zone: {MIN_RADIUS_FT} ft from the center to the edge (150 ft across), about a small store and its parking lot.</p>
      </div>

      <WhyBuffer agree={!isAdmin} />

      <p className="label">Step 3: Name the zone and save</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder={'Zone name, like "Joe\'s Deli, Lake St"'} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          {editing && <button className="btn-outline" onClick={reset}>Cancel</button>}
          <button className="btn-orange" onClick={save} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add zone'}</button>
        </div>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <h3 className="text-lg font-extrabold">{isAdmin ? `All zones (${rows.length})` : `Your zones (${rows.length})`}</h3>
      {rows.length === 0 && <p className="muted">No zones yet.</p>}
      {rows.map((z) => {
        const st = stats[z.id]
        const owner = isAdmin ? (z.advertiser_id ? owners[z.advertiser_id] || 'A business' : 'Us In It') : null
        const status = z.admin_off ? 'turned off by Us In It' : z.active ? null : 'paused'
        return (
          <div key={z.id} className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <button className="text-left font-bold underline-offset-2 hover:underline" onClick={() => startEdit(z)}>{z.name}</button>
                <p className="muted text-sm">{describeRadius(z.radius_m)} from center ({across(z.radius_m)} across){owner ? ` · ${owner}` : ''}{status ? ` · ${status}` : ''}</p>
                {!isAdmin && <p className="text-sm font-bold">{st ? `${st.scans_today} scans today · ${st.scans_total} total` : '0 scans today · 0 total'}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-black py-2" onClick={() => startEdit(z)}>Edit</button>
              {(!isAdmin || !z.advertiser_id) && <button className="btn-outline py-2" onClick={() => togglePause(z)}>{z.active ? (isAdmin ? 'Turn off' : 'Pause') : (isAdmin ? 'Turn on' : 'Resume')}</button>}
              {isAdmin && z.advertiser_id && <button className="btn-outline py-2" onClick={() => toggleAdminOff(z)}>{z.admin_off ? 'Turn back on' : 'Turn off'}</button>}
              <button className="btn-outline py-2" onClick={() => del(z)}>Delete</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
