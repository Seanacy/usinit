import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, supabase, uploadPhoto, useSession } from '../lib/supabase'
import AuthBox from '../components/AuthBox'
import { Notice, Spinner } from '../components/Layout'
import Printables, { scanUrl, useQR } from '../components/Printables'
import { HolderShares } from './Booking'

function ProfileForm({ session, existing, onSaved }) {
  const [f, setF] = useState({
    first_name: existing?.first_name || '', story: existing?.story || '', general_area: existing?.general_area || '',
    photo_url: existing?.photo_url || '', listed_in_directory: existing?.listed_in_directory || false, allow_champions: existing?.allow_champions || false,
  })
  const [agree, setAgree] = useState(!!existing)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function photo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr(null)
    try { setF({ ...f, photo_url: await uploadPhoto(file, session.user.id) }) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  async function save(e) {
    e.preventDefault(); setErr(null)
    if (!f.first_name.trim()) return setErr('Add your first name.')
    if (!agree) return setErr('Please read and accept the Holder Agreement.')
    setBusy(true)
    const row = { ...f, first_name: f.first_name.trim() }
    const q = existing
      ? supabase.from('holders').update(row).eq('id', existing.id)
      : supabase.from('holders').insert({ ...row, user_id: session.user.id, agreement_accepted_at: new Date().toISOString() })
    const { error } = await q
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="h2">{existing ? 'Edit your profile' : 'Tell people about you'}</h2>
      <div>
        <label className="label" htmlFor="fn">First name only</label>
        <input id="fn" className="input" maxLength={40} value={f.first_name} onChange={set('first_name')} placeholder="Marcus" />
      </div>
      <div>
        <p className="label">Photo (optional, but people give more when they can see you)</p>
        <div className="flex items-center gap-3">
          {f.photo_url && <img src={f.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />}
          <label className="btn-outline cursor-pointer">
            {f.photo_url ? 'Change photo' : 'Take or pick a photo'}
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={photo} />
          </label>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="story">Your story, in your own words (optional)</label>
        <p className="muted mb-2 text-sm">People read this when they tap "Meet" after scanning your code. You can add it now or later. Ideas: What's one thing you want people to know about you? What are you working toward? What do you like to do? Share only what you're comfortable sharing.</p>
        <textarea id="story" className="input min-h-[140px]" maxLength={1000} value={f.story} onChange={set('story')} placeholder="I'm Marcus. I grew up in north Minneapolis and I'm saving for a deposit on an apartment…" />
        <p className="muted mt-1 text-right text-xs">{f.story.length} / 1000</p>
      </div>
      <div>
        <label className="label" htmlFor="area">General area (never an exact corner)</label>
        <input id="area" className="input" maxLength={80} value={f.general_area} onChange={set('general_area')} placeholder="Uptown, Downtown, Lake Street…" />
      </div>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.listed_in_directory} onChange={set('listed_in_directory')} /><span>List me in the public directory</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={f.allow_champions} onChange={set('allow_champions')} /><span>Allow Champions to print and share my code</span></label>
      {!existing && (
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF6A00]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I read and agree to the <Link to="/holder-agreement" target="_blank" className="font-bold underline">Holder Agreement</Link>, including the walking rules.</span>
        </label>
      )}
      {existing && <p className="muted text-sm">Changes to your name, photo, and story show right away. Us In It may review them.</p>}
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Send for approval'}</button>
    </form>
  )
}

function Stars({ code }) {
  const [n, setN] = useState(null)
  useEffect(() => { if (code) supabase.rpc('get_public_holder', { p_code: code }).then(({ data }) => setN(data?.stars ?? null)) }, [code])
  if (n === null) return null
  return <p className="mt-1 text-sm font-bold">⭐ {n} {n === 1 ? 'person is' : 'people are'} rooting for you</p>
}

function Dashboard({ d, session, reload }) {
  const h = d.holder
  const [edit, setEdit] = useState(false)
  const [print, setPrint] = useState(false)
  const qr = useQR(h.holder_code ? scanUrl(h.holder_code) : 'https://usinit.com')
  if (edit) return <ProfileForm session={session} existing={h} onSaved={() => { setEdit(false); reload() }} />
  if (print) return <div><button className="no-print mb-4 font-bold underline" onClick={() => setPrint(false)}>← Back to dashboard</button><Printables holder={h} /></div>

  if (h.status !== 'active') {
    return (
      <div className="space-y-4">
        <div className="card">
          <h2 className="h2">{h.status === 'pending' ? 'Thanks, ' + h.first_name + '! You\'re waiting for approval.' : 'Your account is turned off.'}</h2>
          <p className="muted mt-2">{h.status === 'pending' ? 'Us In It checks every new holder. Once you\'re approved, you\'ll get your 4-digit ID and QR code here.' : 'Contact Us In It for help.'}</p>
        </div>
        <button className="btn-outline w-full" onClick={() => setEdit(true)}>Edit my profile</button>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((d.count_today / d.goal) * 100))
  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4">
        {qr && <img src={qr} alt="Your QR code" className="h-28 w-28 rounded-lg" />}
        <div>
          <p className="muted text-sm">Your holder ID</p>
          <p className="text-4xl font-extrabold">#{h.holder_code}</p>
          <Link to={`/p/${h.holder_code}`} className="text-sm font-bold underline">See my public page</Link>
          <Stars code={h.holder_code} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card"><p className="muted text-sm">Balance</p><p className="text-3xl font-extrabold">{money(d.balance_cents)}</p></div>
        <div className="card"><p className="muted text-sm">Earned today</p><p className="text-3xl font-extrabold">{money(d.earned_today_cents)}</p></div>
      </div>
      <div className="card">
        <p className="font-bold">{d.count_today} scans today · goal {d.goal}</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-3 bg-orange" style={{ width: `${pct}%` }} /></div>
      </div>
      <HolderShares code={h.holder_code} />
      <div className="card">
        <h2 className="h2">Cash out</h2>
        <p className="muted mt-1">Instant cash-out to a debit card is coming soon. For now, ask Us In It or your partner organization to pay out your balance (minimum {money(d.min_payout_cents)}).</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-orange" onClick={() => setPrint(true)}>Print my sign</button>
        <button className="btn-outline" onClick={() => setEdit(true)}>Edit profile</button>
      </div>
      <div className="card">
        <h2 className="h2">History</h2>
        {d.ledger.length === 0 ? <p className="muted mt-2">No earnings yet. Your first scan will show up here.</p> : (
          <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-700">
            {d.ledger.map((l) => (
              <li key={l.id} className="flex justify-between py-2 text-sm">
                <span>{{ scan_ad: 'Scan (business ad)', scan_fund: 'Scan (Community Fund)', tip: 'Tip', payout: 'Paid out', adjustment: 'Adjustment' }[l.kind]} · {new Date(l.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                <span className={`font-bold ${l.amount_cents < 0 ? 'text-red-600' : ''}`}>{money(l.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function Holder() {
  const session = useSession()
  const [d, setD] = useState(undefined)
  const load = () => supabase.rpc('holder_dashboard').then(({ data }) => setD(data ?? null))
  useEffect(() => { if (session) load(); else if (session === null) setD(undefined) }, [session])

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {session === undefined ? <Spinner /> : !session ? (
        <>
          <h1 className="h1 mb-2">Earn with Us In It</h1>
          <p className="muted mb-6">Carry your own QR code. Every verified scan pays you. Every holder makes their own account. You can sign up on your phone, a friend's phone, or a library or shelter computer.</p>
          <AuthBox title="Holder account" intro="Use an email you can check. You'll use it to log in and see your earnings." redirectPath="/holder" role="holder" />
        </>
      ) : d === undefined ? <Spinner /> : d === null ? (
        <>
          <h1 className="h1 mb-4">Become a holder</h1>
          <ProfileForm session={session} onSaved={load} />
        </>
      ) : (
        <Dashboard d={d} session={session} reload={load} />
      )}
    </div>
  )
}
