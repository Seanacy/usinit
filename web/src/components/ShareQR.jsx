import { useState } from 'react'
import { useQR } from './Printables'

// A QR code you can pull up on your phone, show someone, and share.
export default function ShareQR({ url, title, label = 'Show QR code' }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const qr = useQR(url)
  const shown = url.replace(/^https?:\/\//, '')

  async function share() {
    try {
      if (qr && navigator.canShare) {
        const blob = await (await fetch(qr)).blob()
        const file = new File([blob], 'us-in-it-qr.png', { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: `${title} ${url}` })
          return
        }
      }
      if (navigator.share) { await navigator.share({ title, text: title, url }); return }
      copy()
    } catch { /* closed share sheet */ }
  }
  function copy() {
    navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <button type="button" className="btn-black w-full" onClick={() => setOpen(true)}>📱 {label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-white p-6 text-center text-neutral-900">
          <p className="text-2xl font-extrabold">{title}</p>
          {qr ? <img src={qr} alt={`QR code for ${shown}`} className="w-full max-w-sm" /> : <p>Loading…</p>}
          <p className="text-lg font-bold">{shown}</p>
          <div className="grid w-full max-w-sm gap-2">
            <button type="button" className="btn-orange w-full" onClick={share}>Share</button>
            <button type="button" className="btn-outline w-full" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
            {qr && <a className="btn-outline w-full" href={qr} download="us-in-it-qr.png">Save picture</a>}
            <button type="button" className="mt-2 font-bold underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
