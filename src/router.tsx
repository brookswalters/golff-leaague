import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AdminLayout from './layouts/AdminLayout'
import Home from './pages/Home'
import Standings from './pages/Standings'
import Schedule from './pages/Schedule'
import Results from './pages/Results'
import Skins from './pages/Skins'
import Stats from './pages/Stats'
import Players from './pages/Players'
import AdminHome from './pages/admin/AdminHome'
import AdminSettings from './pages/admin/AdminSettings'
import AdminPlayers from './pages/admin/AdminPlayers'
import AdminSchedule from './pages/admin/AdminSchedule'
import AdminScores from './pages/admin/AdminScores'
import AdminScoresheets from './pages/admin/AdminScoresheets'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/standings', element: <Standings /> },
      { path: '/schedule', element: <Schedule /> },
      { path: '/results/:weekId', element: <Results /> },
      { path: '/skins', element: <Skins /> },
      { path: '/stats', element: <Stats /> },
      { path: '/players', element: <Players /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminHome /> },
      { path: 'settings', element: <AdminSettings /> },
      { path: 'players', element: <AdminPlayers /> },
      { path: 'schedule', element: <AdminSchedule /> },
      { path: 'scores/:weekId', element: <AdminScores /> },
      { path: 'scoresheets/:weekId', element: <AdminScoresheets /> },
    ],
  },
])
