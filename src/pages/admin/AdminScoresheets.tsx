import { useParams, Link } from 'react-router-dom'
import { useScoresheetData } from '../../hooks/useScoresheetData'
import ScoreSheet from '../../components/ScoreSheet'

export default function AdminScoresheets() {
  const { weekId } = useParams<{ weekId: string }>()
  const { data, isLoading, error } = useScoresheetData(weekId)

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-base">Loading score sheets...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-base">
          {error instanceof Error ? error.message : 'Failed to load score sheet data.'}
        </p>
        <Link to="/admin/schedule" className="text-blue-600 underline text-sm mt-2 inline-block no-print">
          ← Back to Schedule
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Controls — hidden when printing */}
      <div className="no-print flex items-center gap-4 px-6 py-4 border-b border-gray-200">
        <Link
          to="/admin/schedule"
          className="text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-1"
        >
          ← Back to Schedule
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-700 font-medium">
          Week {data.weekNumber} — {data.date} &nbsp;·&nbsp; {data.matches.length} match{data.matches.length !== 1 ? 'es' : ''}
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          Print Score Sheets
        </button>
      </div>

      {/* Score sheets */}
      <div className="px-6 py-6 space-y-8">
        {data.matches.length === 0 ? (
          <p className="text-gray-500 text-base no-print">No matches found for this week.</p>
        ) : (
          data.matches.map((match, idx) => (
            <div
              key={match.id}
              className={idx < data.matches.length - 1 ? 'page-break' : ''}
            >
              <ScoreSheet
                match={match}
                weekNumber={data.weekNumber}
                date={data.date}
                leagueName={data.leagueName}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
