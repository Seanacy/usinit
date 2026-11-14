import { useState } from 'react'
import { useQR } from './Printables'

function useShare(url, title, qr) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
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
  return { share, copy, copied }
}

// Share, Copy link, Save picture buttons.
function Buttons({ url, title, qr, children }) {
  const { share, copy, copied } = useShare(url, title, qr)
  return (
    <div className="grid w-full max-w-sm gap-2">
      <button type="button" className="btn-orange w-full" onClick={share}>Share</button>
      <button type="button" className="btn-outline w-full" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
      {qr && <a className="btn-outline w-full" href={qr} download="us-in-it-qr.png">Save picture</a>}
      {children}
    </div>
  )
}

// Full-screen white QR. Used by the pop-up and by the /qr page.
export function QRFullScreen({ url, title, onClose, extra }) {
  const qr = useQR(url)
  const shown = url.replace(/^https?:\/\//, '')
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-white p-6 text-center text-neutral-900">
      <p className="text-2xl font-extrabold">{title}</p>
      {qr ? <img src={qr} alt={`QR code for ${shown}`} className="w-full max-w-sm" /> : <p>Loading…</p>}
      <p className="text-lg font-bold">{shown}</p>
      <Buttons url={url} title={title} qr={qr}>
        {onClose && <button type="button" className="mt-2 font-bold underline" onClick={onClose}>Close</button>}
        {extra}
      </Buttons>
    </div>
  )
}

// A QR code you can pull up on your phone, show someone, and share.
// inline: shows the QR right on the page, with a Full screen button.
export default function ShareQR({ url, title, label = 'Show QR code', inline = false }) {
  const [open, setOpen] = useState(false)
  const qr = useQR(url)
  const shown = url.replace(/^https?:\/\//, '')

  return (
    <>
      {inline ? (
        <div className="card flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-extrabold">Scan to support Us In It</p>
          <button type="button" onClick={() => setOpen(true)} className="w-full max-w-[16rem] rounded-xl bg-white p-2" aria-label="Show QR code full screen">
            {qr ? <img src={qr} alt={`QR code for ${shown}`} className="w-full" /> : <span className="block py-16">Loading…</span>}
          </button>
          <p className="font-bold">{shown}</p>
          <Buttons url={url} title={title} qr={qr}>
            <button type="button" className="btn-black w-full" onClick={() => setOpen(true)}>📱 {label}</button>
          </Buttons>
        </div>
      ) : (
        <button type="button" className="btn-black w-full" onClick={() => setOpen(true)}>📱 {label}</button>
      )}
      {open && <QRFullScreen url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
