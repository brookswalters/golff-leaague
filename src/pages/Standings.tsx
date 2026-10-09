import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLeague } from '../hooks/useLeague'
import type { Team, Player, MatchResult, Match } from '../lib/database.types'

interface TeamStanding {
  team: Team
  players: Player[]
  wins: number
  losses: number
  ties: number
  points: number
  matchesPlayed: number
}

export default function Standings() {
  const { data: leagueData } = useLeague()
  const seasonId = leagueData?.season?.id
  const leagueId = leagueData?.league?.id

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('season_id', seasonId!).order('name')
      if (error) throw error
      return data as Team[]
    },
  })

  const { data: players } = useQuery({
    queryKey: ['players', leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('*').eq('league_id', leagueId!)
      if (error) throw error
      return data as Player[]
    },
  })

  // Fetch all matches + results for the season
  const { data: matches } = useQuery({
    queryKey: ['matches-all', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      // Get all weeks first
      const { data: weeks } = await supabase.from('weeks').select('id').eq('season_id', seasonId!)
      if (!weeks || weeks.length === 0) return [] as Match[]
      const weekIds = weeks.map(w => w.id)
      const { data, error } = await supabase.from('matches').select('*').in('week_id', weekIds)
      if (error) throw error
      return data as Match[]
    },
  })

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

  if (teamsLoading) return <p className="p-4 text-gray-500">Loading standings...</p>

  if (!seasonId || !teams) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">Standings</h1>
        <p className="text-gray-500">No season data available.</p>
      </div>
    )
  }

  // Build standings
  const resultsByMatchId: Record<string, MatchResult> = Object.fromEntries(
    (matchResults ?? []).map(r => [r.match_id, r])
  )

  const standings: TeamStanding[] = teams.map(team => {
    const teamMatches = (matches ?? []).filter(m => m.team_a_id === team.id || m.team_b_id === team.id)
    let wins = 0, losses = 0, ties = 0, points = 0

    for (const m of teamMatches) {
      const result = resultsByMatchId[m.id]
      if (!result) continue

      const isTeamA = m.team_a_id === team.id
      const myPts = isTeamA ? result.team_a_points : result.team_b_points
      const theirPts = isTeamA ? result.team_b_points : result.team_a_points

      points += myPts
      if (myPts > theirPts) wins++
      else if (myPts < theirPts) losses++
      else ties++
    }

    const teamPlayers = [team.player1_id, team.player2_id]
      .filter(Boolean)
      .map(pid => (players ?? []).find(p => p.id === pid))
      .filter(Boolean) as Player[]

    return {
      team,
      players: teamPlayers,
      wins,
      losses,
      ties,
      points,
      matchesPlayed: wins + losses + ties,
    }
  })

  standings.sort((a, b) => b.points - a.points)

  const leader = standings[0]
  const leaderPts = leader?.points ?? 0

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-800">Standings</h1>
      {leagueData?.season && (
        <p className="text-gray-500">{leagueData.league.name} — {leagueData.season.year} Season</p>
      )}

      {standings.length === 0 ? (
        <p className="text-gray-500">No teams yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-800 text-white">
                <th className="px-4 py-3 text-left font-semibold">Rank</th>
                <th className="px-4 py-3 text-left font-semibold">Team</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Players</th>
                <th className="px-3 py-3 text-center font-semibold">W</th>
                <th className="px-3 py-3 text-center font-semibold">L</th>
                <th className="px-3 py-3 text-center font-semibold">T</th>
                <th className="px-3 py-3 text-center font-semibold">Pts</th>
                <th className="px-3 py-3 text-center font-semibold hidden sm:table-cell">Behind</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, idx) => {
                const isLeader = idx === 0
                const behind = leaderPts - s.points
                return (
                  <tr
                    key={s.team.id}
                    className={`border-t border-gray-100 ${isLeader ? 'bg-green-50 font-semibold' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-gray-600">
                      {isLeader ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-yellow-500">★</span> 1
                        </span>
                      ) : idx + 1}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {s.team.name}
                      {s.team.is_ghost && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Ghost</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">
                      {s.players.map(p => p.name).join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-800">{s.wins}</td>
                    <td className="px-3 py-3 text-center text-gray-800">{s.losses}</td>
                    <td className="px-3 py-3 text-center text-gray-800">{s.ties}</td>
                    <td className="px-3 py-3 text-center font-bold text-green-800">{s.points}</td>
                    <td className="px-3 py-3 text-center text-gray-500 hidden sm:table-cell">
                      {behind === 0 ? '—' : `-${behind}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">Tiebreaker: head-to-head (TBD)</p>
    </div>
  )
}
