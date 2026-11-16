import { Link } from 'react-router-dom'
import { money, useStats } from '../lib/supabase'

// usinit.com/how — plain steps for every kind of person who uses Us In It
function Section({ id, emoji, title, steps, cta, to }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-4">
      <h2 className="h2">{emoji} {title}</h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange font-black text-ink">{i + 1}</span>
            <span className="pt-1">{s}</span>
          </li>
        ))}
      </ol>
      <Link to={to} className="btn-orange block w-full py-3 text-center text-lg">{cta}</Link>
    </section>
  )
}

export default function HowItWorks() {
  const stats = useStats()
  const price = stats?.price_per_scan_cents ?? 50
  const share = stats?.holder_share_cents ?? 40
  const jump = [['scanners', 'I scan codes'], ['supporters', 'I want to support'], ['holders', 'I want to earn'], ['businesses', 'I own a business'], ['gifttree', 'Gift Tree 🎄']]
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-white">
        <p className="font-bold text-orange">[ Us In It ]</p>
        <h1 className="mt-2 text-4xl font-black">How it works</h1>
        <p className="mt-3 text-neutral-300">People on our streets hold a QR code. You scan it. A local business or our Community Fund pays them {money(share)} for your scan. It costs you nothing.</p>
      </div>

      <div>
        <p className="label">Jump to</p>
        <div className="flex flex-wrap gap-2">
          {jump.map(([id, t]) => (
            <a key={id} href={`#${id}`} className="rounded-full border-2 border-orange px-4 py-2 font-bold hover:bg-orange hover:text-ink">{t}</a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center"><p className="text-4xl font-black text-orange">{money(share)}</p><p className="font-bold">to the person holding the code</p></div>
        <div className="card text-center"><p className="text-4xl font-black">{money(price - share)}</p><p className="font-bold">to Us In It, to keep it running</p></div>
      </div>
      <p className="muted -mt-3 text-center text-sm">Every scan is {money(price)}. <Link to="/about" className="underline">See where our part goes</Link></p>

      <Section id="scanners" emoji="📱" title="If you scan a code" to="/fund" cta="See the Community Fund"
        steps={[
          'Point your phone camera at a holder\'s QR code and tap the link.',
          'Allow your location when asked. That\'s how we know the scan is real and nearby.',
          `That's it. Your scan pays the holder ${money(share)}. You pay nothing.`,
          'Want to do more? You can leave a tip or give to the Community Fund right from that screen.',
        ]} />

      <Section id="supporters" emoji="🧡" title="If you want to support" to="/support" cta="Support Us In It"
        steps={[
          'Go to the Support page.',
          'Pick a weekly amount for 1 or 2 months. It ends on its own. Or give once, any amount from $5.',
          'Pay with Apple Pay, Google Pay, Cash App Pay, or a card. No account needed.',
          'Your money pays people on our streets when there\'s no business paying for their scans. You also get an I\'M IN! badge to share.',
        ]} />

      <Section id="holders" emoji="🙋" title="If you want to earn (holders)" to="/holder" cta="Become a holder"
        steps={[
          'Sign up for free and agree to the Holder Agreement.',
          'Get your own QR code. Print it or show it on your phone.',
          `Hold it up where people walk by. Every real scan earns you ${money(share)}. One scan per phone per day counts.`,
          'Watch your balance grow in your account, then cash out when you\'re ready.',
        ]} />

      <Section id="businesses" emoji="🏪" title="If you own a business" to="/advertise" cta="Advertise with us"
        steps={[
          'Make a free business account.',
          `Draw a zone around your business and add funds. You pay ${money(price)} only for real scans by people standing in your zone. ${money(share)} of it goes to the holder.`,
          'People who scan see your ad, so your neighbors see you doing good.',
          'Free extras: a Community Spotlight for one product or service, plus a booking page. With The Plug, other businesses can carry your booking code and earn when they send you clients.',
        ]} />

      <Section id="gifttree" emoji="🎄" title="Gift Tree" to="/gifttree" cta="Go to the Gift Tree"
        steps={[
          'A parent signs up and makes a wish list for their child from Walmart or Target. In-store items only, up to 5 items and $150.',
          'Us In It checks the list. Once it\'s approved, it shows up as a gift tag. We never show a child\'s name or photo.',
          'Anyone can pay for some or all of a tag, or grab the tag\'s QR code and get people to scan it. Sponsor scans add money to the gifts.',
          'When a tag is full, we buy the gifts in the store and post the receipts so you can see where the money went.',
        ]} />

      <p className="muted text-center text-sm">Us In It is a business run by Many Ways Up LLC in Minneapolis. It is not a charity, and payments are not tax-deductible.</p>
    </div>
  )
}
