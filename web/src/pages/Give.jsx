import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money, startCheckout, supabase, useStats } from '../lib/supabase'
import { getRef } from '../lib/ref'
import { Notice } from '../components/Layout'
import { GoalTracker } from './Home'
import { cardTotal, useLaunchGive } from '../components/LaunchGive'

// Public page: "Give $3" to any holder by their number. $2 to the holder, $1 to the launch goal.
export default function Give() {
  const stats = useStats()
  const g = useLaunchGive()
  const [code, setCode] = useState('')
  const [holder, setHolder] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const s = stats?.settings || {}

  async function find() {
    setErr(null); setHolder(null)
    const c = code.replace(/[^0-9]/g, '')
    if (c.length < 3) return setErr('Type the holder number from their sign, like 5473.')
    const { data } = await supabase.rpc('get_public_holder', { p_code: c })
    if (!data) return setErr("We couldn't find that number. Check the sign and try again.")
    setHolder({ ...data, code: c })
  }
  async function startGive() {
    setErr(null); setBusy(true)
    try { await startCheckout({ holder_code: holder.code, ref: getRef(), from: 'give' }, 'launch-give') } catch (e) { setErr(e.message); setBusy(false) }
  }

  if (g && !g.on) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="h2">This way of giving is paused right now.</p><Link to="/fund" className="mt-4 inline-block font-bold underline">Give to the Community Fund instead</Link></div>
  const give = g?.give_cents ?? 300, toHolder = g?.holder_cents ?? 200, toFund = give - toHolder

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <div>
        <h1 className="h1">Give {money(give)}. Help a holder now and help launch Us In It.</h1>
        <p className="mt-3 text-lg">Every {money(give)} is split two ways:</p>
        <ul className="mt-2 space-y-2 text-lg">
          <li>💸 <b>{money(toHolder)}</b> goes straight to the holder you pick</li>
          <li>🚀 <b>{money(toFund)}</b> goes to the Community Fund, toward our beta goal, so holders get paid for every scan</li>
        </ul>
      </div>

      <GoalTracker stats={stats} />

      <div className="card space-y-3">
        <p className="font-bold">Who do you want to help?</p>
        <p className="muted text-sm">Type the number on their sign or QR code.</p>
        <div className="flex gap-2">
          <input className="input flex-1" inputMode="numeric" placeholder="Holder number, like 5473" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} aria-label="Holder number" />
          <button className="btn-black px-5" onClick={find}>Find</button>
        </div>
        {holder && (
          <div className="space-y-3 rounded-xl border-2 border-orange p-3">
            <div className="flex items-center gap-3">
              {holder.photo_url ? <img src={holder.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange text-2xl font-black text-ink">{holder.first_name?.[0]}</div>}
              <div><p className="text-xl font-extrabold">{holder.first_name}</p><p className="muted text-sm">Holder #{holder.code}</p></div>
            </div>
            <p className="text-sm">{money(toHolder)} to {holder.first_name}, {money(toFund)} to launch Us In It. {money(give)} + card fee {money(cardTotal(give, s) - give)} = <b>{money(cardTotal(give, s))}</b>. Not tax-deductible.</p>
            <button className="btn-orange w-full py-4 text-lg" onClick={startGive} disabled={busy}>{busy ? 'Opening checkout…' : `Give ${money(give)} to ${holder.first_name}`}</button>
          </div>
        )}
        {err && <Notice kind="error">{err}</Notice>}
        <p className="text-sm">Don't know anyone's number? <Link to="/directory" className="font-bold underline">Find a holder</Link></p>
      </div>

      {g && g.gifts > 0 && <p className="text-center font-bold">{g.gifts} gift{g.gifts === 1 ? '' : 's'} so far · {money(g.to_holders_cents)} straight to holders</p>}

      <p className="muted text-xs">Us In It is a business, not a charity. Gifts are not tax-deductible. Other ways to help: <Link to="/2" className="underline">the $2 Drop</Link>, <Link to="/support" className="underline">monthly support</Link>, or <Link to="/fund" className="underline">the Community Fund</Link>.</p>
    </div>
  )
}
