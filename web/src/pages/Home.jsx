import { Link } from 'react-router-dom'
import { money, useStats } from '../lib/supabase'
import { getImpact } from '../lib/impact'

export function GoalTracker({ stats, compact }) {
  if (!stats) return null
  const raised = stats.raised_cents || 0
  const goal = stats.launch_goal_cents || 500000
  const pct = Math.min(100, Math.round((raised / goal) * 100))
  return (
    <div className={compact ? '' : 'card'}>
      <p className="font-bold">
        We've raised {money(raised)} of our {money(goal)} launch goal
        {stats.supporters ? ` from ${stats.supporters} supporter${stats.supporters === 1 ? '' : 's'}` : ''}.
      </p>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-3 rounded-full bg-orange" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const Step = ({ n, title }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange font-extrabold text-ink">{n}</div>
    <p className="pt-1 font-bold">{title}</p>
  </div>
)

export default function Home() {
  const stats = useStats()
  const impact = getImpact()
  const s = stats?.settings || {}
  const headline = s.home_headline || 'Local businesses pay people on our streets to share their messages.'
  const sub = s.home_subline || "Every scan of a holder's QR code shows a local ad, and the holder gets paid for it. A new, honest way to earn, and a new way for businesses to reach their neighbors."
  const launch = s.home_launch_line || "We're launching now. Neighbors are funding scans until local businesses come on board."
  return (
    <div>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:pt-14">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{headline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-300">{sub}</p>
          {impact && impact.allScans > 0 && (
            <p className="mt-4 inline-block rounded-xl bg-orange px-4 py-2 font-extrabold text-ink">
              {impact.monthPeople > 0 ? `You've helped ${impact.monthPeople} ${impact.monthPeople === 1 ? 'person' : 'people'} this month 💛` : `You've helped ${impact.allPeople} ${impact.allPeople === 1 ? 'person' : 'people'} so far 💛`}
            </p>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Step n="1" title="A business buys an ad for its neighborhood." />
            <Step n="2" title="A holder carries the QR code. People scan it and see the ad." />
            <Step n="3" title="The holder gets paid for every scan." />
          </div>
          {s.launch_line_on !== false && <p className="mt-5 rounded-xl border border-orange/50 px-4 py-3 text-sm text-orange">{launch}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link to="/advertise" className="btn-orange">Advertise with us</Link>
            <Link to="/support" className="btn bg-white text-ink hover:bg-neutral-200">Support the launch</Link>
            <Link to="/holder" className="btn border-2 border-white text-white hover:bg-neutral-800">Become a holder</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <div className="card">
          <h2 className="h2">Just scanned a code?</h2>
          <p className="muted mt-1">No cash? Scan instead. Every scan you make helps someone on our streets earn money, and it doesn't cost you anything.</p>
        </div>
        <GoalTracker stats={stats} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <h2 className="h2">Community Fund</h2>
            <p className="muted mt-1">Pays holders for scans while businesses come on board.</p>
            <p className="mt-3 text-3xl font-extrabold">{stats ? money(stats.fund_balance_cents) : '…'}</p>
            <p className="muted text-sm">
              {stats ? `Powers about ${Math.floor((stats.fund_balance_cents || 0) / (stats.price_per_scan_cents || 50)).toLocaleString()} more scans` : ''}
            </p>
            <Link to="/fund" className="btn-black mt-4">Fund scans for everyone</Link>
          </div>
          <div className="card">
            <h2 className="h2">Become a Founding Supporter</h2>
            <p className="muted mt-1">$5 a week for 2 months keeps holders earning while we prove it works and bring businesses on board.</p>
            <Link to="/support" className="btn-orange mt-4">Support the launch</Link>
          </div>
          <div className="card">
            <h2 className="h2">Advertise locally</h2>
            <p className="muted mt-1">Pick your neighborhood, pay only for real scans by real people nearby.</p>
            <Link to="/advertise" className="btn-black mt-4">Advertise with us</Link>
          </div>
          <div className="card">
            <h2 className="h2">Earn with Us In It</h2>
            <p className="muted mt-1">Carry your own QR code and get paid for every scan. Make your own account to get started.</p>
            <Link to="/holder" className="btn-black mt-4">Become a holder</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
