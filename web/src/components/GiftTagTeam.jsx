import { useState } from 'react'
import { SITE_URL } from '../lib/supabase'
import ShareQR from './ShareQR'

export const tagUrl = (code, champ) => `${SITE_URL}/gt/${code}${champ ? `?by=${encodeURIComponent(champ)}` : ''}`

// "Help fill this tag": the tag's own code, plus a personal Champion link so the team board can count your scans
export default function GiftTagTeam({ t }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => { try { return localStorage.getItem('uii_gt_name') || '' } catch { return '' } })
  const [mine, setMine] = useState(null)
  function join(e) {
    e.preventDefault()
    const n = name.replace(/[^A-Za-z0-9 .'-]/g, '').trim().slice(0, 20)
    if (!n) return
    try { localStorage.setItem('uii_gt_name', n) } catch { /* ignore */ }
    setName(n); setMine(n)
  }
  if (!open) return <button type="button" className="btn-black w-full" onClick={() => setOpen(true)}>Help fill this tag</button>
  return (
    <div className="space-y-3 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
      <p className="font-bold">Everyone who scans this tag's code helps fill it. A whole team (a church, a class, a group of friends) can work on it together.</p>
      {!mine ? (
        <form onSubmit={join} className="space-y-2">
          <label className="block text-sm font-bold">Join the team: your first name or a nickname (shows on the team board)
            <input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya" /></label>
          <button className="btn-orange w-full">Get my team link</button>
          <button type="button" className="w-full text-sm font-bold underline" onClick={() => setMine('')}>Just show the tag's code</button>
        </form>
      ) : null}
      {mine !== null && (
        <>
          {mine && <p className="text-sm">Your link counts your scans as <b>{mine}</b>. Show it, share it, or print it.</p>}
          <ShareQR inline url={tagUrl(t.code, mine)} title={`Scan to help fill the Gift Tree tag: ${t.label}`} heading={`Scan for 🎁 ${t.label}`} label="Full screen" />
        </>
      )}
    </div>
  )
}
