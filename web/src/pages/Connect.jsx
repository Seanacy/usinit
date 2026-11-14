import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthBox from '../components/AuthBox'
import { Notice, Spinner } from '../components/Layout'
import { supabase, useSession } from '../lib/supabase'

// The four sites that share one Us In It account.
export const SITES = ['Us In It', 'TentCity', 'BridgeWork', 'OSAAT']

// "TentCity, BridgeWork, and OSAAT" — every site except the ones given.
export function otherSites(...skip) {
  const list = SITES.filter((s) => !skip.includes(s))
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

// Shared sign-in page. TentCity, BridgeWork, and OSAAT send people here
// ("Sign in with your Us In It account"); after logging in, they go right back.
export default function Connect() {
  const [params] = useSearchParams()
  const id = params.get('authorization_id')
  const session = useSession()
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!id || !session) return
    let gone = false
    ;(async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id)
      if (gone) return
      if (error) return setErr('This sign-in link expired. Go back to the site you came from and tap "Sign in with your Us In It account" again.')
      if (data?.redirect_url) return window.location.assign(data.redirect_url)
      // Only our own sites are registered, so approve right away. No extra "Allow" screen.
      const { error: e2 } = await supabase.auth.oauth.approveAuthorization(id)
      if (e2 && !gone) setErr('Something went wrong. Go back and try again.')
    })()
    return () => { gone = true }
  }, [id, session])

  if (!id) return <div className="mx-auto max-w-md px-4 py-16"><Notice kind="error">This page only opens from TentCity, BridgeWork, or OSAAT.</Notice></div>
  if (session === undefined) return <Spinner />
  if (err) return <div className="mx-auto max-w-md px-4 py-16"><Notice kind="error">{err}</Notice></div>
  if (session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Spinner />
        <p className="mt-4 font-bold">Signing you in… taking you back now.</p>
      </div>
    )
  }
  const here = window.location.pathname + window.location.search
  return (
    <div className="px-4 py-8">
      <AuthBox
        title="Sign in with your Us In It account"
        intro={`One account and one password for ${otherSites()}. New? Make your account here.`}
        redirectPath={here}
        startMode="login"
      />
    </div>
  )
}
