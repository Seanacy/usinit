import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { deviceId, money, startCheckout, supabase, useStats } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import Support from './Support'
import { ProfileCard } from './Profile'

const MILESTONES = [10, 25, 50, 100]

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}

function ContentCard({ content, scanId }) {
  if (!content) return null
  const click = () => scanId && supabase.rpc('record_click', { p_scan: scanId })
  if (content.type === 'house' && content.kind === 'positive') {
    return (
      <div className="rounded-2xl bg-orange p-6 text-ink">
        <p className="text-sm font-bold uppercase tracking-wide">A message for you</p>
        <p className="mt-2 text-2xl font-extrabold leading-snug">{content.body}</p>
        <p className="mt-3 font-bold">— Us In It</p>
      </div>
    )
  }
  const isPolitical = content.ad_type === 'political'
  const isEvent = content.ad_type === 'event'
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-ink dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
      {isPolitical && <div className="bg-ink px-4 py-1 text-xs font-bold tracking-wide text-white">PAID POLITICAL AD</div>}
      {content.type === 'house' && <div className="bg-ink px-4 py-1 text-xs font-bold tracking-wide text-orange">FROM US IN IT</div>}
      {content.image_url && <img src={content.image_url} alt="" className="max-h-72 w-full object-cover" />}
      <div className="p-5">
        <p className="text-2xl font-extrabold leading-snug">{content.headline}</p>
        {content.body && <p className="mt-2 text-lg">{content.body}</p>}
        {isEvent && content.event_start && (
          <p className="mt-2 font-bold">
            {new Date(content.event_start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {content.event_address ? ` · ${content.event_address}` : ''}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {content.button_url && (
            <a href={content.button_url} target="_blank" rel="noopener noreferrer" onClick={click} className="btn-orange">{content.button_text || 'Learn more'}</a>
          )}
          {isEvent && content.event_address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(content.event_address)}`} target="_blank" rel="noopener noreferrer" className="btn-outline">Get directions</a>
          )}
          {isEvent && content.ticket_url && <a href={content.ticket_url} target="_blank" rel="noopener noreferrer" className="btn-outline">Get tickets</a>}
        </div>
        {isPolitical && content.political_committee && (
          <p className="muted mt-4 text-xs">Prepared and paid for by the {content.political_committee}{content.political_address ? `, ${content.political_address}` : ''}.</p>
        )}
      </div>
    </div>
  )
}

function Confetti() {
  const items = ['🎉', '🧡', '✨', '🙌', '🎊', '⭐']
  return (
    <div className="confetti pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }}>{items[i % items.length]}</span>
      ))}
    </div>
  )
}

function TipPanel({ code, firstName, scanId, stats }) {
  const [amount, setAmount] = useState(300)
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const s = stats?.settings || {}
  const cents = other ? Math.round(Number(other) * 100) : amount
  const fee = Math.round(cents * (Number(s.stripe_fee_pct ?? 2.9) / 100)) + Number(s.stripe_fee_fixed_cents ?? 30)
  const platform = Math.round(cents * (Number(s.tip_platform_pct ?? 10) / 100))
  const gets = Math.max(0, cents - fee - platform)
  async function tip() {
    setErr(null)
    if (!(cents >= 100)) return setErr('Tips start at $1.')
    setBusy(true)
    try { await startCheckout({ kind: 'tip', holder_code: code, amount_cents: cents, scan_id: scanId }) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="mt-3 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
      <div className="grid grid-cols-4 gap-2">
        {[100, 300, 500, 1000].map((a) => (
          <button key={a} onClick={() => { setAmount(a); setOther('') }} className={`rounded-xl border-2 py-3 text-lg font-extrabold ${!other && amount === a ? 'border-orange bg-orange text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>${a / 100}</button>
        ))}
      </div>
      <input className="input mt-2" inputMode="decimal" placeholder="Other amount, like 7" value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Other tip amount in dollars" />
      {cents >= 100 && <p className="mt-2 text-sm font-bold">{firstName} gets about {money(gets)}. Card fees and a {s.tip_platform_pct ?? 10}% Us In It fee come out first. Not tax-deductible.</p>}
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <button className="btn-orange mt-3 w-full" onClick={tip} disabled={busy}>{busy ? 'Opening checkout…' : `Tip ${money(cents || 0)}`}</button>
    </div>
  )
}

export default function Scan() {
  const { code } = useParams()
  const stats = useStats()
  const [step, setStep] = useState('intro')
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [wait, setWait] = useState(5)
  const [panel, setPanel] = useState(null)
  const [holder, setHolder] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    supabase.rpc('get_public_holder', { p_code: code }).then(({ data }) => setHolder(data || false))
  }, [code])

  async function go() {
    if (started.current) return
    started.current = true
    setStep('loading')
    const loc = await getLocation()
    const { data, error: e } = await supabase.rpc('process_scan', { p_code: code, p_lat: loc?.lat ?? null, p_lng: loc?.lng ?? null, p_device: deviceId() })
    if (e || !data) { setError('Something went wrong. Please try again.'); started.current = false; setStep('intro'); return }
    if (data.error === 'not_found') { setStep('notfound'); return }
    setRes(data)
    if (data.opener) setStep('opener')
    else if (data.content) setStep('content')
    else setStep('none')
  }

  useEffect(() => {
    if (step === 'opener') { const t = setTimeout(() => setStep(res?.content ? 'content' : 'next'), 3000); return () => clearTimeout(t) }
    if (step === 'content') {
      setWait(5)
      const iv = setInterval(() => setWait((w) => (w <= 1 ? (clearInterval(iv), 0) : w - 1)), 1000)
      return () => clearInterval(iv)
    }
  }, [step, res])

  const name = res?.holder?.first_name || holder?.first_name || 'this holder'
  const tap = (opt) => res?.scan_id && supabase.rpc('record_tap', { p_scan: res.scan_id, p_option: opt })

  if (holder === false || step === 'notfound') {
    return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">We couldn't find that code.</h1><p className="muted mt-2">Check the number on the sign and try again.</p></div>
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {step === 'intro' && (
        <div className="text-center">
          {holder?.photo_url && <img src={holder.photo_url} alt="" className="mx-auto mb-4 h-24 w-24 rounded-full object-cover" />}
          <h1 className="h1">Allow location so {holder?.first_name || 'they'} get{holder?.first_name ? 's' : ''} paid for your scan.</h1>
          <p className="muted mt-3">Your location only checks that you scanned in an Us In It area. It isn't saved with your identity.</p>
          {error && <div className="mt-3"><Notice kind="error">{error}</Notice></div>}
          <button className="btn-orange mt-6 w-full py-4 text-lg" onClick={go} disabled={holder === null}>Continue</button>
          <p className="muted mt-6 text-xs">Do not use your phone while driving.</p>
        </div>
      )}

      {step === 'loading' && <Spinner label="Checking your scan…" />}

      {step === 'opener' && (
        <div className="rounded-2xl bg-ink p-6 text-white">
          <p className="text-3xl font-extrabold">You just helped {name} earn money. 🙌</p>
          <p className="mt-3 text-lg text-neutral-200">{res.opener}</p>
        </div>
      )}

      {step === 'content' && (
        <div>
          {res.earned && <p className="mb-3 text-xl font-extrabold">You just helped {name} earn money. 🙌</p>}
          <ContentCard content={res.content} scanId={res.scan_id} />
          <button className="btn-black mt-4 w-full" disabled={wait > 0} onClick={() => setStep('next')}>{wait > 0 ? `Continue in ${wait}` : 'Continue'}</button>
        </div>
      )}

      {step === 'none' && (
        <div>
          <div className="card">
            <p className="text-xl font-extrabold">{res.earned ? `You just helped ${name} earn money. 🙌` : 'Thanks for scanning!'}</p>
            <p className="mt-2">
              {`Thank you for scanning. Want to do even more for ${name}?`}
            </p>
          </div>
          <button className="btn-black mt-4 w-full" onClick={() => setStep('next')}>Continue</button>
        </div>
      )}

      {step === 'next' && (
        <div>
          {panel === 'meet' ? (
            <div>
              <button className="mb-3 font-bold underline" onClick={() => setPanel(null)}>← Back</button>
              <ProfileCard code={code} />
              <div className="mt-4 space-y-3">
                <button className="btn-orange w-full py-4 text-lg" onClick={() => { tap('tip'); setPanel('tip') }}>Tip {name}</button>
                <button className="btn-outline w-full py-4 text-lg" onClick={() => { tap('support'); setPanel('support') }}>Support Us In It</button>
                <button className="w-full py-3 font-bold text-neutral-500" onClick={() => { tap('done'); setStep('thanks') }}>Done</button>
              </div>
            </div>
          ) : panel === 'support' ? (
            <Support embedded onBack={() => setPanel(null)} />
          ) : (
            <>
              <h1 className="h1">Want to do more for {name}?</h1>
              <div className="mt-4 space-y-3">
                <button className="btn-orange w-full py-4 text-lg" onClick={() => { tap('tip'); setPanel(panel === 'tip' ? null : 'tip') }}>Tip {name}</button>
                {panel === 'tip' && <TipPanel code={code} firstName={name} scanId={res?.scan_id} stats={stats} />}
                <button className="btn-black w-full py-4 text-lg" onClick={() => { tap('meet'); setPanel('meet') }}>Meet {name}</button>
                <button className="btn-outline w-full py-4 text-lg" onClick={() => { tap('support'); setPanel('support') }}>Support Us In It</button>
                <a href="/fund" className="block text-center text-sm font-bold underline">Or give once to the Community Fund</a>
                <button className="w-full py-3 font-bold text-neutral-500" onClick={() => { tap('done'); setStep('thanks') }}>Done</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'thanks' && res && (
        <div className="relative text-center">
          {res.verified && MILESTONES.includes(res.count_today) && <Confetti />}
          {res.verified ? (
            <>
              <p className="text-3xl font-extrabold">You're {name}'s {ordinal(res.count_today)} scan today! 🎉</p>
              <p className="muted mt-1">(Tell {name}, they'd love to know!)</p>
              {MILESTONES.includes(res.count_today) && <p className="mt-3 text-xl font-extrabold text-orange">You just helped {name} hit {res.count_today} scans today!</p>}
              <div className="mx-auto mt-5 max-w-sm">
                <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 rounded-full bg-orange" style={{ width: `${Math.min(100, (res.count_today / res.goal) * 100)}%` }} /></div>
                <p className="mt-2 font-bold">{res.count_today >= res.goal ? `${name} reached today's goal of ${res.goal}!` : `Only ${res.goal - res.count_today} more to reach today's goal of ${res.goal}.`}</p>
              </div>
            </>
          ) : (
            <p className="text-3xl font-extrabold">Thank you for scanning. 🧡</p>
          )}
          <button className="btn-black mt-6 w-full" onClick={() => { setStep('next'); setPanel('meet') }}>See {name}'s story</button>
          <p className="muted mt-6 text-xs">Do not use your phone while driving.</p>
        </div>
      )}
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
