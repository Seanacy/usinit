// usinit.com/api/geo — tells the site which US state a viewer is in (from Vercel), signed so it can't be faked.
export const config = { runtime: 'edge' }

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export default async function handler(request) {
  const country = request.headers.get('x-vercel-ip-country') || ''
  const region = request.headers.get('x-vercel-ip-country-region') || ''
  const ts = String(Date.now())
  const secret = process.env.GEO_SECRET || ''
  let token = null
  if (secret) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${country}|${region}|${ts}`)))
    token = `${country}|${region}|${ts}|${sig}`
  }
  return new Response(JSON.stringify({ token }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}
