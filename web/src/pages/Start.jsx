import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthBox from '../components/AuthBox'
import { Spinner } from '../components/Layout'
import { supabase, useSession } from '../lib/supabase'

const ROLES = [
  { key: 'holder', title: "I'm a holder", text: 'I carry an Us In It QR code and get paid when people scan it.', path: '/holder',
    box: { title: 'Holder sign up', intro: "Use an email you can check. You'll use it to log in and see your earnings." } },
  { key: 'business', title: "I'm a business", text: 'I want my ad shown to people who scan codes near my business.', path: '/advertise',
    box: { title: 'Business sign up', intro: 'Create an account to set up your ads.' } },
  { key: 'supporter', title: "I'm a supporter", text: 'I want to give to holders or the Community Fund. No account needed.', path: '/support' },
]

export function Signup() {
  const session = useSession()
  const [role, setRole] = useState(null)
  const nav = useNavigate()
  if (session === undefined) return <Spinner />
  if (session) return <AlreadyIn />
  if (role) {
    return (
      <div className="px-4 py-8">
        <AuthBox {...role.box} redirectPath={role.path} role={role.key} allowSignup={false} startMode="signup" />
        <div className="mt-4 text-center">
          <button className="text-sm font-bold underline" onClick={() => setRole(null)}>Go back and pick a different choice</button>
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="h2 mb-1">Who are you?</h1>
      <p className="muted mb-5">Pick one so we can set up the right account for you.</p>
      <div className="grid gap-3">
        {ROLES.map((r) => (
          <button key={r.key} onClick={() => (r.box ? setRole(r) : nav(r.path))} className="card text-left transition hover:border-orange">
            <div className="text-lg font-black">{r.title}</div>
            <div className="muted mt-1 text-sm">{r.text}</div>
          </button>
        ))}
      </div>
      <p className="muted mt-6 text-center text-sm">Already have an account? <Link to="/login" className="font-bold underline">Log in</Link></p>
    </div>
  )
}

// After log in, send each person to their own page.
async function homeFor(user) {
  const { data: admin } = await supabase.rpc('is_admin')
  if (admin) return '/admin'
  const { data: h } = await supabase.from('holders').select('id').eq('user_id', user.id).maybeSingle()
  if (h) return '/holder'
  const { data: a } = await supabase.from('advertisers').select('id').eq('user_id', user.id).maybeSingle()
  if (a) return '/advertise'
  const r = user.user_metadata?.role
  if (r === 'holder') return '/holder'
  if (r === 'business') return '/advertise'
  return null
}

function AlreadyIn() {
  const session = useSession()
  const nav = useNavigate()
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!session) return
    homeFor(session.user).then((p) => (p ? nav(p, { replace: true }) : setStuck(true)))
  }, [session, nav])
  if (!stuck) return <Spinner />
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="h2">You're logged in</h1>
      <p className="muted mt-2">Where do you want to go?</p>
      <div className="mt-6 grid gap-3">
        <Link to="/holder" className="btn-orange">I'm a holder</Link>
        <Link to="/advertise" className="btn-black">I'm a business</Link>
      </div>
    </div>
  )
}

export function Login() {
  const session = useSession()
  if (session === undefined) return <Spinner />
  if (session) return <AlreadyIn />
  return (
    <div className="px-4 py-8">
      <AuthBox title="Log in" allowSignup={false} redirectPath="/login" />
      <p className="muted mt-4 text-center text-sm">New here? <Link to="/signup" className="font-bold underline">Sign up</Link></p>
    </div>
  )
}
