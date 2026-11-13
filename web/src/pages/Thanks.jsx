import { Link, useSearchParams } from 'react-router-dom'

export default function Thanks() {
  const [p] = useSearchParams()
  const type = p.get('type')
  const name = p.get('name')
  const title = type === 'tip' ? `Your tip is on its way to ${name || 'them'}. 🧡`
    : type === 'supporter' ? "You're in! 🎉 Thank you, Founding Supporter."
    : type === 'note' ? 'Thank you! 💛 Us In It reads every note, then posts it for the team.'
    : type === 'campaign' ? 'Paid! 🎉 The campaign starts once the school and Us In It approve it.'
    : type === 'booking' ? 'Deposit paid! 🧡 Your booking request is in. They\'ll confirm with you by email or phone.'
    : 'Thank you! 🎉 Your gift is in the Community Fund.'
  async function share() {
    const data = { title: 'Us In It', text: 'Local businesses pay people on our streets to share their messages. Check out Us In It.', url: window.location.origin }
    try { if (navigator.share) await navigator.share(data); else await navigator.clipboard.writeText(data.url) } catch { /* ignore */ }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="h1">{title}</h1>
      <p className="muted mt-3">A receipt is on its way to your email.</p>
      <button className="btn-orange mt-6 w-full" onClick={share}>Share Us In It</button>
      <Link to="/" className="btn-outline mt-3 w-full">Back to home</Link>
    </div>
  )
}
