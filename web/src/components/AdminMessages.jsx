import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from './Layout'

// Admin → Messages: everything sent from the Contact page form.
export default function AdminMessages() {
  const [rows, setRows] = useState(null)
  const [show, setShow] = useState('new')
  const [pics, setPics] = useState({})

  async function load() {
    let q = supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)
    if (show !== 'all') q = q.eq('status', show)
    const { data } = await q
    setRows(data ?? [])
    const withPics = (data ?? []).filter((r) => r.photo_path)
    if (withPics.length) {
      const { data: signed } = await supabase.storage.from('contact').createSignedUrls(withPics.map((r) => r.photo_path), 3600)
      setPics(Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl])))
    }
  }
  useEffect(() => { load() }, [show])

  async function mark(r, status) { await supabase.from('contact_messages').update({ status }).eq('id', r.id); load() }

  const tab = (k, t) => <button key={k} onClick={() => setShow(k)} className={`rounded-full px-4 py-2 font-bold ${show === k ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-600'}`}>{t}</button>
  return (
    <div className="space-y-4">
      <p className="muted">Messages from the Contact page. Reply from your email to the address they gave. Mark each one done when you've handled it.</p>
      <div className="flex flex-wrap gap-2">{tab('new', 'New')}{tab('done', 'Done')}{tab('all', 'All')}</div>
      {rows === null ? <Spinner /> : rows.length === 0 ? <p className="muted">No messages here.</p> : rows.map((r) => (
        <div key={r.id} className="card space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-extrabold">{r.name}{r.business ? <span className="muted font-bold"> · {r.business}</span> : null}</p>
            <p className="muted text-sm">{new Date(r.created_at).toLocaleString()}</p>
          </div>
          <p className="text-sm"><a className="font-bold underline" href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your message to Us In It')}`}>{r.email}</a>{r.phone ? <> · <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a></> : null}</p>
          <p className="whitespace-pre-wrap">{r.message}</p>
          {r.photo_path && (pics[r.photo_path]
            ? <a href={pics[r.photo_path]} target="_blank" rel="noreferrer"><img src={pics[r.photo_path]} alt="Picture they sent" className="max-h-64 rounded-xl" /></a>
            : <p className="muted text-sm">Loading picture…</p>)}
          <div className="flex gap-2">
            <a className="btn-orange" href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your message to Us In It')}`}>Reply by email</a>
            {r.status === 'new'
              ? <button className="btn-outline" onClick={() => mark(r, 'done')}>Mark done</button>
              : <button className="btn-outline" onClick={() => mark(r, 'new')}>Move back to New</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
