import { makeQR } from './qrstyle'

// Ready-to-post pictures for The $2 Drop.
// square = Instagram/Facebook post (1080x1080), story = Stories/TikTok/Reels (1080x1920)
export const TWO_SIZES = {
  square: { w: 1080, h: 1080, label: 'Post (square)' },
  story: { w: 1080, h: 1920, label: 'Story' },
}

const font = (w, s) => `${w} ${s}px "Helvetica Neue", Arial, sans-serif`
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

export async function makeTwoPost(kind, url) {
  const { w, h } = TWO_SIZES[kind]
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, w, h)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  const story = kind === 'story'
  let y = story ? 230 : 120

  // [Us In It] logo
  ctx.font = font(900, 64)
  const word = 'Us In It', bw = ctx.measureText('[').width, ww = ctx.measureText(word).width
  const x0 = w / 2 - (ww + bw * 2) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = '#FF6A00'; ctx.fillText('[', x0, y)
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(word, x0 + bw, y)
  ctx.fillStyle = '#FF6A00'; ctx.fillText(']', x0 + bw + ww, y)
  ctx.textAlign = 'center'

  // Headline
  y += story ? 230 : 150
  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, story ? 150 : 120)
  ctx.fillText('$2 = 4', w / 2, y)
  y += story ? 160 : 125
  ctx.fillStyle = '#FF6A00'; ctx.fillText('paychecks.', w / 2, y)

  // Subline
  y += story ? 110 : 75
  ctx.fillStyle = '#DDDDDD'; ctx.font = font(700, story ? 48 : 38)
  ctx.fillText('Give $2. 4 people on our streets', w / 2, y)
  y += story ? 62 : 48
  ctx.fillText('get paid for a scan.', w / 2, y)

  // QR on a white card
  const q = story ? 560 : 330
  y += story ? 80 : 40
  const qx = w / 2 - q / 2
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath(); ctx.roundRect(qx - 24, y - 24, q + 48, q + 48, 32); ctx.fill()
  const qr = await loadImg(await makeQR(url))
  ctx.drawImage(qr, qx, y, q, q)
  y += q + (story ? 130 : 95)

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, story ? 64 : 48)
  ctx.fillText('usinit.com/2', w / 2, y)
  y += story ? 80 : 55
  ctx.fillStyle = '#FF6A00'; ctx.font = font(800, story ? 44 : 34)
  ctx.fillText('Not a handout. A paycheck.', w / 2, y)

  return await new Promise((res) => c.toBlob(res, 'image/png'))
}
