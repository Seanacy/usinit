import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, supabase } from '../lib/supabase'
import FundTabs from '../components/FundTabs'

// Ad Fund: totals of what local businesses have put in to pay holders. Totals only, never one business.
export default function AdFund() {
  const [s, setS] = useState(null)
  useEffect(() => { supabase.rpc('public_ad_stats').then(({ data }) => setS(data || {})) }, [])
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <FundTabs />
      <h1 className="h1">Ad Fund</h1>
      <p className="muted mt-2">Local businesses buy ads on Us In It. Every time someone scans a holder in their area, the business pays and the holder gets paid. Not a handout. A paycheck.</p>
      <div className="card mt-5">
        <p className="muted text-sm">Businesses have paid holders</p>
        <p className="text-4xl font-extrabold">{s ? money(s.paid_to_holders_cents || 0) : '…'}</p>
        <p className="muted text-xs">{s ? Number(s.ad_scans || 0).toLocaleString() : '…'} scans paid by businesses</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card"><p className="muted text-sm">Ad money ready to pay holders</p><p className="text-2xl font-extrabold">{s ? money(s.ready_cents || 0) : '…'}</p></div>
        <div className="card"><p className="muted text-sm">Backed by</p><p className="text-2xl font-extrabold">{s ? Number(s.businesses || 0).toLocaleString() : '…'}</p><p className="muted text-xs">local businesses</p></div>
      </div>
      <p className="muted mt-4 text-xs">Ad money belongs to each business until it's spent on scans. These are totals for all businesses together.</p>
      <Link to="/advertise" className="btn-orange mt-6 w-full">Advertise with Us In It</Link>
    </div>
  )
}
