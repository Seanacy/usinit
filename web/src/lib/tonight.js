import { supabase, SITE_URL } from './supabase'

// Same alcohol word check as the database (paid perks can't mention alcohol).
export const ALCOHOL_RE = /\b(beers?|wines?|cocktails?|shots?|margaritas?|mimosas?|booze|liquor|vodka|tequila|whiske?y|rum|gin|sangria|pints?|pitchers?|seltzers?|cider|ipa|lagers?|ales?|drinks?|happy ?hour|bottomless|martinis?|bloody mar(y|ys)|mules?|brews?|bar ?rail|spirits?|hamm'?s|bud ?light|coors|miller)\b/i
export const hasAlcohol = (t) => ALCOHOL_RE.test(t || '')

export const placeLink = (id, from) => `${SITE_URL}/tonight?place=${id}${from ? `&from=${from}` : ''}`

// Counting for the monthly report. Each place is counted once per page load per kind.
const sent = new Set()
let queue = {}
let timer = null
export function track(placeIds, kind) {
  const ids = (Array.isArray(placeIds) ? placeIds : [placeIds]).filter((id) => id && !sent.has(kind + id))
  if (!ids.length) return
  ids.forEach((id) => sent.add(kind + id))
  queue[kind] = [...(queue[kind] || []), ...ids]
  clearTimeout(timer)
  timer = setTimeout(flush, 1200)
}
function flush() {
  const q = queue; queue = {}
  Object.entries(q).forEach(([kind, ids]) => supabase.rpc('tonight_track', { p_places: ids, p_kind: kind }).then(() => {}, () => {}))
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)

// Followed places live on this phone only.
const FKEY = 'tonight_follow'
export function getFollows() {
  try { return JSON.parse(localStorage.getItem(FKEY) || '[]') } catch { return [] }
}
export function setFollows(list) {
  try { localStorage.setItem(FKEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// Month totals for one or more places: { [placeId]: { seen, open, directions, link, follow, sticker } }
export async function monthStats(placeIds, monthStart, monthEnd) {
  const { data } = await supabase.from('tonight_stats').select('place_id,kind,n').in('place_id', placeIds).gte('day', monthStart).lt('day', monthEnd)
  const out = {}
  ;(data || []).forEach((r) => { out[r.place_id] ||= {}; out[r.place_id][r.kind] = (out[r.place_id][r.kind] || 0) + r.n })
  return out
}
export function monthRange(offset = 0) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const a = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const b = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  return { start: f(a), end: f(b), label: a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
}

export const REPORT_REASONS = [
  ['not_happening', 'This special isn’t happening anymore'],
  ['wrong_time', 'Wrong day or time'],
  ['wrong_deal', 'Wrong price or deal'],
  ['closed', 'This place is closed for good'],
  ['other', 'Something else'],
]
