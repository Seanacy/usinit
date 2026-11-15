import { useState } from 'react'
import { SITE_URL } from '../lib/supabase'
import ShareQR from './ShareQR'

export const tagUrl = (code, champ) => `${SITE_URL}/gt/${code}${champ ? `?by=${encodeURIComponent(champ)}` : ''}`

// "Get this tag's QR code": anyone can show, share, or print it. Every scan helps this child.
export default function GiftTagTeam({ t }) {
  const [open, setOpen] = useState(false)
  if (!open) return <button type="button" className="btn-black w-full" onClick={() => setOpen(true)}>Get this tag's QR code</button>
  return (
    <div className="space-y-3 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      <p className="font-bold">Show this code to friends, family, coworkers, or your church. Every scan helps fill this tag. Share it, print it, or show it full screen.</p>
      <ShareQR inline url={tagUrl(t.code)} title={`Scan to help fill the Gift Tree tag: ${t.label}`} heading={`Scan for 🎁 ${t.label}`} label="Full screen" />
    </div>
  )
}
