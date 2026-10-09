import { Link, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 py-3 flex items-center gap-4">
        <span className="font-bold">Admin</span>
        <Link to="/" className="text-sm opacity-60 hover:opacity-100">← Back to league</Link>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
