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
      <nav className="bg-green-800 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xl font-bold">Golf League</span>
        <div className="flex flex-wrap gap-1">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className="text-base py-2 px-3 rounded hover:bg-green-700">{l.label}</Link>
          ))}
          <Link to="/admin" className="text-base py-2 px-3 rounded hover:bg-green-700 opacity-70">Admin</Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
