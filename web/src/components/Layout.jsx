import { Link, NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase, useSession } from '../lib/supabase'

export function Logo({ className = 'h-9', variant = 'black' }) {
  const src = variant === 'white' ? '/logo-on-white.svg' : variant === 'orange' ? '/logo-on-orange.svg' : '/logo-on-black.svg'
  return <img src={src} alt="Us In It" className={className} />
}

function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return (
    <button onClick={() => setDark(!dark)} className="rounded-lg px-2 py-1 text-sm text-neutral-300 hover:text-white" aria-label="Switch light or dark mode">
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}

export default function Layout() {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const link = ({ isActive }) => `block rounded-lg px-3 py-2 font-bold ${isActive ? 'text-orange' : 'text-white hover:text-orange'}`
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-40 bg-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Us In It home"><Logo className="h-9 sm:h-10" /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/support" className={link}>Support</NavLink>
            <NavLink to="/advertise" className={link}>Advertise</NavLink>
            <NavLink to="/holder" className={link}>Holders</NavLink>
            <NavLink to="/fund" className={link}>Community Fund</NavLink>
            {session && <button onClick={() => supabase.auth.signOut()} className="px-3 py-2 font-bold text-neutral-300 hover:text-white">Log out</button>}
            <ThemeToggle />
          </nav>
          <button className="rounded-lg px-3 py-2 font-bold text-white md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        {open && (
          <nav className="border-t border-neutral-800 px-4 pb-4 md:hidden" onClick={() => setOpen(false)}>
            <NavLink to="/support" className={link}>Support the launch</NavLink>
            <NavLink to="/advertise" className={link}>Advertise with us</NavLink>
            <NavLink to="/holder" className={link}>Holders: sign up or log in</NavLink>
            <NavLink to="/fund" className={link}>Community Fund</NavLink>
            {session && <button onClick={() => supabase.auth.signOut()} className="block px-3 py-2 font-bold text-neutral-300">Log out</button>}
            <ThemeToggle />
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="no-print bg-ink text-neutral-400">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Us In It · A Many Ways Up LLC project · Minneapolis</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/holder-agreement" className="hover:text-white">Holder Agreement</Link>
            <Link to="/advertiser-agreement" className="hover:text-white">Advertiser Agreement</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-orange" />
      <span className="muted text-sm">{label}</span>
    </div>
  )
}

export function Notice({ kind = 'info', children }) {
  const cls = kind === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
    : kind === 'ok' ? 'border-green-300 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
    : 'border-orange/40 bg-orange/10 text-ink dark:text-white'
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>
}
