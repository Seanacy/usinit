import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deviceId, supabase } from '../lib/supabase'
import { IMIN_MESSAGES, impactLine, num } from '../lib/imin'
import { BadgeShare } from '../components/ImInClaim'
import { Spinner } from '../components/Layout'

function HowToJoin({ refCode }) {
  return (
    <div className="space-y-3">
      <h2 className="h2">Get your own badge</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card"><p className="font-extrabold">Scan a holder (free)</p><p className="muted text-sm">See someone with an Us In It code? Scan it with location on. Your badge button shows after the scan.</p></div>
        <div className="card"><p className="font-extrabold">Support or give</p><p className="muted text-sm">Every gift pays people on our streets for scans. Your badge shows your impact.</p>
          <Link to={`/support${refCode ? `?ref=${refCode}` : ''}`} className="btn-orange mt-3 block w-full text-center">Support Us In It</Link></div>
      </div>
    </div>
  )
}

// usinit.com/in/:code — one person's badge
export function ImInBadge() {
  const { code } = useParams()
  const [b, setB] = useState(undefined)
  const [mine, setMine] = useState(false)
  useEffect(() => {
    supabase.rpc('get_im_in', { p_code: code }).then(({ data }) => setB(data || null))
    supabase.rpc('my_im_in', { p_device: deviceId() }).then(({ data }) => {
      const own = data && data === String(code).toUpperCase()
      setMine(!!own)
      if (!own) { try { localStorage.setItem('uii_inref', String(code).toUpperCase()) } catch { /* ignore */ } }
    })
  }, [code])
  if (b === undefined) return <Spinner />
  if (!b) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">That badge isn't here</p><Link to="/support" className="mt-4 inline-block font-bold underline">Support Us In It</Link></div>
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="rounded-3xl border-4 border-orange bg-ink p-6 text-center text-white">
        <p className="font-bold text-orange">[ Us In It ]</p>
        <p className="text-6xl font-black">I'M IN</p>
        <p className="mt-1 text-xl font-extrabold text-orange">Supporter {num(b.number)}</p>
        <p className="mt-4 text-2xl font-extrabold">{IMIN_MESSAGES[b.message_key]}</p>
        <p className="mt-3 text-neutral-300">{impactLine(b)}</p>
        {b.neighborhood && <p className="text-neutral-300">📍 {b.neighborhood}</p>}
      </div>
      <div className="card text-center">
        <p className="text-4xl font-black text-orange">{b.ripple}</p>
        <p className="font-bold">{b.ripple === 1 ? 'person joined' : 'people joined'} because of this badge</p>
      </div>
      {mine ? (
        <div className="space-y-3"><h2 className="h2">Share your badge</h2><BadgeShare badge={b} /></div>
      ) : (
        <HowToJoin refCode={b.code} />
      )}
    </div>
  )
}

// usinit.com/in — the movement + neighborhood leaderboard
export default function ImInHome() {
  const [d, setD] = useState(null)
  const [mine, setMine] = useState(null)
  useEffect(() => {
    supabase.rpc('im_in_leaderboard').then(({ data }) => setD(data || { total: 0, month: 0, hoods: [] }))
    supabase.rpc('my_im_in', { p_device: deviceId() }).then(({ data }) => setMine(data || null))
  }, [])
  if (!d) return <Spinner />
  const month = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Chicago' })
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="text-6xl font-black">I'M IN</p>
        <p className="mt-2 text-xl font-extrabold text-orange">Not a handout. A paycheck.</p>
        <p className="mt-3 text-neutral-300">People on our streets earn money every time someone scans their code. Local businesses pay for it. Join the movement and wear the badge.</p>
        <p className="mt-4 text-4xl font-black">{d.total.toLocaleString()}</p>
        <p className="text-neutral-300">people are in</p>
        {mine && <Link to={`/in/${mine}`} className="btn-orange mt-4 inline-block">See my badge</Link>}
      </div>

      <div className="space-y-3">
        <h2 className="h2">Neighborhood leaderboard · {month}</h2>
        <p className="muted text-sm">Points: 5 for each new badge, 1 for each scan, 1 for every scan a gift pays for. Resets every month.</p>
        {d.hoods.length === 0 && <p className="muted">No neighborhoods on the board yet. Get your badge and put yours first.</p>}
        {d.hoods.map((h, i) => (
          <div key={h.name} className={`card flex items-center gap-4 ${i === 0 ? 'border-2 border-orange' : ''}`}>
            <p className="w-8 text-2xl font-black text-orange">{i + 1}</p>
            <div className="flex-1">
              <p className="text-lg font-extrabold">{h.name}</p>
              <p className="muted text-sm">{h.badges} badge{h.badges === 1 ? '' : 's'} · {h.scans} scans{h.gave_cents > 0 ? ` · $${Math.round(h.gave_cents / 100)} given` : ''}</p>
            </div>
            <p className="text-2xl font-black">{h.points}</p>
          </div>
        ))}
      </div>
      {!mine && <HowToJoin />}
    </div>
  )
}
