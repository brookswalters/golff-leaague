import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'

export default function AdminHome() {
  const navigate = useNavigate()
  const { data, isLoading } = useLeague()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          {isLoading ? (
            <p className="text-sm text-gray-500 mt-1">Loading...</p>
          ) : data ? (
            <p className="text-sm text-gray-600 mt-1">
              {data.league.name}
              {data.season ? ` — ${data.season.year} Season` : ' — No active season'}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">No league set up yet</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/admin/settings"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure league and season settings</p>
        </Link>
        <Link
          to="/admin/players"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900">Players</h2>
          <p className="text-sm text-gray-500 mt-1">Manage player roster</p>
        </Link>
        <Link
          to="/admin/schedule"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">Manage weeks, teams, and matches</p>
        </Link>
      </div>
    </div>
  )
}
