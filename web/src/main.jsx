import React, { Suspense, lazy, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useNavigate, Navigate } from 'react-router-dom'
import './index.css'
import Layout, { Notice, Spinner } from './components/Layout'
import Home from './pages/Home'
import Scan from './pages/Scan'
import Profile, { MyStars } from './pages/Profile'
import Give from './pages/Give'
import Tonight from './pages/Tonight'
import TonightPrint from './pages/TonightPrint'
import { ClaimPage } from './components/Starter'
import { ShopPage } from './components/ShopStarter'
import { ReferralOffer, ReferralClaim, ReferralPrint, PartnersPage } from './components/Referrals'
import CouponPage, { MyCoupons } from './pages/Coupon'
import { PlugScan } from './pages/Plug'
import BookingPage from './pages/Booking'
import WorkplacePage from './pages/Workplace'
import ChampionPage, { Directory } from './pages/Champion'
import { AmbassadorsDirectory, AmbassadorProfile, MyAmbassador, Launch } from './pages/Ambassadors'
import { KindnessPage, SchoolPage } from './pages/Schools'
import CreatorPage, { CreatorGive, DigitalScan } from './pages/Digital'
import Support from './pages/Support'
import SupportQR from './pages/SupportQR'
import SupportPrint from './pages/SupportPrint'
import News, { NewsPost } from './pages/News'
import Spotlight from './pages/Spotlight'
import HowItWorks from './pages/HowItWorks'
import TwoDollars from './pages/TwoDollars'
import Contact from './pages/Contact'
import { ImInBadge } from './pages/ImIn'
import GiftTree, { GiftTreeScan } from './pages/GiftTree'
import GiftSignup from './pages/GiftSignup'
import About from './pages/About'
import Fund from './pages/Fund'
import AdFund from './pages/AdFund'
import Unsubscribe from './pages/Unsubscribe'
import Thanks from './pages/Thanks'
import { Login, Signup } from './pages/Start'
import Connect from './pages/Connect'
const Holder = lazy(() => import('./pages/Holder'))
const Advertise = lazy(() => import('./pages/Advertise'))
const Admin = lazy(() => import('./pages/Admin'))
import { AdvertiserAgreement, HolderAgreement, Privacy, Terms } from './pages/Legal'
import { supabase } from './lib/supabase'

function Reset() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  const nav = useNavigate()
  async function save(e) {
    e.preventDefault()
    if (pw.length < 8) return setMsg({ k: 'error', t: 'Password needs at least 8 characters.' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setMsg({ k: 'error', t: error.message })
    setMsg({ k: 'ok', t: 'Password saved.' }); setTimeout(() => nav('/holder'), 1200)
  }
  return (
    <form onSubmit={save} className="card mx-auto my-10 max-w-md space-y-3">
      <h1 className="h2">Choose a new password</h1>
      <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
      <button className="btn-orange w-full">Save password</button>
    </form>
  )
}

function NotFound() {
  return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">Page not found</h1><Link to="/" className="btn-orange mt-4">Go home</Link></div>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/s/:code" element={<Scan />} />
          <Route path="/claim/:code" element={<ClaimPage />} />
          <Route path="/shop/:code" element={<ShopPage />} />
          <Route path="/p/:code" element={<Profile />} />
          <Route path="/n/:code" element={<PlugScan />} />
          <Route path="/b/:slug" element={<BookingPage />} />
          <Route path="/w/:slug" element={<WorkplacePage />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/ambassadors" element={<AmbassadorsDirectory />} />
          <Route path="/ambassadors/:slug" element={<AmbassadorProfile />} />
          <Route path="/ambassador" element={<MyAmbassador />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/champion" element={<ChampionPage />} />
          <Route path="/school/:slug" element={<SchoolPage />} />
          <Route path="/d/:code" element={<DigitalScan />} />
          <Route path="/g/:code" element={<CreatorGive />} />
          <Route path="/creator" element={<CreatorPage />} />
          <Route path="/kindness/:slug" element={<KindnessPage />} />
          <Route path="/support" element={<Support />} />
          <Route path="/qr" element={<SupportQR />} />
          <Route path="/support/print" element={<SupportPrint />} />
          <Route path="/fund" element={<Fund />} />
          <Route path="/fund/ads" element={<AdFund />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/news" element={<News />} />
          <Route path="/spotlight" element={<Spotlight />} />
          <Route path="/how" element={<HowItWorks />} />
          <Route path="/2" element={<TwoDollars />} />
          <Route path="/give" element={<Give />} />
          <Route path="/tonight" element={<Tonight />} />
          <Route path="/tonight/print/:id" element={<TonightPrint />} />
          <Route path="/r/:code" element={<ReferralOffer />} />
          <Route path="/r/:code/print" element={<ReferralPrint />} />
          <Route path="/rc/:code" element={<ReferralClaim />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/plug" element={<PartnersPage />} />
          <Route path="/c/:code" element={<CouponPage />} />
          <Route path="/coupons" element={<MyCoupons />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/gifttree" element={<GiftTree />} />
          <Route path="/gifttree/signup" element={<GiftSignup />} />
          <Route path="/gifttree/signup/:code" element={<GiftSignup />} />
          <Route path="/gt" element={<GiftTreeScan />} />
          <Route path="/gt/:code" element={<GiftTreeScan />} />
          <Route path="/in" element={<Navigate to="/support" replace />} />
          <Route path="/in/:code" element={<ImInBadge />} />
          <Route path="/news/:id" element={<NewsPost />} />
          <Route path="/thanks" element={<Thanks />} />
          <Route path="/holder" element={<Suspense fallback={<Spinner />}><Holder /></Suspense>} />
          <Route path="/advertise" element={<Suspense fallback={<Spinner />}><Advertise /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<Spinner />}><Admin /></Suspense>} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oauth/consent" element={<Connect />} />
          <Route path="/account" element={<Login />} />
          <Route path="/me" element={<MyStars />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/holder-agreement" element={<HolderAgreement />} />
          <Route path="/advertiser-agreement" element={<AdvertiserAgreement />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
