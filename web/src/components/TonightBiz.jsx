import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Notice } from './Layout'
import { EventForm } from './AdminTonight'
import { hasAlcohol, monthRange, monthStats, REPORT_REASONS } from '../lib/tonight'

// Business dashboard: claim your Tonight listing, fix your nights, see your numbers,
// and (with a running scan ad) use the paid perks.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

export default function TonightBiz({ adv }) {
  const [places, setPlaces] = useState(null)
  const [claims, setClaims] = useState([])
  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('tonight_places').select('*, events:tonight_events(*)').eq('advertiser_id', adv.id).order('name'),
      supabase.from('tonight_claims').select('*, place:tonight_places(name)').eq('advertiser_id', adv.id).order('created_at', { ascending: false }),
    ])
    setPlaces(p || []); setClaims(c || [])
  }
  useEffect(() => { load() }, [adv.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!places) return null
  const pending = claims.filter((c) => c.status === 'pending')
  return (
    <div className="space-y-3">
      <h2 className="h2 pt-2">Your Tonight listing</h2>
      <p className="muted -mt-2 text-sm">Tonight is our free page of Minneapolis specials and theme nights: <a href="/tonight" target="_blank" rel="noreferrer" className="font-bold underline">usinit.com/tonight</a>.</p>
      {places.map((p) => <MyPlace key={p.id} p={p} reload={load} />)}
      {pending.map((c) => <Notice key={c.id}>We got your request for <b>{c.place?.name}</b>. We’ll call to check, then it shows up here.</Notice>)}
      {claims.filter((c) => c.status === 'denied').slice(0, 1).map((c) => <Notice key={c.id} kind="error">We couldn’t confirm <b>{c.place?.name}</b> is yours. Use Contact us if that’s a mistake.</Notice>)}
      <ClaimBox adv={adv} onDone={load} hasPlace={places.length > 0} />
    </div>
  )
}

function ClaimBox({ adv, onDone, hasPlace }) {
  const [open, setOpen] = useState(!hasPlace)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('tonight_places').select('id,name,address,advertiser_id').ilike('name', `%${q.trim()}%`).order('name').limit(8)
      setHits(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  async function send() {
    setErr(null)
    const { error } = await supabase.from('tonight_claims').insert({ place_id: pick.id, advertiser_id: adv.id, note: note.trim() || null })
    if (error) return setErr(error.message.includes('duplicate') ? 'You already asked for this place. We’ll call you.' : error.message)
    setPick(null); setQ(''); setNote(''); setOpen(false); onDone()
  }
  if (!open) return <button type="button" className="btn-outline w-full" onClick={() => setOpen(true)}>+ Claim another place</button>
  return (
    <div className="card space-y-3">
      <p className="text-lg font-extrabold">Is your place on Tonight?</p>
      <p className="muted text-sm">Claim it for free. Then you can fix your nights and deals yourself and see how many people looked at you each month.</p>
      {!pick ? (
        <>
          <input className="input" placeholder="Type your place’s name" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.map((h) => (
            <button key={h.id} type="button" disabled={!!h.advertiser_id} onClick={() => setPick(h)} className="block w-full rounded-xl border-2 border-neutral-200 p-3 text-left disabled:opacity-50 dark:border-neutral-700">
              <b>{h.name}</b> <span className="muted text-sm">{h.address}</span>{h.advertiser_id ? <span className="block text-sm">Already claimed</span> : null}
            </button>
          ))}
          {q.trim().length >= 2 && !hits.length && <p className="muted text-sm">Not on Tonight yet? Use <a href="/contact" className="font-bold underline">Contact us</a> and tell us your nights. We’ll add you.</p>}
        </>
      ) : (
        <>
          <p>Claim <b>{pick.name}</b>?</p>
          <input className="input" maxLength={300} placeholder="Your job there (owner, manager…) and best phone to reach you" value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="muted text-sm">We’ll call the place to make sure it’s really yours.</p>
          {err && <Notice kind="error">{err}</Notice>}
          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setPick(null)}>Back</button>
            <button type="button" className="btn-orange flex-1" onClick={send}>Send request</button>
          </div>
        </>
      )}
      {hasPlace && <button type="button" className="text-sm font-bold underline" onClick={() => setOpen(false)}>Close</button>}
    </div>
  )
}

function MyPlace({ p, reload }) {
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [add, setAdd] = useState(false)
  const [editInfo, setEditInfo] = useState(false)
  const [msg, setMsg] = useState(null)
  const m = monthRange(0)
  async function loadExtra() {
    monthStats([p.id], m.start, m.end).then((s) => setStats(s[p.id] || {}))
    const { data } = await supabase.from('tonight_reports').select('*, event:tonight_events(title)').eq('place_id', p.id).eq('status', 'open').order('created_at', { ascending: false })
    setReports(data || [])
  }
  useEffect(() => { loadExtra() }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const reason = Object.fromEntries(REPORT_REASONS)
  async function upd(id, patch) { const { error } = await supabase.from('tonight_events').update(patch).eq('id', id); if (error) setMsg(error.message); reload() }
  async function del(e) { if (!window.confirm(`Delete "${e.title}"?`)) return; const { error } = await supabase.from('tonight_events').delete().eq('id', e.id); if (error) setMsg(error.message); reload() }
  async function fixed(id) { await supabase.from('tonight_reports').update({ status: 'fixed' }).eq('id', id); loadExtra() }
  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-extrabold">{p.name}</p>
          <p className="muted text-sm">{p.address}</p>
          {p.perk ? <p className="mt-1 text-sm font-bold">💛 Good Neighbor perks are on (your scan ad is running)</p> : null}
        </div>
        <a href={`/tonight?place=${p.id}`} target="_blank" rel="noreferrer" className="btn-outline shrink-0 py-2">See it</a>
      </div>
      {msg && <Notice kind="error">{msg}</Notice>}

      <div>
        <p className="font-extrabold">📊 {m.label} so far</p>
        {stats && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {[['seen', 'Seen'], ['open', 'Opened'], ['directions', 'Directions'], ['link', 'Insta/web'], ['follow', 'Followers'], ['sticker', 'Sticker scans']].map(([k, l]) => (
              <div key={k} className="rounded-xl bg-neutral-100 p-2 dark:bg-neutral-800"><p className="text-2xl font-extrabold">{stats[k] || 0}</p><p className="text-xs">{l}</p></div>
            ))}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a href={`/tonight/print/${p.id}?kind=report`} target="_blank" rel="noreferrer" className="btn-outline py-2">Full report</a>
          <a href={`/tonight/print/${p.id}?kind=sticker`} target="_blank" rel="noreferrer" className="btn-outline py-2">🪧 Window sticker</a>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="space-y-2">
          <p className="font-extrabold">⚠️ Customers say something may be wrong</p>
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl bg-orange/10 p-3 text-sm">
              <p><b>{reason[r.reason]}</b>{r.event ? ` · ${r.event.title}` : ''}{r.note ? ` · “${r.note}”` : ''}</p>
              <button type="button" className="mt-1 font-bold underline" onClick={() => fixed(r.id)}>I fixed it / it’s right</button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="font-extrabold">Your nights and deals</p>
        {p.events.map((e) => <MyEvent key={e.id} e={e} upd={upd} del={del} reload={reload} />)}
        <button type="button" className="btn-outline w-full" onClick={() => setAdd(!add)}>{add ? 'Cancel' : '+ Add a night or deal'}</button>
        {add && <EventForm placeId={p.id} owner onDone={() => { setAdd(false); reload() }} />}
      </div>

      {editInfo ? <InfoForm p={p} onDone={() => { setEditInfo(false); reload() }} /> : <button type="button" className="text-sm font-bold underline" onClick={() => setEditInfo(true)}>Edit address, Instagram, or website</button>}

      {p.perk ? <Perks p={p} /> : (
        <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
          <p className="font-extrabold">Unlock more with a scan ad</p>
          <p>Run a scan ad (below) and your listing gets: 💛 a Good Neighbor badge, ⭐ a Featured spot at the top on your nights, 🔥 Tonight-only posts at the top, and 📷 photos. Your ad money pays people going through hard times for each real scan.</p>
        </div>
      )}
    </div>
  )
}

function MyEvent({ e, upd, del, reload }) {
  const [edit, setEdit] = useState(false)
  const days = e.days.map((d) => DAYS[d]).join(', ') + (e.weeks ? ` (${e.weeks.map((w) => ['1st', '2nd', '3rd', '4th', '5th'][w - 1]).join(' & ')} of month)` : '')
  return (
    <div className={`rounded-xl border-2 p-3 ${e.needs_confirm || !e.active ? 'border-yellow-400' : 'border-green-500'}`}>
      <p className="text-sm font-bold">{days} · {e.time_text}</p>
      <p className="font-extrabold">{e.title}</p>
      {e.deal_text && <p className="text-sm font-bold">{e.deal_text}</p>}
      {e.needs_confirm && <p className="text-sm">Hidden until checked. Is this right?</p>}
      {!e.active && <p className="text-sm">Turned off.</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {e.needs_confirm
          ? <button type="button" className="btn-orange py-2" onClick={() => upd(e.id, { needs_confirm: false, last_checked: today() })}>✅ It’s right, show it</button>
          : <button type="button" className="btn-outline py-2" onClick={() => upd(e.id, { last_checked: today() })}>Still right</button>}
        <button type="button" className="btn-outline py-2" onClick={() => setEdit(!edit)}>{edit ? 'Close' : 'Edit'}</button>
        <button type="button" className="btn-outline py-2" onClick={() => upd(e.id, { active: !e.active })}>{e.active ? 'Turn off' : 'Turn on'}</button>
        <button type="button" className="btn-outline py-2 text-red-600" onClick={() => del(e)}>Delete</button>
      </div>
      {edit && <EventForm e={e} owner onDone={() => { setEdit(false); reload() }} />}
    </div>
  )
}

function InfoForm({ p, onDone }) {
  const [f, setF] = useState({ address: p.address || '', instagram: p.instagram || '', website: p.website || '' })
  const [err, setErr] = useState(null)
  async function save() {
    const { error } = await supabase.from('tonight_places').update({ address: f.address.trim(), instagram: f.instagram.replace(/^@/, '').trim() || null, website: f.website.trim() || null }).eq('id', p.id)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      {err && <Notice kind="error">{err}</Notice>}
      <input className="input" placeholder="Full street address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <input className="input" placeholder="Instagram name (no @)" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
      <input className="input" placeholder="Website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <p className="muted text-xs">To change your name or neighborhood, use Contact us.</p>
      <button type="button" className="btn-black w-full" onClick={save}>Save</button>
    </div>
  )
}

// Paid perks: tonight-only post + photos. Featured spot and badge happen on their own.
function Perks({ p }) {
  const [boost, setBoost] = useState(undefined)
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    const { data } = await supabase.from('tonight_boosts').select('*').eq('place_id', p.id).eq('day', today()).maybeSingle()
    setBoost(data || null)
    const { data: ph } = await supabase.from('tonight_photos').select('*').eq('place_id', p.id).neq('status', 'rejected').order('created_at')
    setPhotos(ph || [])
  }
  useEffect(() => { load() }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function post() {
    setErr(null)
    if (text.trim().length < 3) return setErr('Write your deal first.')
    if (hasAlcohol(text)) return setErr('Tonight-only posts can’t mention alcohol. Try a food deal, live music, or an event.')
    const { error } = await supabase.from('tonight_boosts').insert({ place_id: p.id, body: text.trim() })
    if (error) return setErr(error.message.includes('check') ? 'That can’t be posted. Keep it short and with no alcohol.' : error.message)
    setText(''); load()
  }
  async function removeBoost() { await supabase.from('tonight_boosts').delete().eq('id', boost.id); load() }
  async function upload(file) {
    if (!file) return
    setErr(null); setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/tonight/${p.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: false })
    if (error) { setBusy(false); return setErr(error.message) }
    const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    const { error: e2 } = await supabase.from('tonight_photos').insert({ place_id: p.id, url })
    setBusy(false)
    if (e2) return setErr(e2.message)
    load()
  }
  async function delPhoto(ph) { if (!window.confirm('Delete this photo?')) return; await supabase.from('tonight_photos').delete().eq('id', ph.id); load() }
  if (boost === undefined) return null
  return (
    <div className="space-y-4 rounded-xl border-2 border-orange p-3">
      <p className="font-extrabold">💛 Your Good Neighbor perks</p>
      <p className="text-sm">Your badge shows on your listing. On your nights, you can also show up in the ⭐ Featured spot at the top (food, music, and events only).</p>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="space-y-2">
        <p className="font-bold">🔥 Tonight-only post</p>
        <p className="muted text-sm">Slow night? Post a deal for today only. It goes at the top of Tonight until midnight. One a day. No alcohol.</p>
        {boost ? (
          <div className="rounded-xl bg-orange p-3 text-ink"><p className="font-extrabold">{boost.body}</p>{boost.hidden && <p className="text-sm">Hidden by Us In It.</p>}<button type="button" className="mt-1 text-sm font-bold underline" onClick={removeBoost}>Take it down</button></div>
        ) : (
          <>
            <input className="input" maxLength={90} placeholder="e.g. Half-price wings until 9 PM" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" className="btn-orange w-full" onClick={post}>Post for tonight</button>
          </>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-bold">📷 Photos (up to 3)</p>
        <p className="muted text-sm">Food, your room, your stage. No alcohol in photos. We check each one before it shows.</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="relative">
              <img src={ph.url} alt="" className="h-24 w-24 rounded-xl object-cover" />
              <p className="text-center text-xs">{ph.status === 'pending' ? 'Waiting for OK' : 'Showing'}</p>
              <button type="button" onClick={() => delPhoto(ph)} className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-white" aria-label="Delete photo">×</button>
            </div>
          ))}
        </div>
        {photos.length < 3 && (
          <label className="btn-outline block w-full cursor-pointer text-center">{busy ? 'Uploading…' : '+ Add a photo'}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  )
}
