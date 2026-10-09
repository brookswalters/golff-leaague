import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLeague } from '../hooks/useLeague'
import type { Match, Team, Week, MatchResult } from '../lib/database.types'

function formatTeeTime(tt: string | null): string {
  if (!tt) return ''
  return tt.slice(0, 5)
}

export default function Home() {
  const { data: leagueData, isLoading: leagueLoading } = useLeague()
  const seasonId = leagueData?.season?.id

  // All weeks
  const { data: weeks } = useQuery({
    queryKey: ['weeks', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weeks').select('*').eq('season_id', seasonId!).order('number')
      if (error) throw error
      return data as Week[]
    },
  })

  // All matches for season
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

  // Teams
  const { data: teams } = useQuery({
    queryKey: ['teams', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('season_id', seasonId!).order('name')
      if (error) throw error
      return data as Team[]
    },
  })

  // Match results
  const { data: matchResults } = useQuery({
    queryKey: ['match-results', seasonId],
    enabled: !!matches && matches.length > 0,
    queryFn: async () => {
      const matchIds = (matches ?? []).map(m => m.id)
      if (matchIds.length === 0) return [] as MatchResult[]
      const { data, error } = await supabase.from('match_results').select('*').in('match_id', matchIds)
      if (error) throw error
      return data as MatchResult[]
    },
  })

  if (leagueLoading) return <p className="p-4 text-gray-500">Loading...</p>

  if (!leagueData) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-4xl font-bold text-green-800 mb-4">Golf League</h1>
        <p className="text-gray-500">No league configured yet. <Link to="/admin" className="text-green-700 hover:underline">Set up in Admin</Link>.</p>
      </div>
    )
  }

  const { league, season } = leagueData
  const teamsById: Record<string, Team> = Object.fromEntries((teams ?? []).map(t => [t.id, t]))

  // Current week: first non-complete scheduled week
  const upcomingWeek = (weeks ?? []).find(w => w.status === 'scheduled')
  const completedWeeks = (weeks ?? []).filter(w => w.status === 'complete').sort((a, b) => b.number - a.number)
  const lastWeek = completedWeeks[0] ?? null

  // Standings top 5
  const resultsByMatchId: Record<string, MatchResult> = Object.fromEntries(
    (matchResults ?? []).map(r => [r.match_id, r])
  )

  const standings = (teams ?? [])
    .filter(t => !t.is_ghost)
    .map(team => {
      const teamMatches = (matches ?? []).filter(m => m.team_a_id === team.id || m.team_b_id === team.id)
      let pts = 0
      for (const m of teamMatches) {
        const r = resultsByMatchId[m.id]
        if (!r) continue
        pts += m.team_a_id === team.id ? r.team_a_points : r.team_b_points
      }
      return { team, pts }
    })
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 5)

  const upcomingMatches = upcomingWeek
    ? (matches ?? []).filter(m => m.week_id === upcomingWeek.id)
    : []

  const lastWeekMatches = lastWeek
    ? (matches ?? []).filter(m => m.week_id === lastWeek.id)
    : []

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-green-800 text-white rounded-2xl px-6 py-10 text-center">
        <h1 className="text-4xl font-extrabold mb-2">{league.name}</h1>
        {season ? (
          <p className="text-green-200 text-lg">{season.year} Season</p>
        ) : (
          <p className="text-green-300">No active season</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* This week's tee sheet */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            {upcomingWeek ? `Week ${upcomingWeek.number} Tee Sheet` : 'Upcoming Week'}
          </h2>
          {!upcomingWeek ? (
            <p className="text-gray-400 italic">No upcoming matches scheduled.</p>
          ) : upcomingMatches.length === 0 ? (
            <p className="text-gray-400 italic">No matches set yet for Week {upcomingWeek.number}.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-2">{upcomingWeek.date}</p>
              {upcomingMatches.map(m => {
                const tA = teamsById[m.team_a_id]
                const tB = teamsById[m.team_b_id]
                return (
                  <div key={m.id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-800">
                      {tA?.name ?? '?'} <span className="text-gray-400">vs</span> {tB?.name ?? '?'}
                    </span>
                    {m.tee_time && (
                      <span className="text-xs text-gray-500 ml-2">{formatTeeTime(m.tee_time)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Last week's results */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            {lastWeek ? `Week ${lastWeek.number} Results` : 'Last Week'}
          </h2>
          {!lastWeek ? (
            <p className="text-gray-400 italic">No completed weeks yet.</p>
          ) : lastWeekMatches.length === 0 ? (
            <p className="text-gray-400 italic">No matches recorded.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-2">{lastWeek.date}</p>
              {lastWeekMatches.map(m => {
                const tA = teamsById[m.team_a_id]
                const tB = teamsById[m.team_b_id]
                const result = resultsByMatchId[m.id]
                return (
                  <div key={m.id} className="py-1 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800">{tA?.name ?? '?'}</span>
                      <span className="font-bold text-gray-700 mx-2">
                        {result ? `${result.team_a_points} – ${result.team_b_points}` : 'vs'}
                      </span>
                      <span className="font-medium text-gray-800">{tB?.name ?? '?'}</span>
                    </div>
                  </div>
                )
              })}
              <Link
                to={`/results/${lastWeek.id}`}
                className="text-xs text-green-700 hover:underline mt-2 inline-block"
              >
                View full scorecard →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Standings top 5 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">Standings</h2>
          <Link to="/standings" className="text-sm text-green-700 hover:underline">View all →</Link>
        </div>
        {standings.length === 0 ? (
          <p className="text-gray-400 italic">No standings yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(({ team, pts }, i) => (
                <tr key={team.id} className={`border-b border-gray-50 ${i === 0 ? 'font-semibold' : ''}`}>
                  <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-4 text-gray-800">
                    {i === 0 && <span className="text-yellow-500 mr-1">★</span>}
                    {team.name}
                  </td>
                  <td className="py-2 text-right text-green-700 font-bold">{pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
