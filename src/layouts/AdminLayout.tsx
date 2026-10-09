import { Link, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-green-800 text-white px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="font-bold text-white mr-2">Admin</span>
        <Link to="/admin" className="text-sm text-green-100 hover:text-white">
          Dashboard
        </Link>
        <Link to="/admin/settings" className="text-sm text-green-100 hover:text-white">
          Settings
        </Link>
        <Link to="/admin/players" className="text-sm text-green-100 hover:text-white">
          Players
        </Link>
        <Link to="/admin/schedule" className="text-sm text-green-100 hover:text-white">
          Schedule
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/" className="text-sm text-green-200 hover:text-white">
            ← League
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm bg-green-700 hover:bg-green-600 px-3 py-1 rounded"
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
