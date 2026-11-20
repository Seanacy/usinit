import { useEffect, useState } from 'react'
import { supabase, money } from '../lib/supabase'

const day = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })

// Free trial results for one ad. Shown to Us In It (Admin) and to the business that owns the ad.
export default function TrialReport({ adId, admin }) {
  const [r, setR] = useState(undefined)
  useEffect(() => { supabase.rpc('trial_report', { p_ad: adId }).then(({ data }) => setR(data || null)) }, [adId])
  if (!r) return null
  const rows = [
    ['People who saw your ad', r.seen],
    ['People who saved your coupon', r.saved],
    ['People who walked in and used it', r.walk_ins],
    ['Holders you helped', r.holders],
  ]
  return (
    <div className="mt-3 rounded-xl border-2 border-orange bg-orange/10 p-3">
      <p className="font-extrabold">🎁 Free trial {r.running ? `· ends ${day(r.ends)}` : `· ended ${day(r.ends)}`}</p>
      <p className="text-sm">{day(r.started)} to {day(r.ends)}. {admin ? `The Community Fund paid holders ${money(r.fund_paid_cents)} for these scans.` : 'Us In It pays the holders during your trial. You pay nothing.'}</p>
      <table className="mt-2 w-full text-left text-sm">
        <tbody>
          {rows.map(([label, n]) => (
            <tr key={label} className="border-t border-orange/30"><td className="py-1.5 pr-2">{label}</td><td className="py-1.5 text-right text-lg font-extrabold">{n}</td></tr>
          ))}
        </tbody>
      </table>
      {!admin && !r.running && <p className="mt-2 text-sm font-bold">Want to keep the customers coming? Add funds above and your ad keeps running at 50¢ a real scan.</p>}
      {!admin && r.running && <p className="mt-2 text-sm">Walk-ins count when your staff types your store PIN on a customer’s coupon. Set your PIN in the Coupons box above.</p>}
    </div>
  )
}
