import QRCode from 'qrcode'
import { SITE_URL } from './supabase'

export const IMIN_MESSAGES = {
  paycheck: 'Not a handout. A paycheck.',
  dignity: 'Everyone deserves dignity.',
  mpls: 'Minneapolis takes care of its own.',
  neighbors: "We're all neighbors.",
}

export const HOODS = ['North', 'Northeast', 'Downtown', 'Uptown', 'South', 'Southwest', 'Longfellow', 'Powderhorn', 'Phillips', 'Seward', 'Cedar-Riverside', 'Dinkytown', 'St. Paul', 'The suburbs', 'Outside Minnesota']

export const badgeUrl = (code) => `${SITE_URL}/in/${code}`
export const num = (n) => `#${String(n).padStart(4, '0')}`

export function impactLine(b) {
  const parts = []
  if (b.gave && b.amount_cents != null) parts.push(`Gave $${(b.amount_cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`)
  else if (b.gave && b.scans_paid > 0) parts.push(`Paid for ${b.scans_paid} scans`)
  if (b.scans > 0) parts.push(`${b.scans} scan${b.scans === 1 ? '' : 's'} · ${b.people} ${b.people === 1 ? 'person' : 'people'} helped`)
  return parts.join('  ·  ') || 'Just joined'
}

export function shareText(b) {
  return `I'm In! ${IMIN_MESSAGES[b.message_key]} Who's next? Get yours: ${badgeUrl(b.code)} #ImIn #UsInIt`
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

// Draws the tall story-size badge (1080 x 1920) and returns a PNG Blob
export async function badgeImage(b) {
  const W = 1080, H = 1920
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const font = (w, s) => `${w} ${s}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, W, H)
  // orange frame
  ctx.strokeStyle = '#FF6A00'; ctx.lineWidth = 24; ctx.strokeRect(48, 48, W - 96, H - 96)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#FF6A00'; ctx.font = font(800, 56)
  ctx.fillText('[ Us In It ]', W / 2, 200)

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, 260)
  ctx.fillText("I'M IN!", W / 2, 520, W - 200)

  ctx.fillStyle = '#FF6A00'; ctx.font = font(800, 72)
  ctx.fillText(`Supporter ${num(b.number)}`, W / 2, 640)

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(800, 76)
  wrap(ctx, IMIN_MESSAGES[b.message_key], W - 220).forEach((l, i) => ctx.fillText(l, W / 2, 800 + i * 92))

  ctx.fillStyle = '#BBBBBB'; ctx.font = font(600, 46)
  ctx.fillText(impactLine(b), W / 2, 1060)
  if (b.neighborhood) ctx.fillText(`📍 ${b.neighborhood}`, W / 2, 1130)

  // QR on white
  const qr = await QRCode.toDataURL(badgeUrl(b.code), { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#FFFFFF' } })
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = qr })
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(W / 2 - 250, 1200, 500, 500)
  ctx.drawImage(img, W / 2 - 220, 1230, 440, 440)

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(800, 54)
  ctx.fillText('Scan to join me  #ImIn', W / 2, 1790)
  return await new Promise((res) => c.toBlob(res, 'image/png'))
}
