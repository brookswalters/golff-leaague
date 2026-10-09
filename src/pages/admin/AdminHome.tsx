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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          {isLoading ? (
            <p className="text-base text-gray-500">Loading...</p>
          ) : data ? (
            <p className="text-base text-gray-600">
              {data.league.name}
              {data.season ? ` — ${data.season.year} Season` : ' — No active season'}
            </p>
          ) : (
            <p className="text-base text-gray-500">No league set up yet</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-red-600 hover:underline mt-1"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/admin/settings"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-600 hover:shadow-md transition cursor-pointer"
        >
          <div className="text-3xl mb-3">⚙️</div>
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure league and season settings</p>
        </Link>
        <Link
          to="/admin/players"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-600 hover:shadow-md transition cursor-pointer"
        >
          <div className="text-3xl mb-3">👥</div>
          <h2 className="text-lg font-semibold text-gray-800">Players</h2>
          <p className="text-sm text-gray-500 mt-1">Manage player roster</p>
        </Link>
        <Link
          to="/admin/schedule"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-600 hover:shadow-md transition cursor-pointer"
        >
          <div className="text-3xl mb-3">📅</div>
          <h2 className="text-lg font-semibold text-gray-800">Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">Manage weeks, teams, and matches</p>
        </Link>
      </div>
    </div>
  )
}
