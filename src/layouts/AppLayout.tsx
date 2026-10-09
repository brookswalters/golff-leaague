import { Link, Outlet } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/skins', label: 'Skins' },
  { to: '/stats', label: 'Stats' },
  { to: '/players', label: 'Players' },
]

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-green-800 text-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">Golf League</span>
        <div className="flex gap-4 text-sm">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className="hover:underline">{l.label}</Link>
          ))}
          <Link to="/admin" className="hover:underline opacity-60">Admin</Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
