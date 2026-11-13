import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SITE_URL, money, supabase, startCheckout } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import { WorkplaceSign } from '../components/Printables'

export const workplaceUrl = (slug) => `${SITE_URL}/w/${slug}`
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const KINDS = ['Nursing home / senior living', 'Daycare', 'Church', 'Hospital', 'Clinic', 'School', 'Fire station', 'Police station', 'Warehouse', 'Grocery store', 'Call center', 'Shelter / food shelf', 'Library', 'Other']

// ================= Public page: /w/:slug (the QR code in the break room and lobby) =================
export default function WorkplacePage() {
  const { slug } = useParams()
  const [w, setW] = useState(undefined)
  const [f, setF] = useState({ to: '', message: '', from: '', email: '', ok: false })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  useEffect(() => { supabase.rpc('get_workplace', { p_slug: slug }).then(({ data }) => setW(data || null)) }, [slug])
  async function send(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { data: noteId, error } = await supabase.rpc('submit_workplace_note', { p_slug: slug, p_to: f.to, p_message: f.message, p_from: f.from, p_email: f.email, p_no_private: f.ok })
    if (error) { setBusy(false); return setErr(error.message) }
    try { await startCheckout({ kind: 'love_note', note_id: noteId }) } catch (x) { setBusy(false); setErr(x.message); setSent(true) }
  }
  if (w === undefined) return <Spinner />
  if (!w) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">This page isn't open right now.</h1></div>
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div>
        <p className="muted text-sm font-bold uppercase tracking-wide">Love Notes</p>
        <h1 className="h1">For the team at {w.name}</h1>
      </div>
      {w.note ? (
        <div className="rounded-2xl bg-orange p-6 text-ink">
          <p className="text-sm font-bold uppercase tracking-wide">A thank-you for you{w.note.to ? ` · ${w.note.to}` : ''}</p>
          <p className="mt-2 text-2xl font-extrabold leading-snug">{w.note.message}</p>
          {w.note.from && <p className="mt-3 font-bold">— {w.note.from}</p>}
        </div>
      ) : (
        <div className="card"><p className="text-lg font-extrabold">No notes yet. Be the first to thank this team.</p></div>
      )}
      {w.notes_this_month > 0 && <p className="text-center font-bold">💛 {w.notes_this_month} thank-you{w.notes_this_month === 1 ? '' : 's'} for this team in the last 30 days</p>}

      <div className="card space-y-3">
        <h2 className="h2">Send a thank-you</h2>
        {sent ? (
          <Notice kind="error">Your note was saved, but the payment page didn't open. Us In It will email you to finish your {money(w.price_cents)} payment.</Notice>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <p className="muted text-sm">{money(w.price_cents)} per note, plus a small card fee. {money(w.fund_cents)} of it goes to the Us In It Community Fund, which pays people on our streets. Your thank-you also helps someone else.</p>
            <input className="input" maxLength={80} placeholder="To (optional): a unit, team, or first name, like Night shift on 2 East" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <textarea className="input min-h-[110px]" maxLength={280} placeholder="Your thank-you" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
            <p className="muted -mt-2 text-right text-xs">{f.message.length} / 280</p>
            <input className="input" maxLength={60} placeholder="From (optional), like The Lee family" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <input className="input" type="email" placeholder="Your email (for your receipt, never shown)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} />
              <span>My note has no patient, resident, or child names, no health details, and no private information. Staff first names or team names only.</span></label>
            {err && <Notice kind="error">{err}</Notice>}
            <button className="btn-orange w-full" disabled={busy}>{busy ? 'Sending…' : `Send my thank-you (${money(w.price_cents)})`}</button>
            <p className="muted text-xs">Every note is read by Us In It before it shows. Notes stay up for 30 days.</p>
          </form>
        )}
      </div>
    </div>
  )
}

// ================= Admin: Workplaces tab =================
function WorkplaceForm({ existing, onDone }) {
  const [f, setF] = useState({ name: existing?.name || '', slug: existing?.slug || '', kind: existing?.kind || KINDS[0], contact_name: existing?.contact_name || '',
    contact_title: existing?.contact_title || '', contact_email: existing?.contact_email || '', workplace_approved: existing?.workplace_approved || false, active: existing?.active ?? true })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function save(e) {
    e.preventDefault(); setErr(null)
    const row = { ...f, name: f.name.trim(), slug: slugify(f.slug || f.name) }
    if (!row.name) return setErr('Add the workplace name.')
    if (row.slug.length < 3) return setErr('The page link needs at least 3 letters or numbers.')
    const { error } = existing ? await supabase.from('workplaces').update(row).eq('id', existing.id) : await supabase.from('workplaces').insert(row)
    if (error) return setErr(error.code === '23505' ? 'That page link is taken. Try another.' : error.message)
    onDone()
  }
  return (
    <form onSubmit={save} className="card space-y-3">
      <h3 className="text-lg font-extrabold">{existing ? 'Edit workplace' : 'Add a workplace'}</h3>
      <input className="input" placeholder="Name, like Sunrise Senior Living" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: existing ? f.slug : slugify(e.target.value) })} />
      <div className="flex items-center gap-1"><span className="muted text-sm">{new URL(SITE_URL).host}/w/</span><input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} /></div>
      <select className="input" value={f.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" placeholder="Contact name" value={f.contact_name} onChange={set('contact_name')} />
        <input className="input" placeholder="Their title, like Administrator" value={f.contact_title} onChange={set('contact_title')} />
        <input className="input" placeholder="Their email" value={f.contact_email} onChange={set('contact_email')} />
      </div>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.workplace_approved} onChange={set('workplace_approved')} />
        <span>The workplace said yes to posting the code (the page stays hidden until this is checked)</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.active} onChange={set('active')} /><span>Page is on</span></label>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-outline" onClick={onDone}>Cancel</button><button className="btn-orange">Save</button></div>
    </form>
  )
}

const NOTE_STATUS = { awaiting_payment: 'waiting for payment', pending_review: 'paid, needs your review', approved: 'showing', rejected: 'rejected' }

export function AdminWorkplaces() {
  const [ws, setWs] = useState(null)
  const [notes, setNotes] = useState(null)
  const [edit, setEdit] = useState(null)
  const [printing, setPrinting] = useState(null)
  const [err, setErr] = useState(null)
  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from('workplaces').select('*').order('created_at', { ascending: false }),
      supabase.from('workplace_notes').select('*').order('created_at', { ascending: false }).limit(200),
    ])
    setWs(a.data || []); setNotes(b.data || [])
  }
  useEffect(() => { load() }, [])
  async function run(fn, args) { setErr(null); const { error } = await supabase.rpc(fn, args); if (error) setErr(error.message); load() }
  if (!ws || !notes) return <Spinner />
  if (printing) return <div><button className="no-print mb-4 font-bold underline" onClick={() => setPrinting(null)}>← Back</button><WorkplaceSign url={workplaceUrl(printing.slug)} name={printing.name} /></div>
  const wname = (id) => ws.find((w) => w.id === id)?.name || '?'
  const now = Date.now()
  return (
    <div className="space-y-6">
      <p className="muted">Workplace Love Notes: people pay to thank a team (nurses, daycare teachers, church staff). Staff scan the code in the break room or lobby to read the notes. No holder is paid per scan. {'$1'} of each note goes to the Community Fund.</p>
      {err && <Notice kind="error">{err}</Notice>}
      {edit ? <WorkplaceForm existing={edit === 'new' ? null : edit} onDone={() => { setEdit(null); load() }} /> : <button className="btn-black w-full" onClick={() => setEdit('new')}>Add a workplace</button>}
      <div className="space-y-3">
        <h2 className="h2">Workplaces</h2>
        {ws.length === 0 && <p className="muted">None yet.</p>}
        {ws.map((w) => (
          <div key={w.id} className="card space-y-1">
            <p className="font-bold">{w.name} <span className="muted text-sm font-normal">· {w.kind}{w.contact_name ? ` · ${w.contact_name}${w.contact_title ? ` (${w.contact_title})` : ''}` : ''}</span></p>
            <p className="text-sm">{!w.workplace_approved ? 'Hidden: waiting for the workplace to say yes' : w.active ? 'Live' : 'Turned off'} · <a className="underline" href={workplaceUrl(w.slug)} target="_blank" rel="noreferrer">{workplaceUrl(w.slug)}</a></p>
            <div className="flex flex-wrap gap-2 pt-1"><button className="btn-black py-2" onClick={() => setEdit(w)}>Edit</button><button className="btn-outline py-2" onClick={() => setPrinting(w)}>Print the code</button></div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="h2">Notes</h2>
        {notes.length === 0 && <p className="muted">No notes yet.</p>}
        {notes.map((n) => {
          const expired = n.status === 'approved' && n.expires_at && new Date(n.expires_at).getTime() < now
          return (
            <div key={n.id} className="card space-y-1">
              <p className="text-sm font-bold">{wname(n.workplace_id)} · {expired ? 'ended' : NOTE_STATUS[n.status]} · {money(n.price_cents)}{n.paid ? '' : ' unpaid'}</p>
              {n.to_line && <p className="text-sm">To: {n.to_line}</p>}
              <p className="whitespace-pre-line">{n.message}</p>
              <p className="muted text-sm">{n.from_line ? `From: ${n.from_line} · ` : ''}{n.buyer_email} · {n.views} views</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {!n.paid && <><button className="btn-orange py-2" onClick={() => run('admin_note_paid', { p_id: n.id, p_comp: false })}>Mark paid</button><button className="btn-outline py-2" onClick={() => run('admin_note_paid', { p_id: n.id, p_comp: true })}>Mark free (test or gift)</button></>}
                {n.status === 'pending_review' && <><button className="btn-orange py-2" onClick={() => run('admin_note_review', { p_id: n.id, p_ok: true })}>Approve</button><button className="btn-outline py-2" onClick={() => run('admin_note_review', { p_id: n.id, p_ok: false })}>Reject</button></>}
                {n.status === 'approved' && !expired && <button className="btn-outline py-2" onClick={() => run('admin_note_review', { p_id: n.id, p_ok: false })}>Take down</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
