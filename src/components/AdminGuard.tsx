import { Navigate, Outlet } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'

export default function AdminGuard() {
  const { isAdmin, loading } = useAdmin()
  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
