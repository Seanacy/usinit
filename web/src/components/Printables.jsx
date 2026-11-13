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

function Verified({ className = '' }) {
  return <p className={`font-extrabold tracking-tight ${className}`}>Verified UsInIt.com</p>
}

export default function Printables({ holder }) {
  const url = scanUrl(holder.holder_code)
  const qr = useQR(url)
  const [kind, setKind] = useState('sign')
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
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>

      {kind === 'sign' && (
        <div className="print-page mx-auto flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col items-center justify-between bg-[#FF6A00] p-[6%] text-ink">
          <img src="/logo-on-orange.svg" alt="Us In It" className="w-3/4" />
          <p className="text-center text-[min(7vw,48px)] font-extrabold leading-tight">Passenger? No cash?<br />Scan to help.</p>
          <div className="w-[62%] rounded-2xl bg-white p-[3%]"><img src={qr} alt={`QR code for ${url}`} className="w-full" /></div>
          <p className="text-[min(6vw,40px)] font-extrabold">{holder.first_name} · #{holder.holder_code}</p>
          <Verified className="text-[min(4vw,24px)]" />
        </div>
      )}

      {kind === 'vest' && (
        <div className="space-y-6">
          {['Front', 'Back'].map((side) => (
            <div key={side} className="print-page mx-auto flex aspect-square w-full max-w-[10in] flex-col items-center justify-between bg-[#FF6A00] p-[6%] text-ink">
              <img src="/logo-on-orange.svg" alt="Us In It" className="w-4/5" />
              <div className="w-[58%] rounded-2xl bg-white p-[3%]"><img src={qr} alt={`QR code for ${url}`} className="w-full" /></div>
              <p className="text-center text-[min(6vw,40px)] font-extrabold">UsInIt.com · Scan to help<br />{holder.first_name} · #{holder.holder_code}</p>
              <p className="no-print muted text-sm">{side}</p>
            </div>
          ))}
        </div>
      )}

      {kind === 'card' && (
        <div className="print-page mx-auto flex h-[2.125in] w-[3.375in] items-center gap-3 rounded-xl bg-[#FF6A00] p-3 text-ink">
          <div className="w-[38%] rounded-lg bg-white p-1"><img src={qr} alt="QR code" className="w-full" /></div>
          <div className="flex-1">
            <img src="/logo-on-orange.svg" alt="Us In It" className="w-full" />
            <p className="mt-1 text-lg font-extrabold leading-tight">Holder #{holder.holder_code}</p>
            <p className="text-[10px] font-bold leading-tight">Log in at UsInIt.com to see your earnings.</p>
            <p className="text-[10px] font-extrabold">Verified UsInIt.com</p>
          </div>
        </div>
      )}
    </div>
  )
}
