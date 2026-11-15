import QRCode from 'qrcode'

// Small pictures a holder can put in the middle of their QR code.
export const QR_STYLES = [
  ['bird', '🐦', 'Bird'], ['cat', '🐱', 'Cat'], ['dog', '🐶', 'Dog'], ['flower', '🌸', 'Flower'],
  ['heart', '❤️', 'Heart'], ['star', '⭐', 'Star'], ['peace', '☮️', 'Peace'],
  ['cross', '✝️', 'Cross'], ['crescent', '☪️', 'Crescent'], ['star_of_david', '✡️', 'Star of David'], ['om', '🕉️', 'Om'],
]
const EMOJI = Object.fromEntries(QR_STYLES.map(([k, e]) => [k, e]))

// Makes the QR picture. With a style, a white circle and the picture sit in the middle.
// Uses the highest error correction (H), so codes still scan with the middle covered.
export async function makeQR(url, style) {
  const opts = { errorCorrectionLevel: 'H', margin: 1, width: 900, color: { dark: '#111111', light: '#FFFFFF' } }
  if (!style || !EMOJI[style]) return QRCode.toDataURL(url, opts)
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, url, opts)
  const ctx = canvas.getContext('2d')
  const c = canvas.width / 2
  const r = canvas.width * 0.12
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill()
  ctx.font = `${Math.round(r * 1.25)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#111111'
  ctx.fillText(EMOJI[style], c, c + r * 0.06)
  return canvas.toDataURL('image/png')
}
