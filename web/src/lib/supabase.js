import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tebmvynzkoxfmyyclbsj.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_MlgsMgr1xnfSMhgVbK_3Bw_rlHDZOeh'

export const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Public site address used inside QR codes. Set VITE_SITE_URL=https://usinit.com once the domain is live.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
export const IS_FINAL_DOMAIN = /(^|\.)usinit\.com$/i.test(new URL(SITE_URL).hostname)

export const money = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export function deviceId() {
  try {
    let id = localStorage.getItem('uii_device')
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()
      localStorage.setItem('uii_device', id)
    }
    return id
  } catch {
    return null
  }
}

export function useSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])
  return session // undefined = loading, null = signed out
}

export function useStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    supabase.rpc('public_stats').then(({ data }) => setStats(data))
  }, [])
  return stats
}

// Payer covers the card fee: what to charge so the recipient gets the full base amount.
export function withCardFee(base, settings = {}) {
  const pct = Number(settings.stripe_fee_pct ?? 2.9) / 100, fixed = Number(settings.stripe_fee_fixed_cents ?? 30)
  return Math.ceil((base + fixed) / (1 - pct))
}

// Stripe Connect payouts: action = status | onboard | dashboard | cashout; kind = holder | creator | business
export async function callConnect(action, kind) {
  const { data: s } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${s?.session?.access_token || KEY}` },
    body: JSON.stringify({ action, kind }),
  })
  let out = {}
  try { out = await res.json() } catch { /* ignore */ }
  if (!res.ok) throw new Error(out.error || 'Something went wrong. Try again.')
  return out
}

export async function startCheckout(payload) {
  const { data: s } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json', apikey: KEY }
  if (s?.session?.access_token) headers.Authorization = `Bearer ${s.session.access_token}`
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  let out = {}
  try { out = await res.json() } catch { /* ignore */ }
  if (!res.ok || !out.url) throw new Error(out.error || 'Payments are not turned on yet.')
  window.location.href = out.url
}

export async function uploadPhoto(file, userId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: false })
  if (error) throw error
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export const CENTRAL_TZ = 'America/Chicago'

// After log in, send each person to their own page.
export async function homeFor(user) {
  const { data: admin } = await supabase.rpc('is_admin')
  if (admin) return '/admin'
  const { data: h } = await supabase.from('holders').select('id').eq('user_id', user.id).maybeSingle()
  if (h) return '/holder'
  const { data: a } = await supabase.from('advertisers').select('id').eq('user_id', user.id).maybeSingle()
  if (a) return '/advertise'
  const { data: c } = await supabase.from('champions').select('id').eq('user_id', user.id).maybeSingle()
  if (c) return '/champion'
  const { data: cr } = await supabase.from('creators').select('id').eq('user_id', user.id).maybeSingle()
  if (cr) return '/creator'
  const r = user.user_metadata?.role
  if (r === 'champion') return '/champion'
  if (r === 'creator') return '/creator'
  if (r === 'holder') return '/holder'
  if (r === 'business') return '/advertise'
  return '/me'
}

