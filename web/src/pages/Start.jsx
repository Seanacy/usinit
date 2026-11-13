import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthBox from '../components/AuthBox'
import { Spinner } from '../components/Layout'
import { homeFor, useSession } from '../lib/supabase'

const ROLES = [
  { key: 'holder', title: "I'm a holder", text: 'I carry an Us In It QR code and get paid when people scan it.', path: '/holder',
    box: { title: 'Holder sign up', intro: "Use an email you can check. You'll use it to log in and see your earnings." } },
  { key: 'business', title: "I'm a business or nonprofit", text: 'I want my ad shown to people who scan codes near me, or my nonprofit wants to share messages with other nonprofits.', path: '/advertise',
    box: { title: 'Business or nonprofit sign up', intro: 'Create an account to set up your ads or nonprofit messages.' } },
  { key: 'champion', title: "I'm a Champion", text: "I want to print a holder's code and get scans for them at school, at work, at church, or online.", path: '/champion',
    box: { title: 'Champion sign up', intro: 'Make a free account. Then pick a holder and print your Champion code.' } },
  { key: 'creator', title: "I'm a content creator", text: 'I want a code on my videos or livestreams so viewers can support me, and I can share holders\' codes too.', path: '/creator',
    box: { title: 'Creator sign up', intro: 'Make a free account, then send your creator profile for approval.' } },
  { key: 'supporter', title: "I'm a supporter", text: "I want to star holders whose stories I like. (You don't need an account to scan or give.)", path: '/me',
    box: { title: 'Supporter sign up', intro: 'A free account lets you star holders and keep a list of the people you\'re rooting for.' } },
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
