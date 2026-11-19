import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// One-click unsubscribe from Ambassador emails (link at the bottom of every email).
export default function Unsubscribe() {
  const [params] = useSearchParams()
  const [state, setState] = useState('working')
  useEffect(() => {
    const t = params.get('t') || ''
    if (!/^[0-9a-f-]{36}$/i.test(t)) { setState('bad'); return }
    supabase.rpc('amb_unsubscribe', { p_token: t }).then(({ data, error }) => setState(error || !data ? 'bad' : 'done'))
  }, [params])
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      {state === 'working' && <p className="muted">One moment…</p>}
      {state === 'done' && (<>
        <h1 className="h1">You're unsubscribed</h1>
        <p className="muted mt-3">You won't get Ambassador update emails anymore. You can turn them back on anytime on your Ambassador page.</p>
        <Link to="/ambassador" className="btn-orange mt-6 inline-block">Go to my Ambassador page</Link>
      </>)}
      {state === 'bad' && (<>
        <h1 className="h1">That link didn't work</h1>
        <p className="muted mt-3">Log in and turn off email updates on your Ambassador page.</p>
        <Link to="/ambassador" className="btn-orange mt-6 inline-block">Go to my Ambassador page</Link>
      </>)}
    </div>
  )
}
