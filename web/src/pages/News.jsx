import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CENTRAL_TZ, SITE_URL, supabase } from '../lib/supabase'
import { Spinner } from '../components/Layout'

const KINDS = { event: 'Event', update: 'Update', thought: 'Thought' }
const KIND_STYLE = {
  event: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  update: 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
  thought: 'bg-orange/15 text-orange-900 dark:text-orange-200',
}
const FILTERS = [['all', 'All'], ['event', 'Events'], ['update', 'Updates'], ['thought', 'Thoughts']]

const day = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: CENTRAL_TZ })
const eventWhen = (d) => new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: CENTRAL_TZ })
const mon = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', timeZone: CENTRAL_TZ }).toUpperCase()
const dnum = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', timeZone: CENTRAL_TZ })

function Tag({ kind }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${KIND_STYLE[kind]}`}>{KINDS[kind]}</span>
}

function share(p) {
  const url = `${SITE_URL}/news/${p.id}`
  if (navigator.share) navigator.share({ title: p.title, url }).catch(() => {})
  else navigator.clipboard?.writeText(url)
}

function lastLine(body) {
  const parts = body.trim().split(/\n\s*\n/)
  return parts.length > 1 ? parts[parts.length - 1] : null
}

function PostCard({ p }) {
  const first = p.body.trim().split(/\n\s*\n/)[0] || ''
  const quote = p.pinned && p.kind === 'thought' ? lastLine(p.body) : null
  if (p.kind === 'event' && p.event_at) {
    return (
      <Link to={`/news/${p.id}`} className={`card flex gap-4 ${p.pinned ? 'border-2 border-orange' : ''}`}>
        <div className="w-14 shrink-0 rounded-lg bg-ink py-2 text-center text-white">
          <div className="text-xs font-bold text-orange">{mon(p.event_at)}</div>
          <div className="text-2xl font-extrabold">{dnum(p.event_at)}</div>
        </div>
        <div className="min-w-0">
          <Tag kind="event" />
          <p className="mt-1 text-lg font-extrabold">{p.title}</p>
          <p className="muted text-sm">{eventWhen(p.event_at)}{p.event_place ? ` · ${p.event_place}` : ''}</p>
        </div>
      </Link>
    )
  }
  return (
    <div className={`card space-y-2 ${p.pinned ? 'border-2 border-orange' : ''}`}>
      <div className="flex items-center gap-2">
        <Tag kind={p.kind} />
        <span className="muted text-xs">{p.pinned ? 'Pinned · ' : ''}{day(p.created_at)}</span>
      </div>
      <Link to={`/news/${p.id}`} className="block text-xl font-extrabold">{p.title}</Link>
      {p.photo_url && <img src={p.photo_url} alt="" className="max-h-64 w-full rounded-lg object-cover" />}
      <p className="muted line-clamp-3 whitespace-pre-line">{first}</p>
      {quote && quote !== first && <p className="border-l-4 border-orange pl-3 italic">{quote}</p>}
      <div className="flex items-center pt-1">
        <Link to={`/news/${p.id}`} className="font-bold">Read more →</Link>
        <button type="button" className="ml-auto text-sm font-bold underline" onClick={() => share(p)}>Share</button>
      </div>
    </div>
  )
}

export default function News() {
  const [posts, setPosts] = useState(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => {
    supabase.from('site_posts').select('*').eq('published', true)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setPosts(data || []))
  }, [])
  if (!posts) return <Spinner />
  const shown = posts.filter((p) => filter === 'all' || p.kind === filter)
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="h1">News and thoughts</h1>
      <p className="muted mt-1">Events, updates, and why we do this.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${filter === k ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'border border-neutral-300 dark:border-neutral-700'}`}>{label}</button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {shown.length === 0 && <p className="muted">Nothing here yet. Check back soon.</p>}
        {shown.map((p) => <PostCard key={p.id} p={p} />)}
      </div>
      <Link to="/support" className="btn-orange mt-8 block w-full py-4 text-center text-lg">Support Us In It</Link>
    </div>
  )
}

export function NewsPost() {
  const { id } = useParams()
  const [p, setP] = useState(undefined)
  useEffect(() => {
    supabase.from('site_posts').select('*').eq('id', id).maybeSingle().then(({ data }) => setP(data || null))
  }, [id])
  if (p === undefined) return <Spinner />
  if (!p) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="h2">That post isn't here</p>
      <Link to="/news" className="mt-4 inline-block font-bold underline">See all news</Link>
    </div>
  )
  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/news" className="font-bold underline">← All news</Link>
      <div className="mt-4 flex items-center gap-2">
        <Tag kind={p.kind} />
        <span className="muted text-sm">{day(p.created_at)}</span>
      </div>
      <h1 className="h1 mt-2">{p.title}</h1>
      {p.kind === 'event' && p.event_at && (
        <p className="mt-2 font-bold">{eventWhen(p.event_at)}{p.event_place ? ` · ${p.event_place}` : ''}</p>
      )}
      {p.photo_url && <img src={p.photo_url} alt="" className="mt-4 w-full rounded-xl object-cover" />}
      <div className="mt-5 space-y-4 text-lg leading-relaxed">
        {p.body.trim().split(/\n\s*\n/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
      </div>
      <div className="mt-8 grid gap-3">
        <button type="button" className="btn-outline w-full" onClick={() => share(p)}>Share this post</button>
        <Link to="/support" className="btn-orange w-full py-4 text-center text-lg">Support Us In It</Link>
      </div>
    </article>
  )
}
