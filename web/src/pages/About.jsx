import { Link } from 'react-router-dom'
import { money, useStats } from '../lib/supabase'

const BUILDS = [
  ['More people earning', 'New zones, more holders, and partnerships with shelters and churches.'],
  ['Stories that bring help', 'A place where holders share their journey, the struggles and the wins, so people can follow along and help.'],
  ['Mental health care', 'A fund that pays licensed counselors directly for sessions. We are building toward this.'],
  ['Lifting up others doing the work', 'We promote nonprofits and projects serving the same cause, like TentCity (resources), BridgeWork (paid work), OSAAT (milestones), and local nonprofits through The Plug.'],
  ['Paths forward', 'Connections to steady jobs, so people can outgrow Us In It.'],
  ['Community moments', 'Like the Gift Tree, which show what a city can do together.'],
]

// usinit.com/about — mission, vision, and where the platform's share of each scan goes
export default function About() {
  const stats = useStats()
  const price = stats?.price_per_scan_cents ?? 50
  const share = stats?.holder_share_cents ?? 40
  const ours = price - share
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <div className="rounded-3xl bg-ink p-6 text-white">
        <p className="font-bold text-orange">[ Us In It ]</p>
        <h1 className="mt-2 text-4xl font-black">Not a handout. A paycheck.</h1>
        <p className="mt-3 text-neutral-300">Who we are, where we're going, and where the money goes.</p>
      </div>

      <section className="space-y-3">
        <h2 className="h2">Our mission</h2>
        <p className="text-lg font-bold">Us In It creates real ways to earn for people who need it most, starting with people living on our streets.</p>
        <p>Survival mode takes everything: your time, your energy, your view of the road ahead. A steady way to earn gives some of that back. Local businesses pay, neighbors scan, and people on the street get paid for showing up.</p>
        <p>We're not promising to end homelessness. We're giving people a reason and a way to keep moving forward.</p>
      </section>

      <section className="space-y-3">
        <h2 className="h2">Our vision</h2>
        <p className="text-lg font-bold">A city where hard times don't lock anyone out of earning, and where your neighbors are in it with you.</p>
        <p>We see a day when someone on the corner is earning, telling their story, and building momentum. When local businesses see them as partners. And when the people we serve eventually outgrow us for steady jobs and homes of their own.</p>
        <p className="border-l-4 border-orange pl-3 italic">For some, Us In It is a stepping stone. For others, it's the spark.</p>
        <Link to="/news" className="inline-block font-bold underline">Read why we built Us In It →</Link>
      </section>

      <section className="space-y-4">
        <h2 className="h2">Where the money from each scan goes</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center"><p className="text-4xl font-black text-orange">{money(share)}</p><p className="font-bold">goes to the person holding the code</p></div>
          <div className="card text-center"><p className="text-4xl font-black">{money(ours)}</p><p className="font-bold">goes to Us In It</p></div>
        </div>
        <p>Every scan is {money(price)}. Our {money(ours)} does two jobs.</p>
        <div className="card space-y-2">
          <p className="text-lg font-extrabold">1. Keeps it running</p>
          <p>Payment fees, servers, fraud checks so every scan is real, and support for holders and businesses.</p>
        </div>
        <div className="card space-y-3">
          <p className="text-lg font-extrabold">2. Builds what's next</p>
          {BUILDS.map(([t, d]) => (
            <div key={t}>
              <p className="font-bold">{t}</p>
              <p className="muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="muted text-sm">Us In It is a business, run by Many Ways Up LLC in Minneapolis. It is not a charity, and payments are not tax-deductible.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/support" className="btn-orange py-4 text-center text-lg">Support Us In It</Link>
        <Link to="/advertise" className="btn-black py-4 text-center text-lg">Advertise with us</Link>
      </div>
    </div>
  )
}
