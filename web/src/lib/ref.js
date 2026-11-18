// Ambassador credit: remember the ?ref= code for 30 days so sign-ups and gifts credit the right person.
const KEY = 'usinit_ref'
export function captureRef(search) {
  try {
    const r = new URLSearchParams(search).get('ref')
    if (r && /^[A-Za-z0-9]{4,12}$/.test(r)) localStorage.setItem(KEY, JSON.stringify({ r: r.toUpperCase(), t: Date.now() }))
  } catch { /* storage off */ }
}
export function getRef() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && Date.now() - v.t < 30 * 86400000) return v.r
  } catch { /* storage off */ }
  return ''
}
