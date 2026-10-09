import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { allocateStrokes } from '../engine/strokes'

export interface ScoresheetPlayer {
  id: string
  name: string
  handicap: number
  strokesReceived: number
}

export interface ScoresheetMatch {
  id: string
  teeTime: string
  teamA: { id: string; name: string; players: ScoresheetPlayer[] }
  teamB: { id: string; name: string; players: ScoresheetPlayer[] }
}

export interface ScoresheetWeek {
  weekNumber: number
  date: string
  leagueName: string
  matches: ScoresheetMatch[]
}

export function useScoresheetData(weekId: string | undefined) {
  return useQuery({
    queryKey: ['scoresheets', weekId],
    enabled: !!weekId,
    queryFn: async (): Promise<ScoresheetWeek> => {
      if (!weekId) throw new Error('No weekId')

      // 1. Fetch week
      const { data: week, error: weekErr } = await supabase
        .from('weeks')
        .select('*')
        .eq('id', weekId)
        .single()
      if (weekErr) throw weekErr

      // 2. Fetch season + league
      const { data: season, error: seasonErr } = await supabase
        .from('seasons')
        .select('*, leagues(name)')
        .eq('id', week.season_id)
        .single()
      if (seasonErr) throw seasonErr

      const leagueName = (season as any).leagues?.name ?? 'Golf League'

      // 3. Fetch matches for this week
      const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('*')
        .eq('week_id', weekId)
        .order('tee_time')
      if (matchErr) throw matchErr

      if (!matches || matches.length === 0) {
        return {
          weekNumber: week.number,
          date: week.date,
          leagueName,
          matches: [],
        }
      }

      // 4. Collect all team IDs
      const teamIds = [...new Set(matches.flatMap((m: any) => [m.team_a_id, m.team_b_id]))]

      // 5. Fetch teams
      const { data: teams, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
      if (teamsErr) throw teamsErr

      // 6. Collect all player IDs
      const playerIds = [...new Set(
        (teams ?? []).flatMap((t: any) => [t.player1_id, t.player2_id].filter(Boolean))
      )] as string[]

      // 7. Fetch players
      const { data: players, error: playersErr } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds)
      if (playersErr) throw playersErr

      // 8. Fetch latest handicap for each player this season
      const handicapMap: Record<string, number> = {}
      if (playerIds.length > 0) {
        const { data: handicaps } = await supabase
          .from('handicap_history')
          .select('player_id, handicap, week_number')
          .in('player_id', playerIds)
          .eq('season_id', week.season_id)
          .order('week_number', { ascending: false })

        // For each player, grab the latest entry
        for (const pid of playerIds) {
          const entry = (handicaps ?? []).find((h: any) => h.player_id === pid)
          handicapMap[pid] = entry?.handicap ?? 0
        }
      }

      // Helper lookups
      const teamsById = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))
      const playersById = Object.fromEntries((players ?? []).map((p: any) => [p.id, p]))

      function buildTeamPlayers(team: any): { id: string; name: string; handicap: number }[] {
        const pids = [team.player1_id, team.player2_id].filter(Boolean) as string[]
        return pids.map(pid => ({
          id: pid,
          name: playersById[pid]?.name ?? 'Unknown',
          handicap: handicapMap[pid] ?? 0,
        }))
      }

      // 9. Build scoresheet matches
      const scoresheetMatches: ScoresheetMatch[] = matches.map((match: any) => {
        const teamA = teamsById[match.team_a_id]
        const teamB = teamsById[match.team_b_id]
        const aPlayers = teamA ? buildTeamPlayers(teamA) : []
        const bPlayers = teamB ? buildTeamPlayers(teamB) : []

        // allocateStrokes needs exactly 4 handicaps [a1, a2, b1, b2]
        const hdcps: [number, number, number, number] = [
          aPlayers[0]?.handicap ?? 0,
          aPlayers[1]?.handicap ?? 0,
          bPlayers[0]?.handicap ?? 0,
          bPlayers[1]?.handicap ?? 0,
        ]
        const [sr0, sr1, sr2, sr3] = allocateStrokes(hdcps)

        const teeTime = match.tee_time
          ? match.tee_time.slice(0, 5) // "HH:MM"
          : ''

        return {
          id: match.id,
          teeTime,
          teamA: {
            id: match.team_a_id,
            name: teamA?.name ?? 'Team A',
            players: aPlayers.map((p, i) => ({
              ...p,
              strokesReceived: i === 0 ? sr0 : sr1,
            })),
          },
          teamB: {
            id: match.team_b_id,
            name: teamB?.name ?? 'Team B',
            players: bPlayers.map((p, i) => ({
              ...p,
              strokesReceived: i === 0 ? sr2 : sr3,
            })),
          },
        }
      })

      return {
        weekNumber: week.number,
        date: week.date,
        leagueName,
        matches: scoresheetMatches,
      }
    },
  })
}
