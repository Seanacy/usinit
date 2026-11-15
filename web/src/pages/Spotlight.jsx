import { Link } from 'react-router-dom'
import { useSession } from '../lib/supabase'
import { SpotlightPreview } from '../components/SpotlightPanel'

// usinit.com/spotlight — tells small businesses about free Community Spotlights
export default function Spotlight() {
  const session = useSession()
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-wide text-orange">Free for local businesses</p>
      <h1 className="h1 mt-1">Get your business in the Community Spotlight</h1>
      <p className="muted mt-3 text-lg">Show off one special product or service for free. When people scan an Us In It holder's code and the Community Fund pays that holder, your spotlight can be what they see.</p>

      <div className="mt-6"><SpotlightPreview s={{ headline: 'Fresh knotless braids, booked same week', body: 'First-time clients get 15% off. Show this screen when you book.', button_url: 'https://example.com', button_text: 'Book now' }} business="Your business" /></div>

      <div className="mt-8 space-y-4">
        <h2 className="h2">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Make a free business account.</li>
          <li>Write a catchy headline and message, and pick your best photo.</li>
          <li>Us In It checks it, usually within a day.</li>
          <li>It goes live. Watch your views and button taps from your account.</li>
        </ol>
        <h2 className="h2 pt-2">Want more views? Boost it 🚀</h2>
        <p>Free spotlights take turns, so views aren't guaranteed. Boost turns your spotlight into a paid ad that shows every time someone scans inside your own zone. You draw the zone, set a daily max, and pay $0.50 per scan. $0.40 of every scan goes to the person holding the code.</p>
      </div>

      <Link to="/advertise" className="btn-orange mt-8 block w-full py-4 text-center text-lg">
        {session ? 'Go to my business account' : 'Make my free spotlight'}
      </Link>
      {!session && <p className="muted mt-3 text-center text-sm">Already have a business account? Tap the button and log in.</p>}
      <p className="muted mt-6 text-xs">Not allowed: payday loans, gambling, alcohol, cannabis, vape, adult content, or anything illegal, hateful, or misleading.</p>
    </div>
  )
}
