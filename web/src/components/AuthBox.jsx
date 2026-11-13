import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Notice } from './Layout'

export default function AuthBox({ title = 'Log in or sign up', intro, redirectPath }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const redirect = window.location.origin + (redirectPath || window.location.pathname)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!email.includes('@')) return setMsg({ kind: 'error', text: 'Enter a real email address.' })
    if (mode !== 'reset' && password.length < 8) return setMsg({ kind: 'error', text: 'Password needs at least 8 characters.' })
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMsg({ kind: 'ok', text: 'Check your email and tap the link to confirm your account. Then come back here and log in.' })
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset' })
        if (error) throw error
        setMsg({ kind: 'ok', text: 'If that email has an account, a reset link is on its way.' })
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mx-auto w-full max-w-md">
      <h1 className="h2 mb-1">{mode === 'reset' ? 'Reset your password' : title}</h1>
      {intro && mode !== 'reset' && <p className="muted mb-4">{intro}</p>}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('signup')} className={mode === 'signup' ? 'btn-black' : 'btn-outline'}>Sign up</button>
        <button type="button" onClick={() => setMode('login')} className={mode === 'login' ? 'btn-black' : 'btn-outline'}>Log in</button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
        </div>
        {mode !== 'reset' && (
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button className="btn-orange w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'login' ? 'Log in' : 'Send reset link'}
        </button>
      </form>
      <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}>
        {mode === 'reset' ? 'Back to log in' : 'Forgot your password?'}
      </button>
    </div>
  )
}
