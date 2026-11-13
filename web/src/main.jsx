import React, { Suspense, lazy, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import './index.css'
import Layout, { Notice, Spinner } from './components/Layout'
import Home from './pages/Home'
import Scan from './pages/Scan'
import Profile, { MyStars } from './pages/Profile'
import { PlugScan } from './pages/Plug'
import BookingPage from './pages/Booking'
import WorkplacePage from './pages/Workplace'
import ChampionPage, { Directory } from './pages/Champion'
import { KindnessPage, SchoolPage } from './pages/Schools'
import Support from './pages/Support'
import Fund from './pages/Fund'
import Thanks from './pages/Thanks'
import { Login, Signup } from './pages/Start'
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
          <Route path="/p/:code" element={<Profile />} />
          <Route path="/n/:code" element={<PlugScan />} />
          <Route path="/b/:slug" element={<BookingPage />} />
          <Route path="/w/:slug" element={<WorkplacePage />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/champion" element={<ChampionPage />} />
          <Route path="/school/:slug" element={<SchoolPage />} />
          <Route path="/kindness/:slug" element={<KindnessPage />} />
          <Route path="/support" element={<Support />} />
          <Route path="/fund" element={<Fund />} />
          <Route path="/thanks" element={<Thanks />} />
          <Route path="/holder" element={<Suspense fallback={<Spinner />}><Holder /></Suspense>} />
          <Route path="/advertise" element={<Suspense fallback={<Spinner />}><Advertise /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<Spinner />}><Admin /></Suspense>} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
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
