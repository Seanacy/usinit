import { useEffect, useRef, useState } from 'react'
import { KEY, SUPABASE_URL, money, supabase } from '../lib/supabase'
import { Notice, Spinner } from './Layout'

const READER = `${SUPABASE_URL}/functions/v1/receipt-reader`
const bare = (h) => String(h || '').replace(/^[$@]/, '')
const dollars = (c) => (c / 100).toFixed(2)

// Opens the app with the person and amount filled in. You still tap Pay yourself.
function payLink(r) {
  if (r.method === 'venmo') {
    const q = new URLSearchParams({ txn: 'pay', audience: 'private', recipients: bare(r.handle), amount: dollars(r.amount_cents), note: 'Us In It cash-out' })
    return `https://venmo.com/?${q.toString()}`
  }
  return `https://cash.app/$${bare(r.handle)}/${dollars(r.amount_cents)}`
}

// Shrink the screenshot and turn it into a JPG (works for PNG and iPhone pictures).
function toJpegBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1])
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => reject(new Error("Couldn't open that picture. Try a normal screenshot."))
    img.src = URL.createObjectURL(file)
  })
}

function QueueCard({ r, reload }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pic, setPic] = useState(null)
  const app = r.method === 'venmo' ? 'Venmo' : 'Cash App'
  const taxFlag = !r.tax_form_on_file && r.year_paid_cents >= 150000

  async function upload(file) {
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const b64 = await toJpegBase64(file)
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch(READER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${s?.session?.access_token}` },
        body: JSON.stringify({ request_id: r.id, image_base64: b64, media_type: 'image/jpeg' }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Try again.')
      if (out.result === 'no_ai') {
        const id = prompt('Receipt saved. Type the payment ID from the receipt:')
        if (id) {
          const { error } = await supabase.rpc('admin_mark_cashout_paid', { p_req: r.id, p_payment_id: id, p_receipt_path: out.receipt_path })
          if (error) throw error
        } else {
          await supabase.rpc('admin_cashout_set_review', { p_req: r.id, p_reason: 'Receipt saved, payment ID not entered yet', p_receipt_path: out.receipt_path })
        }
      }
      reload()
    } catch (e) { setMsg(e.message) }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }
  async function markPaid() {
    const id = prompt('Payment ID from the receipt:', r.ai_result?.payment_id || '')
    if (id === null) return
    const { error } = await supabase.rpc('admin_mark_cashout_paid', { p_req: r.id, p_payment_id: id })
    setMsg(error?.message || null); reload()
  }
  async function cancel() {
    if (!confirm(`Cancel this ${money(r.amount_cents)} cash-out? The money goes back on ${r.first_name}'s balance.`)) return
    const { error } = await supabase.rpc('admin_cancel_cashout', { p_req: r.id })
    setMsg(error?.message || null); reload()
  }
  async function viewReceipt() {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(r.receipt_path, 300)
    setPic(data?.signedUrl || null)
  }

  const color = r.status === 'paid' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : r.status === 'review' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : 'border-neutral-300'
  return (
    <div className={`space-y-3 rounded-2xl border-2 p-4 ${color}`}>
      <div>
        <p className="text-3xl font-extrabold">{money(r.amount_cents)}</p>
        <p className="text-lg font-bold">→ {r.handle} <span className="muted text-sm font-normal">({app})</span></p>
        <p className="muted text-sm">{r.first_name} #{r.holder_code} · this year {money(r.year_paid_cents)}</p>
        {taxFlag && <p className="mt-1 text-sm font-bold">⚠️ Close to $2,000 and no tax form on file</p>}
      </div>

      {r.status === 'paid' ? (
        <p className="text-lg font-extrabold text-green-700 dark:text-green-400">✅ Paid{r.payment_id ? ` · ID ${r.payment_id}` : ''}</p>
      ) : (
        <>
          {r.status === 'review' && <div className="rounded-xl bg-yellow-200/70 p-2 text-sm text-black"><b>⚠️ Check this:</b> {r.review_reason}</div>}
          <a className="btn-orange block w-full py-4 text-center text-lg" href={payLink(r)} target="_blank" rel="noreferrer">1. Pay in {app}</a>
          <button className="btn-black w-full py-4 text-lg" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Reading receipt…' : '2. Add receipt'}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-4 text-sm">
            <button className="font-bold underline" onClick={markPaid}>{r.status === 'review' ? "It's right, mark paid" : 'Mark paid without receipt'}</button>
            <button className="font-bold underline" onClick={cancel}>Cancel (money goes back)</button>
          </div>
        </>
      )}
      {r.receipt_path && <button className="text-sm font-bold underline" onClick={viewReceipt}>See receipt</button>}
      {pic && <img src={pic} alt="Payment receipt" className="max-h-96 rounded-xl border" />}
      {msg && <Notice kind="error">{msg}</Notice>}
    </div>
  )
}

function toCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Date', 'Holder #', 'First name', 'Amount', 'Method', 'Note', 'Undone']
  return [head.join(','), ...rows.map((p) => [new Date(p.created_at).toLocaleString(), p.holder_code, p.first_name, dollars(p.amount_cents), p.method, p.note, p.undone ? 'yes' : ''].map(esc).join(','))].join('\n')
}

export default function AdminPayoutQueue() {
  const [q, setQ] = useState(null)
  const [sum, setSum] = useState(null)
  const [err, setErr] = useState(null)
  const load = () => {
    supabase.rpc('admin_cashout_queue').then(({ data, error }) => { setQ(data || []); if (error) setErr(error.message) })
    supabase.rpc('admin_payout_summary').then(({ data }) => setSum(data))
  }
  useEffect(() => { load() }, [])

  async function download() {
    const { data: pays } = await supabase.from('payouts').select('*').gte('created_at', `${new Date().getFullYear()}-01-01`).order('created_at', { ascending: false })
    const { data: hs } = await supabase.from('holders').select('id,holder_code,first_name')
    const byId = Object.fromEntries((hs || []).map((h) => [h.id, h]))
    const rows = (pays || []).map((p) => ({ ...p, holder_code: byId[p.holder_id]?.holder_code, first_name: byId[p.holder_id]?.first_name }))
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `us-in-it-payouts-${new Date().getFullYear()}.csv`; a.click()
  }
  async function taxOnFile(h) {
    if (!confirm(`Mark ${h.first_name} #${h.holder_code}'s tax form (W-9) as on file?`)) return
    const { error } = await supabase.rpc('admin_set_tax_form', { p_holder: h.id, p_on: true })
    setErr(error?.message || null); load()
  }

  if (!q) return <Spinner />
  const waiting = q.filter((r) => r.status !== 'paid')
  const paid = q.filter((r) => r.status === 'paid')
  const label = { cashapp: 'Cash App', venmo: 'Venmo', stripe: 'Stripe' }
  const line = (obj) => Object.entries(obj || {}).map(([k, v]) => `${label[k] || k} ${money(v)}`).join(' · ') || '$0.00'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="h2">Payout Queue</h2>
        <p className="muted text-sm">{waiting.length === 0 ? 'Nothing waiting. 🎉' : `${waiting.length} waiting. Tap Pay, send it in the app, then Add receipt.`}</p>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {waiting.map((r) => <QueueCard key={r.id} r={r} reload={load} />)}
      {paid.length > 0 && <p className="muted pt-2 text-sm font-bold">Paid in the last 2 days</p>}
      {paid.map((r) => <QueueCard key={r.id} r={r} reload={load} />)}

      {sum && (
        <div className="card space-y-2">
          <p className="font-bold">Money out</p>
          <p className="text-sm"><b>This week:</b> {line(sum.week)}</p>
          <p className="text-sm"><b>This month:</b> {line(sum.month)}</p>
          <p className="muted text-xs">Check these against your Cash App and Venmo statements each week. They should match.</p>
          <button className="btn-outline py-2" onClick={download}>Download this year's payouts (spreadsheet)</button>
        </div>
      )}

      {sum && sum.tax_watch.length > 0 && (
        <div className="card space-y-2 border-2 border-orange">
          <p className="font-bold">⚠️ Tax form watch</p>
          <p className="muted text-sm">These holders are at {money(sum.tax_warn_cents)} or more this year with no W-9. At {money(sum.tax_cap_cents)} their cash-outs stop until you mark the form on file.</p>
          {sum.tax_watch.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
              <span><b>{h.first_name} #{h.holder_code}</b> · {money(h.year_paid_cents)}</span>
              <button className="btn-outline px-3 py-1 text-sm" onClick={() => taxOnFile(h)}>W-9 on file</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
