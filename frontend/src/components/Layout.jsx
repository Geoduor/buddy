import { NavLink, Outlet } from 'react-router-dom'
import Footer from './Footer'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/quiz', label: 'Quiz' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/study-buddy', label: 'Study Buddy' },
]

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">buddy</span>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}