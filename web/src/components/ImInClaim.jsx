import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deviceId, supabase } from '../lib/supabase'
import { HOODS, IMIN_MESSAGES, badgeImage, badgeUrl, num, shareText } from '../lib/imin'
import { Notice } from './Layout'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Shows the finished badge with Share / Save / Copy
export function BadgeShare({ badge }) {
  const [img, setImg] = useState(null)
  const [blob, setBlob] = useState(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let url
    badgeImage(badge).then((b) => { setBlob(b); url = URL.createObjectURL(b); setImg(url) })
    return () => url && URL.revokeObjectURL(url)
  }, [badge])
  async function share() {
    const text = shareText(badge)
    try {
      const file = blob && new File([blob], `im-in-${badge.code}.png`, { type: 'image/png' })
      if (file && navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text, title: "I'm in" })
      if (navigator.share) return await navigator.share({ text, url: badgeUrl(badge.code), title: "I'm in" })
      copy()
    } catch { /* closed */ }
  }
  function copy() { navigator.clipboard?.writeText(shareText(badge)); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="space-y-3">
      {img ? <img src={img} alt={`I'm In badge ${num(badge.number)}`} className="mx-auto w-full max-w-xs rounded-2xl" /> : <p className="muted">Making your badge…</p>}
      <div className="mx-auto grid max-w-xs gap-2">
        <button type="button" className="btn-orange w-full" onClick={share}>Share my badge</button>
        {img && <a className="btn-outline w-full text-center" href={img} download={`im-in-${badge.code}.png`}>Save picture</a>}
        <button type="button" className="btn-outline w-full" onClick={copy}>{copied ? 'Copied!' : 'Copy post text'}</button>
        <Link to={`/in/${badge.code}`} className="text-center text-sm font-bold underline">See my badge page and my ripple</Link>
      </div>
      <p className="muted text-center text-xs">Tag a friend: "I'm in. @___ your turn. #ImIn"</p>
    </div>
  )
}

// "Get your I'M IN badge" after a scan (kind="scan") or after giving (kind="give", sid = Stripe session)
export default function ImInClaim({ kind, sid, compact = false }) {
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(null)
  const [msg, setMsg] = useState('paycheck')
  const [hood, setHood] = useState('')
  const [showAmt, setShowAmt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [badge, setBadge] = useState(null)

  useEffect(() => {
    supabase.rpc('my_im_in', { p_device: deviceId() }).then(({ data }) => {
      if (!data) return
      supabase.rpc('get_im_in', { p_code: data }).then(({ data: b }) => {
        if (!b) return
        setExisting(b); setMsg(b.message_key); setHood(b.neighborhood || ''); setShowAmt(b.amount_cents != null)
      })
    })
  }, [])

  async function claim() {
    setBusy(true); setErr(null)
    let ref = null
    try { ref = localStorage.getItem('uii_inref') } catch { /* ignore */ }
    for (let i = 0; i < 8; i++) {
      const { data, error } = await supabase.rpc('claim_im_in', { p_kind: kind, p_ref: sid || null, p_device: deviceId(), p_message: msg, p_hood: hood || null, p_show_amount: showAmt, p_referred_by: ref })
      if (!error) {
        const { data: b } = await supabase.rpc('get_im_in', { p_code: data.code })
        setBadge(b); setBusy(false); return
      }
      if (!String(error.message).includes('PAYMENT_NOT_READY')) { setErr(error.message); setBusy(false); return }
      await wait(3000)
    }
    setErr("We're still confirming your payment. Refresh this page in a minute and try again.")
    setBusy(false)
  }

  if (badge) return <div className="mt-6"><BadgeShare badge={badge} /></div>

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`mt-6 block w-full rounded-2xl border-2 border-orange bg-ink p-4 text-left text-white ${compact ? '' : 'max-w-sm mx-auto'}`}>
        <p className="text-3xl font-black">I'M IN</p>
        <p className="font-bold text-orange">{existing ? `Update your badge ${num(existing.number)}` : 'Get your free I’M IN badge →'}</p>
        <p className="text-sm text-neutral-300">Show you're part of it. Share it and see who joins because of you.</p>
      </button>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-sm space-y-4 rounded-2xl border-2 border-orange p-4 text-left">
      <p className="text-3xl font-black">I'M IN</p>
      <div>
        <p className="label">Pick your message</p>
        <div className="grid gap-2">
          {Object.entries(IMIN_MESSAGES).map(([k, t]) => (
            <button type="button" key={k} onClick={() => setMsg(k)} className={`rounded-xl px-3 py-3 text-left font-bold ${msg === k ? 'bg-orange text-ink' : 'border border-neutral-300 dark:border-neutral-700'}`}>{t}</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">Your neighborhood (for the neighborhood leaderboard)</span>
        <select className="input" value={hood} onChange={(e) => setHood(e.target.value)}>
          <option value="">Skip</option>
          {HOODS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      {kind === 'give' && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={showAmt} onChange={(e) => setShowAmt(e.target.checked)} /> Show the dollar amount on my badge</label>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <button type="button" className="btn-orange w-full" onClick={claim} disabled={busy}>{busy ? 'Making your badge…' : existing ? 'Update my badge' : 'Make my badge'}</button>
      <p className="muted text-xs">No account needed. Your badge is saved to this phone. It never shows your name.</p>
    </div>
  )
}
