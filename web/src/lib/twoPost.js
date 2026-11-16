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
  y += story ? 250 : 145
  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, story ? 170 : 130)
  ctx.fillText('$2.', w / 2, y)
  y += story ? 160 : 120
  ctx.fillStyle = '#FF6A00'; ctx.font = font(900, story ? 130 : 108)
  ctx.fillText('4 scans paid.', w / 2, y)
  y += story ? 110 : 82
  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, story ? 84 : 62)
  ctx.fillText("That's it.", w / 2, y)

  // Subline
  y += story ? 90 : 58
  ctx.fillStyle = '#DDDDDD'; ctx.font = font(700, story ? 44 : 34)
  ctx.fillText("It's small on purpose.", w / 2, y)
  y += story ? 58 : 42
  ctx.fillText('When a lot of people give $2, it adds up.', w / 2, y)

  // QR on a white card
  const q = story ? 520 : 290
  y += story ? 80 : 46
  const qx = w / 2 - q / 2
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath(); ctx.roundRect(qx - 22, y - 22, q + 44, q + 44, 30); ctx.fill()
  const qr = await loadImg(await makeQR(url))
  ctx.drawImage(qr, qx, y, q, q)
  y += q + (story ? 125 : 82)

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(900, story ? 64 : 46)
  ctx.fillText('usinit.com/2', w / 2, y)
  y += story ? 76 : 50
  ctx.fillStyle = '#FF6A00'; ctx.font = font(800, story ? 42 : 32)
  ctx.fillText('People on our streets, paid per scan.', w / 2, y)

  return await new Promise((res) => c.toBlob(res, 'image/png'))
}
