import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, IS_FINAL_DOMAIN, SITE_URL } from '../lib/supabase'
import { useQR } from '../components/Printables'
import { Notice, Spinner } from '../components/Layout'
import { placeLink, monthRange, monthStats } from '../lib/tonight'

// /tonight/print/:id?kind=sticker  → window sticker with a QR code to the place's listing
// /tonight/print/:id?kind=report   → monthly report (owner of the place or Us In It admin)
export default function TonightPrint() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const kind = params.get('kind') === 'report' ? 'report' : 'sticker'
  const [place, setPlace] = useState(undefined)
  useEffect(() => { supabase.from('tonight_places').select('*').eq('id', id).maybeSingle().then(({ data }) => setPlace(data || null)) }, [id])
  if (place === undefined) return <div className="py-10"><Spinner /></div>
  if (!place) return <div className="mx-auto max-w-xl p-6"><Notice kind="error">That place isn’t on Tonight.</Notice></div>
  return <div className="mx-auto max-w-3xl px-4 py-6">{kind === 'sticker' ? <Sticker place={place} /> : <Report place={place} />}</div>
}

function Sticker({ place }) {
  const url = placeLink(place.id, 'sticker')
  const qr = useQR(url)
  if (!qr) return <Spinner />
  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        <h1 className="h1">Window sticker</h1>
        {!IS_FINAL_DOMAIN && <Notice kind="error">Test prints only. This QR code points to {new URL(SITE_URL).host}, not UsInIt.com yet.</Notice>}
        <p className="muted text-sm">Prints 4 stickers on one regular 8.5 x 11 sheet. Use sticker paper, or print on plain paper and tape it inside the front window, facing out.</p>
        <button className="btn-orange w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <style>{'@page { size: letter portrait; margin: 0.25in }'}</style>
      <div className="print-page grid grid-cols-2 gap-4 print:gap-[0.25in]">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex aspect-[4/5] flex-col items-center justify-between rounded-3xl border-4 border-black bg-white p-[6%] text-center text-black [container-type:inline-size]">
            <p className="text-[9cqw] font-black leading-none">Tonight at<br />{place.name}</p>
            <img src={qr} alt={`QR code for ${place.name} specials`} className="w-[70%]" />
            <p className="text-[6cqw] font-extrabold leading-tight">Scan for our weekly<br />specials &amp; theme nights</p>
            <img src="/logo-print-bw.svg" alt="Us In It" className="w-[55%]" />
          </div>
        ))}
      </div>
    </div>
  )
}

const ROWS = [
  ['seen', 'Times your listing showed on someone’s screen'],
  ['open', 'Times people tapped to see your full page'],
  ['directions', 'Taps on 📍 Directions'],
  ['link', 'Taps on your Instagram or website'],
  ['follow', 'New followers'],
  ['sticker', 'Scans of your window sticker'],
]

function Report({ place }) {
  const [offset, setOffset] = useState(0)
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState(0)
  const m = monthRange(offset)
  useEffect(() => {
    setStats(null)
    monthStats([place.id], m.start, m.end).then((s) => setStats(s[place.id] || {}))
    supabase.from('tonight_reports').select('id', { count: 'exact', head: true }).eq('place_id', place.id).eq('status', 'open').then(({ count }) => setReports(count || 0))
  }, [place.id, offset]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button className={offset === 0 ? 'btn-black' : 'btn-outline'} onClick={() => setOffset(0)}>This month</button>
        <button className={offset === -1 ? 'btn-black' : 'btn-outline'} onClick={() => setOffset(-1)}>Last month</button>
        <button className="btn-orange" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <div className="card space-y-4 bg-white text-black print:border-0 print:shadow-none">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-neutral-500">Us In It · Tonight report</p>
          <h1 className="text-3xl font-extrabold">{place.name}</h1>
          <p className="text-lg font-bold">{m.label}</p>
        </div>
        {!stats ? <Spinner /> : (
          <table className="w-full text-left">
            <tbody>
              {ROWS.map(([k, label]) => (
                <tr key={k} className="border-t border-neutral-200">
                  <td className="py-3 pr-3">{label}</td>
                  <td className="py-3 text-right text-2xl font-extrabold">{(stats[k] || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {reports > 0 && <p className="rounded-xl bg-orange/10 p-3 font-bold">⚠️ {reports} customer note{reports === 1 ? '' : 's'} say something on your listing may be wrong.</p>}
        {!place.perk && (
          <div className="rounded-xl bg-yellow-50 p-3 text-yellow-900">
            <p className="font-extrabold">Want more people to see you?</p>
            <p>Run a scan ad on Us In It and your listing gets a 💛 Good Neighbor badge, a ⭐ Featured spot, Tonight-only posts at the top, and photos. Your ad money pays people going through hard times for each real scan.</p>
          </div>
        )}
        <p className="text-sm text-neutral-500">usinit.com/tonight</p>
      </div>
      <p className="no-print mt-4 text-sm"><Link to="/advertise" className="font-bold underline">← Back</Link></p>
    </div>
  )
}
