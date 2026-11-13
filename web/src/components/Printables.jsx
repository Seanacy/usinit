import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { IS_FINAL_DOMAIN, SITE_URL } from '../lib/supabase'
import { Notice } from './Layout'

export function useQR(url) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 1, width: 900, color: { dark: '#111111', light: '#FFFFFF' } }).then(setSrc)
  }, [url])
  return src
}

export function scanUrl(code) {
  return `${SITE_URL}/s/${code}`
}
export function hostUrl(code) {
  return `${SITE_URL}/n/${code}`
}

// Black-and-white sheet for a workplace break room or lobby (Workplace Love Notes).
export function WorkplaceSign({ url, name }) {
  const qr = useQR(url)
  if (!qr) return null
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        {!IS_FINAL_DOMAIN && <Notice kind="error">Test prints only. This QR code points to {new URL(SITE_URL).host}, not UsInIt.com yet.</Notice>}
        <p className="muted text-sm">Black and white, light on ink. Prints sideways (landscape) on one regular 8.5 x 11 sheet.</p>
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{'@page { size: letter landscape; margin: 0 }'}</style>
      <div className="print-page mx-auto flex aspect-[11/8.5] w-full max-w-[11in] items-center gap-[2.5%] border border-neutral-300 bg-white p-[3%] text-black [container-type:inline-size] print:fixed print:left-0 print:top-0 print:h-[8.5in] print:w-[11in] print:max-w-none print:border-0">
        <div className="aspect-square w-[68%] shrink-0 bg-white"><img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /></div>
        <div className="flex h-full flex-1 flex-col justify-between">
          <p className="text-[5.6cqw] font-black leading-[0.95]">Scan for<br />a note<br />for you.</p>
          <p className="text-[2.6cqw] font-extrabold leading-tight">A thank-you for the team at {name}. Send one too.</p>
          <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
          <Verified className="text-[2.3cqw] leading-tight" />
        </div>
      </div>
    </div>
  )
}

// Black-and-white sheet a business posts for another business's booking page (The Plug).
export function BookingSign({ url, title }) {
  const qr = useQR(url)
  if (!qr) return null
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        {!IS_FINAL_DOMAIN && <Notice kind="error">Test prints only. This QR code points to {new URL(SITE_URL).host}, not UsInIt.com yet.</Notice>}
        <p className="muted text-sm">Black and white, light on ink. Prints sideways (landscape) on one regular 8.5 x 11 sheet.</p>
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{'@page { size: letter landscape; margin: 0 }'}</style>
      <div className="print-page mx-auto flex aspect-[11/8.5] w-full max-w-[11in] items-center gap-[2.5%] border border-neutral-300 bg-white p-[3%] text-black [container-type:inline-size] print:fixed print:left-0 print:top-0 print:h-[8.5in] print:w-[11in] print:max-w-none print:border-0">
        <div className="aspect-square w-[68%] shrink-0 bg-white"><img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /></div>
        <div className="flex h-full flex-1 flex-col justify-between">
          <p className="text-[5.6cqw] font-black leading-[0.95]">Scan<br />to book.</p>
          <p className="text-[2.8cqw] font-extrabold leading-tight">{title}</p>
          <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
          <Verified className="text-[2.3cqw] leading-tight" />
        </div>
      </div>
    </div>
  )
}

// Black-and-white sheet a nonprofit host posts for another nonprofit's message.
export function HostSign({ code, from }) {
  const url = hostUrl(code)
  const qr = useQR(url)
  if (!qr) return null
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        {!IS_FINAL_DOMAIN && <Notice kind="error">Test prints only. This QR code points to {new URL(SITE_URL).host}, not UsInIt.com yet.</Notice>}
        <p className="muted text-sm">Black and white, light on ink. Prints sideways (landscape) on one regular 8.5 x 11 sheet.</p>
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{'@page { size: letter landscape; margin: 0 }'}</style>
      <div className="print-page mx-auto flex aspect-[11/8.5] w-full max-w-[11in] items-center gap-[2.5%] border border-neutral-300 bg-white p-[3%] text-black [container-type:inline-size] print:fixed print:left-0 print:top-0 print:h-[8.5in] print:w-[11in] print:max-w-none print:border-0">
        <div className="aspect-square w-[68%] shrink-0 bg-white"><img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /></div>
        <div className="flex h-full flex-1 flex-col justify-between">
          <p className="text-[5.6cqw] font-black leading-[0.95]">Scan for<br />a message<br />for you.</p>
          <p className="text-[2.6cqw] font-extrabold leading-tight">From {from}</p>
          <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
          <Verified className="text-[2.3cqw] leading-tight" />
        </div>
      </div>
    </div>
  )
}

export function Verified({ className = '' }) {
  return <p className={`font-extrabold tracking-tight ${className}`}>Verified UsInIt.com</p>
}

export default function Printables({ holder }) {
  const url = scanUrl(holder.holder_code)
  const qr = useQR(url)
  const [kind, setKind] = useState('sign')
  const [showName, setShowName] = useState(false)
  const label = showName && holder.first_name ? `${holder.first_name} · #${holder.holder_code}` : `#${holder.holder_code}`
  if (!qr) return null
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        {!IS_FINAL_DOMAIN && (
          <Notice kind="error">Test prints only. These QR codes point to {new URL(SITE_URL).host}, not UsInIt.com yet. Don't print signs or vests for the street until the UsInIt.com domain is connected, or the codes will need to be reprinted.</Notice>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[['sign', 'Sign'], ['vest', 'Vest / shirt'], ['card', 'Wallet card']].map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={kind === k ? 'btn-black' : 'btn-outline'}>{l}</button>
          ))}
        </div>
        {kind !== 'card' && (
          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[#FF6A00]" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
            Put my first name on this printout
          </label>
        )}
        {kind === 'sign' && <p className="muted text-sm">Black and white, light on ink. Prints sideways (landscape) on one regular 8.5 x 11 sheet.</p>}
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{kind === 'sign'
        ? '@page { size: letter landscape; margin: 0 } @media print { .print-color { -webkit-print-color-adjust: exact; print-color-adjust: exact } }'
        : '@page { size: letter; margin: 0.4in } @media print { .print-color { -webkit-print-color-adjust: exact; print-color-adjust: exact } }'}</style>

      {kind === 'sign' && (
        <div className="print-page mx-auto flex aspect-[11/8.5] w-full max-w-[11in] items-center gap-[2.5%] border border-neutral-300 bg-white p-[3%] text-black print:border-0 [container-type:inline-size] print:fixed print:left-0 print:top-0 print:h-[8.5in] print:w-[11in] print:max-w-none">
          <div className="aspect-square w-[75%] shrink-0 bg-white">
            <img src={qr} alt={`QR code for ${url}`} className="h-full w-full" />
          </div>
          <div className="flex h-full flex-1 flex-col justify-between">
            <p className="text-[7.2cqw] font-black leading-[0.95]">Scan<br />to<br />help.</p>
            <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
            <div>
              {showName && holder.first_name && <p className="text-[3.2cqw] font-extrabold leading-tight">{holder.first_name}</p>}
              <p className="text-[4.6cqw] font-black leading-none">#{holder.holder_code}</p>
              <Verified className="mt-[0.6cqw] text-[2.3cqw] leading-tight" />
            </div>
          </div>
        </div>
      )}

      {kind === 'vest' && (
        <div className="space-y-6">
          {['Front', 'Back'].map((side) => (
            <div key={side} className="print-page print-color mx-auto flex aspect-square w-full max-w-[10in] flex-col items-center justify-between bg-[#FF6A00] p-[6%] text-ink">
              <img src="/logo-on-orange.svg" alt="Us In It" className="w-4/5" />
              <div className="w-[58%] rounded-2xl bg-white p-[3%]"><img src={qr} alt={`QR code for ${url}`} className="w-full" /></div>
              <p className="text-center text-[min(6vw,40px)] font-extrabold">Scan to help<br />{label}<br /><span className="text-[0.6em]">Verified UsInIt.com</span></p>
              <p className="no-print muted text-sm">{side}</p>
            </div>
          ))}
        </div>
      )}

      {kind === 'card' && (
        <div className="print-page mx-auto flex h-[2.125in] w-[3.375in] items-center gap-3 rounded-xl border border-black bg-white p-3 text-black">
          <div className="w-[38%] bg-white"><img src={qr} alt="QR code" className="w-full" /></div>
          <div className="flex-1">
            <img src="/logo-print-bw.svg" alt="Us In It" className="w-full" />
            <p className="mt-1 text-lg font-extrabold leading-tight">Holder #{holder.holder_code}</p>
            <p className="text-[10px] font-bold leading-tight">Log in at UsInIt.com to see your earnings.</p>
            <p className="text-[10px] font-extrabold">Verified UsInIt.com</p>
          </div>
        </div>
      )}
    </div>
  )
}
