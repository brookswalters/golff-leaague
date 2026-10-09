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
      <nav className="bg-green-800 text-white px-4 py-3 flex items-center gap-1 flex-wrap">
        <span className="text-xl font-bold text-white mr-3">Admin</span>
        <Link to="/admin" className="text-base text-green-100 hover:text-white py-2 px-3 rounded hover:bg-green-700">
          Dashboard
        </Link>
        <Link to="/admin/settings" className="text-base text-green-100 hover:text-white py-2 px-3 rounded hover:bg-green-700">
          Settings
        </Link>
        <Link to="/admin/players" className="text-base text-green-100 hover:text-white py-2 px-3 rounded hover:bg-green-700">
          Players
        </Link>
        <Link to="/admin/schedule" className="text-base text-green-100 hover:text-white py-2 px-3 rounded hover:bg-green-700">
          Schedule
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/" className="text-base text-green-200 hover:text-white py-2 px-3 rounded hover:bg-green-700">
            ← League
          </Link>
          <button
            onClick={handleSignOut}
            className="text-base bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium"
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
