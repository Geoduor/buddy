import { NavLink, Outlet, Link } from 'react-router-dom'
import Footer from './Footer'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/quiz', label: 'Quiz' },
  { to: '/dashboard', label: 'Readiness' },
  { to: '/study-buddy', label: 'Ask Buddy' },
]

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Buddy home">
          <img src="/brand/buddy-lockup.png" alt="buddy" width="120" height="35" />
        </Link>
        <nav className="nav" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content" id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
