import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Notice } from './Layout'

// Admin: manage the Tonight page. Hidden rows ("Check first") never show on the public page.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KINDS = ['food', 'drink', 'music', 'dance', 'karaoke', 'games', 'drag', 'other']
const ZONES = ['Uptown', 'Lake St', 'Downtown', 'Northeast', 'North Loop', 'St. Paul', 'Other']
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

export default function AdminTonight() {
  const [places, setPlaces] = useState(null)
  const [show, setShow] = useState('check')
  const [msg, setMsg] = useState(null)
  const [newPlace, setNewPlace] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('tonight_places').select('*, events:tonight_events(*)').order('name')
    if (error) setMsg(error.message)
    setPlaces(data || [])
  }
  useEffect(() => { load() }, [])

  if (!places) return <p>Loading…</p>
  const all = places.flatMap((p) => p.events)
  const waiting = all.filter((e) => e.needs_confirm).length
  const list = places.filter((p) => show === 'all' || (show === 'check' ? p.events.some((e) => e.needs_confirm) : p.events.some((e) => !e.needs_confirm && e.active)))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="h2">Tonight page</h2>
        <p className="text-sm">Public page: <a className="font-bold underline" href="/tonight" target="_blank" rel="noreferrer">usinit.com/tonight</a>. Drink specials are OK here. Ads still can't be for alcohol.</p>
      </div>
      {msg && <Notice kind="error">{msg}</Notice>}
      <div className="grid grid-cols-3 gap-2">
        {[['check', `Check first (${waiting})`], ['live', `Live (${all.length - waiting})`], ['all', 'All']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setShow(id)} className={id === show ? 'btn-black' : 'btn-outline'}>{label}</button>
        ))}
      </div>
      <button type="button" className="btn-orange w-full" onClick={() => setNewPlace(!newPlace)}>+ Add a place</button>
      {newPlace && <PlaceForm onDone={() => { setNewPlace(false); load() }} />}
      {list.length === 0 && <p className="card text-center">Nothing here.</p>}
      {list.map((p) => <PlaceBox key={p.id} p={p} reload={load} setMsg={setMsg} />)}
    </div>
  )
}

function PlaceBox({ p, reload, setMsg }) {
  const [edit, setEdit] = useState(false)
  const [add, setAdd] = useState(false)
  return (
    <div className={`card space-y-3 ${p.active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold">{p.name}</p>
          <p className="text-sm text-neutral-500">{p.area} · {p.zone} · {p.address || 'no address'}{p.instagram ? ` · @${p.instagram}` : ''}</p>
        </div>
        <button type="button" className="text-sm font-bold underline" onClick={() => setEdit(!edit)}>{edit ? 'Close' : 'Edit place'}</button>
      </div>
      {edit && <PlaceForm p={p} onDone={() => { setEdit(false); reload() }} />}
      {p.events.map((e) => <EventRow key={e.id} e={e} reload={reload} setMsg={setMsg} />)}
      <button type="button" className="btn-outline w-full" onClick={() => setAdd(!add)}>{add ? 'Cancel' : '+ Add a night or deal'}</button>
      {add && <EventForm placeId={p.id} onDone={() => { setAdd(false); reload() }} />}
    </div>
  )
}

function EventRow({ e, reload, setMsg }) {
  const [edit, setEdit] = useState(false)
  async function upd(patch) {
    const { error } = await supabase.from('tonight_events').update(patch).eq('id', e.id)
    if (error) setMsg(error.message); reload()
  }
  async function del() {
    if (!window.confirm(`Delete "${e.title}" for good?`)) return
    const { error } = await supabase.from('tonight_events').delete().eq('id', e.id)
    if (error) setMsg(error.message); reload()
  }
  const days = e.days.map((d) => DAYS[d]).join(', ') + (e.weeks ? ` (${e.weeks.join(' & ')} of month)` : '')
  return (
    <div className={`rounded-xl border-2 p-3 ${e.needs_confirm ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950' : 'border-green-500'}`}>
      <p className="text-sm font-bold">{days} · {e.time_text} · {e.kind}</p>
      <p className="font-extrabold">{e.title}</p>
      {e.deal_text && <p className="text-sm font-bold">{e.deal_text}</p>}
      <p className="text-xs text-neutral-500">Last checked {e.last_checked}{e.source_url ? <> · <a className="underline" href={e.source_url} target="_blank" rel="noreferrer">where we found it</a></> : null}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {e.needs_confirm
          ? <button type="button" className="btn-orange py-2" onClick={() => upd({ needs_confirm: false, last_checked: today() })}>✅ Checked, show it</button>
          : <button type="button" className="btn-outline py-2" onClick={() => upd({ needs_confirm: true })}>Hide (check first)</button>}
        <button type="button" className="btn-outline py-2" onClick={() => upd({ last_checked: today() })}>Still right today</button>
        <button type="button" className="btn-outline py-2" onClick={() => setEdit(!edit)}>{edit ? 'Close' : 'Edit'}</button>
        <button type="button" className="btn-outline py-2 text-red-600" onClick={del}>Delete</button>
      </div>
      {edit && <EventForm e={e} onDone={() => { setEdit(false); reload() }} />}
    </div>
  )
}

function PlaceForm({ p, onDone }) {
  const [f, setF] = useState({ name: p?.name || '', area: p?.area || '', zone: p?.zone || 'Other', address: p?.address || '', instagram: p?.instagram || '', website: p?.website || '', active: p?.active ?? true })
  const [err, setErr] = useState(null)
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value })
  async function save() {
    if (!f.name.trim()) return setErr('Name is needed.')
    const row = { ...f, instagram: f.instagram.replace(/^@/, '').trim() || null, website: f.website.trim() || null }
    const { error } = p ? await supabase.from('tonight_places').update(row).eq('id', p.id) : await supabase.from('tonight_places').insert(row)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      {err && <Notice kind="error">{err}</Notice>}
      <input className="input" placeholder="Place name" value={f.name} onChange={set('name')} />
      <input className="input" placeholder="Area shown on card (e.g. Uptown)" value={f.area} onChange={set('area')} />
      <label className="block text-sm font-bold">Filter group
        <select className="input mt-1" value={f.zone} onChange={set('zone')}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select>
      </label>
      <input className="input" placeholder="Address" value={f.address} onChange={set('address')} />
      <input className="input" placeholder="Instagram name (no @)" value={f.instagram} onChange={set('instagram')} />
      <input className="input" placeholder="Website (optional)" value={f.website} onChange={set('website')} />
      {p && <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={f.active} onChange={set('active')} /> Show this place</label>}
      <button type="button" className="btn-black w-full" onClick={save}>Save place</button>
    </div>
  )
}

function EventForm({ e, placeId, onDone }) {
  const [f, setF] = useState({
    title: e?.title || '', details: e?.details || '', kind: e?.kind || 'food', days: e?.days || [], weeks: e?.weeks || [],
    time_text: e?.time_text || '', starts_at: e?.starts_at?.slice(0, 5) || '', deal_text: e?.deal_text || '', source_url: e?.source_url || '',
  })
  const [err, setErr] = useState(null)
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value })
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v].sort() })
  async function save() {
    if (!f.title.trim()) return setErr('Name of the night or deal is needed.')
    if (!f.days.length) return setErr('Pick at least one day.')
    const row = { ...f, weeks: f.weeks.length ? f.weeks : null, starts_at: f.starts_at || null, details: f.details || null, deal_text: f.deal_text || null, source_url: f.source_url || null, last_checked: today() }
    const { error } = e ? await supabase.from('tonight_events').update(row).eq('id', e.id) : await supabase.from('tonight_events').insert({ ...row, place_id: placeId, needs_confirm: false })
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      {err && <Notice kind="error">{err}</Notice>}
      <input className="input" placeholder="Name (e.g. Taco Tuesday)" value={f.title} onChange={set('title')} />
      <input className="input" placeholder="The deal (e.g. $2 tacos)" value={f.deal_text} onChange={set('deal_text')} />
      <input className="input" placeholder="Short details" value={f.details} onChange={set('details')} />
      <select className="input" value={f.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
      <p className="text-sm font-bold">Days</p>
      <div className="grid grid-cols-7 gap-1">{DAYS.map((d, i) => (
        <button key={d} type="button" onClick={() => toggle('days', i)} className={`rounded-lg py-2 text-sm font-bold ${f.days.includes(i) ? 'bg-orange text-ink' : 'bg-white dark:bg-neutral-700'}`}>{d}</button>
      ))}</div>
      <p className="text-sm font-bold">Only some weeks? (leave blank = every week)</p>
      <div className="grid grid-cols-5 gap-1">{[1, 2, 3, 4, 5].map((w) => (
        <button key={w} type="button" onClick={() => toggle('weeks', w)} className={`rounded-lg py-2 text-sm font-bold ${f.weeks.includes(w) ? 'bg-orange text-ink' : 'bg-white dark:bg-neutral-700'}`}>{['1st', '2nd', '3rd', '4th', '5th'][w - 1]}</button>
      ))}</div>
      <input className="input" placeholder="Time shown (e.g. 9 PM–2 AM)" value={f.time_text} onChange={set('time_text')} />
      <label className="block text-sm font-bold">Start time (for sorting)<input className="input mt-1" type="time" value={f.starts_at} onChange={set('starts_at')} /></label>
      <input className="input" placeholder="Where you found it (link, optional)" value={f.source_url} onChange={set('source_url')} />
      <button type="button" className="btn-black w-full" onClick={save}>Save</button>
    </div>
  )
}
