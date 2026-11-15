import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import { SpotlightPreview } from './SpotlightPanel'

export default function AdminSpotlights() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [notes, setNotes] = useState({})
  const load = () => supabase.rpc('admin_spotlights').then(({ data, error }) => { if (error) setErr(error.message); setRows(data || []) })
  useEffect(() => { load() }, [])
  async function review(s, ok) {
    setErr(null)
    if (!ok && s.status === 'pending' && !(notes[s.id] || '').trim()) return setErr('Write a short note so the business knows what to change.')
    if (!ok && s.status !== 'pending' && !window.confirm(`Take down "${s.headline}"?`)) return
    const { error } = await supabase.rpc('admin_review_spotlight', { p_id: s.id, p_approve: ok, p_note: notes[s.id] || (ok ? null : 'Taken down by Us In It. Edit it and send it again.') })
    if (error) setErr(error.message)
    load()
  }
  if (!rows) return <Spinner />
  const pending = rows.filter((s) => s.status === 'pending')
  const rest = rows.filter((s) => s.status !== 'pending')
  return (
    <div className="space-y-6">
      <p className="muted">Free Community Spotlights from businesses. Live spotlights share Community Fund scans (and out-of-area scans), taking turns. Approve only real, allowed products and services.</p>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="space-y-3">
        <h2 className="h2">Waiting for review ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">Nothing waiting.</p>}
        {pending.map((s) => (
          <div key={s.id} className="card space-y-3">
            <p className="text-sm font-bold">{s.business_name}{s.business_status !== 'approved' ? ` · business ${s.business_status} (won't show until the business is approved)` : ''}</p>
            <SpotlightPreview s={s} business={s.business_name} />
            {s.button_url && <p className="text-sm">Button goes to: <a href={s.button_url} target="_blank" rel="noopener noreferrer" className="underline">{s.button_url}</a></p>}
            <input className="input" placeholder="Note if it needs changes" value={notes[s.id] || ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn-orange flex-1" onClick={() => review(s, true)}>Approve</button>
              <button className="btn-outline flex-1" onClick={() => review(s, false)}>Needs changes</button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">All spotlights</h2>
        {rest.length === 0 && <p className="muted">None yet.</p>}
        {rest.map((s) => (
          <div key={s.id} className="card flex items-center justify-between gap-2">
            <div>
              <p className="font-bold">{s.headline}</p>
              <p className="muted text-sm">{s.business_name} · {s.status} · {s.views} views · {s.clicks} taps{s.boosted_ad_id ? ' · boosted' : ''}</p>
            </div>
            {s.status === 'live' && <button className="btn-outline py-2" onClick={() => review(s, false)}>Take down</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
