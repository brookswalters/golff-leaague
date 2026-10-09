import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLeague } from '../hooks/useLeague'
import type { Match, Team, Week } from '../lib/database.types'

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'complete'
      ? 'bg-green-100 text-green-700'
      : status === 'rainout'
      ? 'bg-red-100 text-red-600'
      : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function formatTeeTime(tt: string | null): string {
  if (!tt) return ''
  return tt.slice(0, 5)
}

export default function Schedule() {
  const { data: leagueData, isLoading: leagueLoading } = useLeague()
  const seasonId = leagueData?.season?.id

  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ['weeks', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weeks').select('*').eq('season_id', seasonId!).order('number')
      if (error) throw error
      return data as Week[]
    },
  })

  const { data: matches } = useQuery({
    queryKey: ['matches-all', seasonId],
    enabled: !!weeks && weeks.length > 0,
    queryFn: async () => {
      const weekIds = (weeks ?? []).map(w => w.id)
      if (weekIds.length === 0) return [] as Match[]
      const { data, error } = await supabase.from('matches').select('*').in('week_id', weekIds).order('tee_time')
      if (error) throw error
      return data as Match[]
    },
  })

  const { data: teams } = useQuery({
    queryKey: ['teams', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('season_id', seasonId!).order('name')
      if (error) throw error
      return data as Team[]
    },
  })

  if (leagueLoading || weeksLoading) return <p className="p-4 text-gray-500">Loading schedule...</p>

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">Schedule</h1>
        <p className="text-gray-500">No season configured yet.</p>
      </div>
    )
  }

  const teamsById: Record<string, Team> = Object.fromEntries((teams ?? []).map(t => [t.id, t]))

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-800">Schedule</h1>
      {leagueData?.season && (
        <p className="text-gray-500">{leagueData.league.name} — {leagueData.season.year} Season</p>
      )}

      {(!weeks || weeks.length === 0) ? (
        <p className="text-gray-400 italic">No weeks scheduled yet.</p>
      ) : (
        <div className="space-y-4">
          {weeks.map(week => {
            const weekMatches = (matches ?? []).filter(m => m.week_id === week.id)
            return (
              <div
                key={week.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-gray-800">Week {week.number}</h2>
                    <span className="text-sm text-gray-500">{week.date}</span>
                    <StatusBadge status={week.status} />
                  </div>
                  {week.status === 'complete' && (
                    <Link
                      to={`/results/${week.id}`}
                      className="text-sm text-green-700 hover:underline font-medium"
                    >
                      View Results →
                    </Link>
                  )}
                </div>

                {weekMatches.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No matches scheduled.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {weekMatches.map(match => {
                      const tA = teamsById[match.team_a_id]
                      const tB = teamsById[match.team_b_id]
                      return (
                        <div key={match.id} className="py-2 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm text-gray-800">
                            <span className="font-medium">{tA?.name ?? '?'}</span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className="font-medium">{tB?.name ?? '?'}</span>
                          </span>
                          {match.tee_time && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {formatTeeTime(match.tee_time)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
