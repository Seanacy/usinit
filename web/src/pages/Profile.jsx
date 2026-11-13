import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'

export function ProfileCard({ code }) {
  const [h, setH] = useState(undefined)
  useEffect(() => { supabase.rpc('get_public_holder', { p_code: code }).then(({ data }) => setH(data || null)) }, [code])
  if (h === undefined) return <Spinner />
  if (!h) return <p className="muted">This profile isn't available.</p>
  return (
    <div className="card">
      <div className="flex items-center gap-4">
        {h.photo_url
          ? <img src={h.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange text-3xl font-extrabold text-ink">{h.first_name?.[0]}</div>}
        <div>
          <p className="text-2xl font-extrabold">{h.first_name}</p>
          <p className="muted text-sm">Holder #{h.code}{h.general_area ? ` · Usually around ${h.general_area}` : ''}</p>
          <p className="text-sm font-bold">{h.count_today} scan{h.count_today === 1 ? '' : 's'} today</p>
        </div>
      </div>
      {h.story && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed">{h.story}</p>}
    </div>
  )
}

export default function Profile() {
  const { code } = useParams()
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ProfileCard code={code} />
      <Link to={`/s/${code}`} className="btn-orange mt-4 w-full">Scan to help</Link>
    </div>
  )
}
