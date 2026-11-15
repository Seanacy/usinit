import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, supabase, uploadPhoto, useSession } from '../lib/supabase'
import { Notice, Spinner } from './Layout'
import AdminGiftRequests from './AdminGiftRequests'

const EMPTY = { label: '', wishes: '', goal: '', sort: 0, partner: '' }

export default function AdminGiftTree() {
  const session = useSession()
  const [tags, setTags] = useState(null)
  const [pub, setPub] = useState(null)
  const [ledger, setLedger] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [shop, setShop] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    const [{ data: t }, { data: p }, { data: l }] = await Promise.all([
      supabase.from('gift_tags').select('*').order('sort').order('created_at'),
      supabase.rpc('gift_tree_public'),
      supabase.rpc('admin_gift_tree_ledger'),
    ])
    setTags(t || []); setPub(p); setLedger(l || [])
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault(); setMsg(null)
    const goal = Math.round(Number(form.goal) * 100)
    if (!form.label.trim() || !form.wishes.trim() || !(goal >= 100)) return setMsg({ kind: 'error', text: 'Add a label (like "Boy, 7"), the wish list, and a goal of at least $1.' })
    const row = { label: form.label.trim(), wishes: form.wishes.trim(), goal_cents: goal, sort: Number(form.sort) || 0, partner: form.partner.trim() || null }
    const { error } = editing ? await supabase.from('gift_tags').update(row).eq('id', editing) : await supabase.from('gift_tags').insert(row)
    if (error) return setMsg({ kind: 'error', text: error.message })
    setForm(EMPTY); setEditing(null); setMsg({ kind: 'ok', text: 'Saved.' }); load()
  }
  async function receipt(t, e) {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    try { const url = await uploadPhoto(f, session.user.id); setShop({ ...shop, [t.id]: { ...(shop[t.id] || {}), receipt: url } }) } catch (err) { setMsg({ kind: 'error', text: err.message }) }
    setBusy(false)
  }
  const pubTagMap = () => Object.fromEntries((pub?.tags || []).map((x) => [x.id, x]))
  async function shopped(t) {
    const pubTag = pubTagMap()
    const s = shop[t.id] || {}
    const cents = Math.round(Number(s.spent) * 100)
    const raised = pubTag[t.id]?.raised_cents || 0
    if (!(cents > 0)) return setMsg({ kind: 'error', text: 'Type the amount you spent first.' })
    if (cents > raised) {
      if (!window.confirm(`This tag only has ${money(raised)}. You typed ${money(cents)}, so you'd pay the other ${money(cents - raised)} yourself. Mark it shopped anyway?`)) return
    } else if (raised < t.goal_cents) {
      if (!window.confirm(`This tag isn't full yet (${money(raised)} of ${money(t.goal_cents)}). Mark it shopped anyway?`)) return
    }
    const { error } = await supabase.rpc('admin_gift_tag_shopped', { p_tag: t.id, p_spent_cents: cents, p_receipt: s.receipt || null })
    if (error) return setMsg({ kind: 'error', text: error.message })
    setMsg({ kind: 'ok', text: `Marked "${t.label}" shopped. Post the shopping trip on News as an Event!` }); load()
  }
  async function setStatus(t, status) { await supabase.from('gift_tags').update({ status }).eq('id', t.id); load() }
  async function toggleOn() {
    await supabase.from('settings').update({ value: !pub.on }).eq('key', 'gift_tree_on'); load()
  }

  if (!tags || !pub) return <Spinner />
  const pubTag = Object.fromEntries(pub.tags.map((t) => [t.id, t]))
  return (
    <div className="space-y-6">
      <p className="muted">The Gift Tree has its own money, separate from the Community Fund. Money fills open tags in order (lowest order number first). Public page: <Link to="/gifttree" className="font-bold underline">usinit.com/gifttree</Link>. Sponsor scan code: usinit.com/gt.</p>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="grid grid-cols-3 gap-3">
        <div className="card"><p className="muted text-sm">Raised</p><p className="text-2xl font-extrabold">{money(pub.raised_cents)}</p></div>
        <div className="card"><p className="muted text-sm">Spent</p><p className="text-2xl font-extrabold">{money(pub.spent_cents)}</p></div>
        <div className="card"><p className="muted text-sm">Left</p><p className="text-2xl font-extrabold">{money(pub.balance_cents)}</p></div>
      </div>
      <button className={pub.on ? 'btn-outline w-full' : 'btn-orange w-full'} onClick={toggleOn}>{pub.on ? 'Gift Tree is ON (tap to close it)' : 'Gift Tree is OFF (tap to open it)'}</button>

      <AdminGiftRequests onChange={load} />

      <form onSubmit={save} className="card space-y-3">
        <h2 className="h2">{editing ? 'Edit tag' : 'Add a tag by hand'}</h2>
        <p className="muted text-sm">Never a child's name or photo. Use age and boy/girl, like the paper tags.</p>
        <label className="block"><span className="label">Label</span><input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Boy, 7" maxLength={60} /></label>
        <label className="block"><span className="label">Wish list (one item per line, with sizes)</span><textarea className="input min-h-28" value={form.wishes} onChange={(e) => setForm({ ...form, wishes: e.target.value })} placeholder={'Winter coat (size 8)\nLego set\nSneakers (size 2)'} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Goal ($)</span><input className="input" inputMode="decimal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="120" /></label>
          <label className="block"><span className="label">Order (1 fills first)</span><input className="input" inputMode="numeric" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value.replace(/[^0-9]/g, '') })} /></label>
        </div>
        <label className="block"><span className="label">Partner who picked the family (only you see this)</span><input className="input" value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} placeholder="People Serving People" /></label>
        <div className="flex gap-2">
          <button className="btn-orange flex-1">{editing ? 'Save changes' : 'Add tag'}</button>
          {editing && <button type="button" className="btn-outline" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel</button>}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="h2">Tags</h2>
        {tags.length === 0 && <p className="muted">No tags yet.</p>}
        {tags.map((t) => (
          <div key={t.id} className="card space-y-2">
            <p className="text-lg font-extrabold">{t.label} <span className="muted text-sm font-normal">· order {t.sort} · {t.status}{t.partner ? ` · from ${t.partner}` : ''}</span></p>
            <p className="whitespace-pre-line text-sm">{t.wishes}</p>
            {t.code && <p className="text-sm">Tag code for the team (give it to the pastor or group leader): <b>usinit.com/gt/{t.code}</b></p>}
            {pubTag[t.id]?.team?.length > 0 && <p className="text-sm">Team: {pubTag[t.id].team.map((m) => `${m.name} (${m.scans})`).join(', ')}</p>}
            {t.status === 'open' && <p className="text-sm font-bold">{money(pubTag[t.id]?.raised_cents || 0)} of {money(t.goal_cents)}</p>}
            {t.status !== 'open' && <p className="text-sm">Spent {money(t.spent_cents)}{t.receipt_url ? ' · receipt posted' : ''}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline py-2" onClick={() => { setEditing(t.id); setForm({ label: t.label, wishes: t.wishes, goal: String(t.goal_cents / 100), sort: t.sort, partner: t.partner || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button>
              {t.status === 'open' && <button className="btn-outline py-2" onClick={() => setStatus(t, 'hidden')}>Hide</button>}
              {t.status === 'hidden' && <button className="btn-outline py-2" onClick={() => setStatus(t, 'open')}>Show</button>}
              {t.status === 'shopped' && <button className="btn-outline py-2" onClick={() => setStatus(t, 'delivered')}>Mark delivered</button>}
            </div>
            {t.status === 'open' && (
              <div className="space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
                <p className="text-sm font-bold">Done shopping for this tag?</p>
                <input className="input" inputMode="decimal" placeholder="Amount spent ($)" value={shop[t.id]?.spent || ''} onChange={(e) => setShop({ ...shop, [t.id]: { ...(shop[t.id] || {}), spent: e.target.value.replace(/[^0-9.]/g, '') } })} />
                <label className="block text-sm">Receipt photo (hide any card numbers) <input type="file" accept="image/*" onChange={(e) => receipt(t, e)} disabled={busy} /></label>
                {shop[t.id]?.receipt && <img src={shop[t.id].receipt} alt="Receipt" className="max-h-32 rounded" />}
                <button className="btn-black w-full py-2" onClick={() => shopped(t)}>Mark shopped</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="h2">Money in and out</h2>
        {ledger.length === 0 && <p className="muted">Nothing yet.</p>}
        {ledger.map((l) => (
          <p key={l.id} className="text-sm">{new Date(l.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {l.source} · <b>{money(l.amount_cents)}</b>{l.donor_name ? ` · ${l.donor_name}` : ''}</p>
        ))}
      </div>
    </div>
  )
}
