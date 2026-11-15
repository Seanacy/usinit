import { useEffect, useState } from 'react'
import { SITE_URL, money, supabase } from '../lib/supabase'
import { Notice } from './Layout'

const STORES = { walmart: 'Walmart', target: 'Target' }

// Admin › Gift Tree: make private sign-up links and approve wish lists from parents.
export default function AdminGiftRequests({ onChange }) {
  const [invites, setInvites] = useState([])
  const [reqs, setReqs] = useState([])
  const [note, setNote] = useState('')
  const [review, setReview] = useState({})
  const [msg, setMsg] = useState(null)
  async function load() {
    const [{ data: i }, { data: r }] = await Promise.all([
      supabase.from('gift_invites').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('gift_requests').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setInvites(i || []); setReqs(r || [])
  }
  useEffect(() => { load() }, [])

  async function makeInvite() {
    const { data, error } = await supabase.from('gift_invites').insert({ note: note.trim() || null }).select().single()
    if (error) return setMsg({ kind: 'error', text: error.message })
    setNote(''); setMsg({ kind: 'ok', text: `New link: ${SITE_URL}/gifttree/signup/${data.code}` }); load()
  }
  function copy(code) {
    const url = `${SITE_URL}/gifttree/signup/${code}`
    if (navigator.share) navigator.share({ title: 'Gift Tree wish list', text: 'Fill out your child’s wish list here:', url }).catch(() => {})
    else navigator.clipboard?.writeText(url).then(() => setMsg({ kind: 'ok', text: 'Link copied.' }))
  }
  async function decide(r, approve) {
    const v = review[r.id] || {}
    const { error } = await supabase.rpc('admin_review_gift_request', { p_id: r.id, p_approve: approve, p_note: v.note || null, p_sort: Number(v.sort) || 0 })
    if (error) return setMsg({ kind: 'error', text: error.message })
    setMsg({ kind: 'ok', text: approve ? `"${r.child_label}" is now on the Gift Tree.` : 'Declined.' }); load(); onChange?.()
  }

  const pending = reqs.filter((r) => r.status === 'pending')
  const used = (i) => reqs.find((r) => r.invite_id === i.id)
  return (
    <div className="space-y-6">
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="card space-y-3">
        <h2 className="h2">Sign-ups</h2>
        <p className="muted text-sm">Anyone can sign up at <b>usinit.com/gifttree/signup</b> while the Gift Tree is ON. You approve every list. Want to mark a list as coming from a church? Make a one-time link below and give it to the pastor. Those lists say "from link" here.</p>
        <input className="input" placeholder="Who is this for? (only you see this, like: Pastor Mike's church)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn-outline w-full" onClick={makeInvite}>Make a one-time link (for a church or partner)</button>
        {invites.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-2 text-sm dark:border-neutral-700">
            <span><b>{i.code}</b>{i.note ? ` · ${i.note}` : ''} · {i.used_at ? (used(i) ? `used (${used(i).status})` : 'used') : 'not used yet'}</span>
            {!i.used_at && <button type="button" className="btn-outline py-1" onClick={() => copy(i.code)}>Share link</button>}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="h2">Wish lists waiting ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">None waiting.</p>}
        {pending.map((r) => (
          <div key={r.id} className="card space-y-3">
            <p className="text-lg font-extrabold">{r.child_label} · {STORES[r.store]} · {money(r.total_cents)}</p>
            <p className="muted text-sm">{r.invite_id ? `From link${invites.find((i) => i.id === r.invite_id)?.note ? `: ${invites.find((i) => i.id === r.invite_id).note}` : ''}` : 'Signed up on the website'} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            <p className="text-sm">Parent: <b>{r.parent_name}</b> · <a className="underline" href={`tel:${r.parent_phone}`}>{r.parent_phone}</a> (private)</p>
            <Notice>Before you approve, call or text the parent. Then check: no child's name or photo anywhere, every link opens a real {STORES[r.store]} item, every item is sold in the store, and the prices match.</Notice>
            {r.items.map((it, n) => (
              <div key={n} className="flex gap-3 rounded-xl border border-neutral-200 p-2 dark:border-neutral-700">
                <a href={it.image} target="_blank" rel="noopener noreferrer"><img src={it.image} alt="" className="h-20 w-20 rounded object-cover" /></a>
                <div className="text-sm">
                  <p className="font-bold">{it.name}{it.note ? ` (${it.note})` : ''}</p>
                  <p>{money(it.price_cents)}</p>
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">Open on {STORES[r.store]}</a>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Partner (like: church name)" value={review[r.id]?.note || ''} onChange={(e) => setReview({ ...review, [r.id]: { ...(review[r.id] || {}), note: e.target.value } })} />
              <input className="input" inputMode="numeric" placeholder="Order (1 fills first)" value={review[r.id]?.sort || ''} onChange={(e) => setReview({ ...review, [r.id]: { ...(review[r.id] || {}), sort: e.target.value.replace(/[^0-9]/g, '') } })} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-orange flex-1" onClick={() => decide(r, true)}>Approve (put on the tree)</button>
              <button type="button" className="btn-outline" onClick={() => decide(r, false)}>Decline</button>
            </div>
          </div>
        ))}
        {reqs.filter((r) => r.status !== 'pending').length > 0 && (
          <p className="muted text-sm">Handled: {reqs.filter((r) => r.status !== 'pending').map((r) => `${r.child_label} (${r.status})`).join(', ')}</p>
        )}
      </div>
    </div>
  )
}
