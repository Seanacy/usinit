// Scanner impact counter. Kept only on this phone (no account, nothing sent to Us In It).
const KEY = 'usinit_impact_v1'
const monthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7)

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode or storage off: just skip */ }
}

export function getImpact() {
  const d = read()
  if (!d) return null
  const thisMonth = d.month === monthKey()
  return {
    monthPeople: thisMonth ? d.mPeople.length : 0,
    monthScans: thisMonth ? d.mScans : 0,
    allPeople: d.aPeople.length,
    allScans: d.aScans,
  }
}

// Call once per scan. Returns the new totals plus whether this was their first scan ever.
export function recordScan(code) {
  const m = monthKey()
  const d = read() || { month: m, mPeople: [], mScans: 0, aPeople: [], aScans: 0 }
  if (d.month !== m) { d.month = m; d.mPeople = []; d.mScans = 0 }
  const first = d.aScans === 0
  d.mScans += 1; d.aScans += 1
  if (code && !d.mPeople.includes(code)) d.mPeople.push(code)
  if (code && !d.aPeople.includes(code)) d.aPeople = [...d.aPeople, code].slice(-500)
  write(d)
  return { ...getImpact(), first }
}
