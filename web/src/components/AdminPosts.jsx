import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CENTRAL_TZ, supabase, uploadPhoto, useSession } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

const EMPTY = { kind: 'thought', title: '', body: '', photo_url: '', event_at: '', event_place: '', pinned: false, published: true }

// datetime-local input value in Central time <-> ISO
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: CENTRAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`
}
function fromLocalInput(v) {
  if (!v) return null
  // treat the typed time as Central time
  const guess = new Date(`${v}:00Z`)
  const offset = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })) - new Date(guess.toLocaleString('en-US', { timeZone: CENTRAL_TZ }))
  return new Date(guess.getTime() + offset).toISOString()
}

export default function AdminPosts() {
  const session = useSession()
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const load = () => supabase.from('site_posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  function edit(p) {
    setEditing(p.id)
    setForm({ ...EMPTY, ...p, photo_url: p.photo_url || '', event_place: p.event_place || '', event_at: toLocalInput(p.event_at) })
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditing(null); setForm(EMPTY) }

  async function photo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setMsg(null)
    try { setForm({ ...form, photo_url: await uploadPhoto(f, session.user.id) }) } catch (err) { setMsg({ kind: 'error', text: err.message }) }
    setBusy(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim()) return setMsg({ kind: 'error', text: 'Give the post a title.' })
    if (form.kind === 'event' && !form.event_at) return setMsg({ kind: 'error', text: 'Events need a date and time.' })
    setBusy(true); setMsg(null)
    const row = {
      kind: form.kind, title: form.title.trim(), body: form.body, photo_url: form.photo_url || null,
      event_at: form.kind === 'event' ? fromLocalInput(form.event_at) : null,
      event_place: form.kind === 'event' ? (form.event_place.trim() || null) : null,
      pinned: form.pinned, published: form.published, updated_at: new Date().toISOString(),
    }
    const { error } = editing ? await supabase.from('site_posts').update(row).eq('id', editing) : await supabase.from('site_posts').insert(row)
    setBusy(false)
    if (error) return setMsg({ kind: 'error', text: error.message })
    setMsg({ kind: 'success', text: editing ? 'Post updated.' : 'Posted.' })
    reset(); load()
  }

  async function quick(p, patch) { await supabase.from('site_posts').update(patch).eq('id', p.id); load() }
  async function remove(p) {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return
    await supabase.from('site_posts').delete().eq('id', p.id)
    if (editing === p.id) reset()
    load()
  }

  if (!rows) return <Spinner />
  return (
    <div className="space-y-6">
      <p className="muted">Posts show on <Link to="/news" className="font-bold underline">usinit.com/news</Link>. Pinned posts stay at the top.</p>
      <form onSubmit={save} className="card space-y-3">
        <h2 className="h2">{editing ? 'Edit post' : 'New post'}</h2>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div>
          <p className="label">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {[['thought', 'Thought'], ['update', 'Update'], ['event', 'Event']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} className={form.kind === k ? 'btn-orange py-2' : 'btn-outline py-2'}>{l}</button>
            ))}
          </div>
        </div>
        <label className="block"><span className="label">Title</span><input className="input" value={form.title} onChange={set('title')} maxLength={200} /></label>
        {form.kind === 'event' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Date and time (Central)</span><input type="datetime-local" className="input" value={form.event_at} onChange={set('event_at')} /></label>
            <label className="block"><span className="label">Where</span><input className="input" value={form.event_place} onChange={set('event_place')} placeholder="Lake Street, Minneapolis" /></label>
          </div>
        )}
        <label className="block"><span className="label">Post</span><textarea className="input min-h-48" value={form.body} onChange={set('body')} placeholder="Leave a blank line between paragraphs." /></label>
        <div>
          <p className="label">Photo (optional)</p>
          {form.photo_url && <img src={form.photo_url} alt="" className="mb-2 max-h-40 rounded-lg object-cover" />}
          <input type="file" accept="image/*" onChange={photo} disabled={busy} />
          {form.photo_url && <button type="button" className="ml-3 text-sm font-bold underline" onClick={() => setForm({ ...form, photo_url: '' })}>Remove photo</button>}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={set('pinned')} /> Pin to the top</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={set('published')} /> Show on the site (uncheck to save as a draft)</label>
        <div className="flex gap-2">
          <button className="btn-orange flex-1" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Post it'}</button>
          {editing && <button type="button" className="btn-outline" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="h2">All posts</h2>
        {rows.length === 0 && <p className="muted">No posts yet.</p>}
        {rows.map((p) => (
          <div key={p.id} className="card space-y-2">
            <p className="text-sm font-bold">{p.kind.toUpperCase()} · {new Date(p.created_at).toLocaleDateString('en-US', { timeZone: CENTRAL_TZ })}{p.pinned ? ' · PINNED' : ''}{p.published ? '' : ' · DRAFT'}</p>
            <p className="text-lg font-extrabold">{p.title}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline py-2" onClick={() => edit(p)}>Edit</button>
              <button className="btn-outline py-2" onClick={() => quick(p, { pinned: !p.pinned })}>{p.pinned ? 'Unpin' : 'Pin'}</button>
              <button className="btn-outline py-2" onClick={() => quick(p, { published: !p.published })}>{p.published ? 'Hide' : 'Show'}</button>
              <Link className="btn-outline py-2" to={`/news/${p.id}`}>View</Link>
              <button className="btn-outline py-2 text-red-600" onClick={() => remove(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
