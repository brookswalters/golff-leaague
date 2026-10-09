import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'
import { ROUND_HOLES } from '../../engine/course'
import { allocateStrokes, getStrokesOnHoles } from '../../engine/strokes'
import { scoreMatch } from '../../engine/matchScoring'
import { calculateHandicap } from '../../engine/handicap'
import type { Match, Team, Player, MatchPlayer, Score } from '../../lib/database.types'

// ---- Types ----

interface PlayerData {
  id: string
  name: string
  handicap: number
  strokesReceived: number
  strokesOnHoles: boolean[] // indexed 0–17
  isAbsent: boolean
  isGhost: boolean
}

interface MatchData {
  match: Match
  teamA: Team
  teamB: Team
  playersA: PlayerData[]
  playersB: PlayerData[]
}

// hole numbers for display
const FRONT_HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const BACK_HOLES = [10, 11, 12, 13, 14, 15, 16, 17, 18]

function ghostGross(holeNumber: number): number {
  const hole = ROUND_HOLES.find(h => h.number === holeNumber)!
  return hole.par + 1 // net bogey → gross = par+1 (no stroke adjustment for ghost)
}

function parFor(holeNumber: number): number {
  return ROUND_HOLES.find(h => h.number === holeNumber)!.par
}

// ---- Score grid per match ----

interface MatchScoreGridProps {
  matchData: MatchData
  scores: Record<string, Record<number, number>> // playerId → hole → gross
  onChange: (playerId: string, hole: number, value: number) => void
  onSave: () => Promise<void>
  saving: boolean
  saved: boolean
  error: string | null
}

function MatchScoreGrid({ matchData, scores, onChange, onSave, saving, saved, error }: MatchScoreGridProps) {
  const { match, teamA, teamB, playersA, playersB } = matchData
  const allPlayers = [...playersA, ...playersB]

  // Live point totals
  function computeLivePoints() {
    try {
      const hasAllScores = allPlayers.every(p => {
        if (p.isGhost || p.isAbsent) return true
        const ps = scores[p.id] ?? {}
        return ROUND_HOLES.every(h => ps[h.number] != null && ps[h.number] > 0)
      })
      if (!hasAllScores) return null

      function buildMatchPlayer(p: PlayerData) {
        return {
          playerId: p.isGhost || p.isAbsent ? 'ghost' : p.id,
          teamId: playersA.includes(p) ? teamA.id : teamB.id,
          handicap: p.handicap,
          scores: ROUND_HOLES.map(h => ({
            holeNumber: h.number,
            gross: (p.isGhost || p.isAbsent) ? ghostGross(h.number) : (scores[p.id]?.[h.number] ?? 0),
          })),
        }
      }

      const mp = allPlayers.map(buildMatchPlayer)
      return scoreMatch(
        [mp[0], mp[1]],
        [mp[2], mp[3]]
      )
    } catch {
      return null
    }
  }

  const liveResult = computeLivePoints()

  function getScore(playerId: string, hole: number, isGhost: boolean, isAbsent: boolean): number | null {
    if (isGhost || isAbsent) return ghostGross(hole)
    return scores[playerId]?.[hole] ?? null
  }

  function calcOut(playerId: string, isGhost: boolean, isAbsent: boolean): number {
    return FRONT_HOLES.reduce((s, h) => s + (getScore(playerId, h, isGhost, isAbsent) ?? 0), 0)
  }

  function calcIn(playerId: string, isGhost: boolean, isAbsent: boolean): number {
    return BACK_HOLES.reduce((s, h) => s + (getScore(playerId, h, isGhost, isAbsent) ?? 0), 0)
  }

  const teeTimeDisplay = match.tee_time ? match.tee_time.slice(0, 5) : ''

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-800">
          {teamA.name} <span className="text-gray-400 font-normal">vs</span> {teamB.name}
          {teeTimeDisplay && <span className="text-sm text-gray-500 ml-2 font-normal">@ {teeTimeDisplay}</span>}
        </h2>
        {liveResult && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500">{teamA.name}</div>
              <div className="text-2xl font-bold text-green-700">{liveResult.teamATotalPoints}</div>
            </div>
            <div className="text-gray-300 text-2xl">–</div>
            <div className="text-center">
              <div className="text-xs text-gray-500">{teamB.name}</div>
              <div className="text-2xl font-bold text-blue-700">{liveResult.teamBTotalPoints}</div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-green-800 text-white">
              <th className="sticky left-0 z-10 bg-green-800 px-3 py-2 text-left font-semibold min-w-[120px]">Player</th>
              {FRONT_HOLES.map(h => (
                <th key={h} className="px-1 py-2 w-11 text-center font-semibold">{h}</th>
              ))}
              <th className="px-2 py-2 w-12 text-center font-semibold bg-green-700">OUT</th>
              {BACK_HOLES.map(h => (
                <th key={h} className="px-1 py-2 w-11 text-center font-semibold">{h}</th>
              ))}
              <th className="px-2 py-2 w-12 text-center font-semibold bg-green-700">IN</th>
              <th className="px-2 py-2 w-14 text-center font-semibold bg-green-600">TOT</th>
            </tr>
            <tr className="bg-gray-100 text-gray-500">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1 text-xs font-medium">Par</td>
              {FRONT_HOLES.map(h => (
                <td key={h} className="px-1 py-1 text-center text-xs">{parFor(h)}</td>
              ))}
              <td className="px-2 py-1 text-center text-xs font-semibold bg-gray-200">
                {FRONT_HOLES.reduce((s, h) => s + parFor(h), 0)}
              </td>
              {BACK_HOLES.map(h => (
                <td key={h} className="px-1 py-1 text-center text-xs">{parFor(h)}</td>
              ))}
              <td className="px-2 py-1 text-center text-xs font-semibold bg-gray-200">
                {BACK_HOLES.reduce((s, h) => s + parFor(h), 0)}
              </td>
              <td className="px-2 py-1 text-center text-xs font-semibold bg-gray-200">
                {ROUND_HOLES.reduce((s, h) => s + h.par, 0)}
              </td>
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((player, pidx) => {
              const isTeamA = pidx < 2
              const rowBg = isTeamA ? 'bg-green-50' : 'bg-blue-50'
              const out = calcOut(player.id, player.isGhost, player.isAbsent)
              const inVal = calcIn(player.id, player.isGhost, player.isAbsent)
              const tot = out + inVal

              return (
                <tr key={player.id} className={`${rowBg} border-t border-gray-100`}>
                  <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1`}>
                    <div className="font-medium text-gray-800 text-xs leading-tight">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      hdcp {player.handicap}
                      {player.strokesReceived > 0 && ` · +${player.strokesReceived}`}
                      {(player.isGhost || player.isAbsent) && ' · ghost'}
                    </div>
                    {/* Dots row: which holes get strokes */}
                    <div className="flex gap-0 mt-0.5">
                      {ROUND_HOLES.map(h => (
                        <span key={h.number} className="w-[calc(theme(spacing.11))] text-center text-green-600 text-xs leading-none"
                          style={{ display: 'inline-block', width: '44px' }}>
                          {player.strokesOnHoles[h.number - 1] ? '•' : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  {FRONT_HOLES.map(h => (
                    <td key={h} className="px-1 py-1">
                      {player.isGhost || player.isAbsent ? (
                        <div className="w-11 h-8 flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded">
                          {ghostGross(h)}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={scores[player.id]?.[h] ?? ''}
                          onChange={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v >= 1 && v <= 15) onChange(player.id, h, v)
                            else if (e.target.value === '') onChange(player.id, h, 0)
                          }}
                          className="w-11 h-8 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center text-sm font-semibold text-gray-500 bg-gray-100">
                    {out > 0 ? out : ''}
                  </td>
                  {BACK_HOLES.map(h => (
                    <td key={h} className="px-1 py-1">
                      {player.isGhost || player.isAbsent ? (
                        <div className="w-11 h-8 flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded">
                          {ghostGross(h)}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={scores[player.id]?.[h] ?? ''}
                          onChange={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v >= 1 && v <= 15) onChange(player.id, h, v)
                            else if (e.target.value === '') onChange(player.id, h, 0)
                          }}
                          className="w-11 h-8 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center text-sm font-semibold text-gray-500 bg-gray-100">
                    {inVal > 0 ? inVal : ''}
                  </td>
                  <td className="px-2 py-1 text-center text-sm font-bold text-gray-700 bg-gray-100">
                    {tot > 0 ? tot : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Scores'}
        </button>
        {saved && (
          <span className="text-green-700 font-semibold">✓ Saved</span>
        )}
      </div>
    </div>
  )
}

// ---- Main page ----

export default function AdminScores() {
  const { weekId } = useParams<{ weekId: string }>()
  const { data: leagueData } = useLeague()
  const queryClient = useQueryClient()
  const seasonId = leagueData?.season?.id

  // Scores state: matchId → playerId → hole → gross
  const [scoresByMatch, setScoresByMatch] = useState<Record<string, Record<string, Record<number, number>>>>({})
  const [savingMatch, setSavingMatch] = useState<string | null>(null)
  const [savedMatch, setSavedMatch] = useState<Record<string, boolean>>({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})

  // ---- Fetch week ----
  const { data: week } = useQuery({
    queryKey: ['week', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase.from('weeks').select('*').eq('id', weekId!).single()
      if (error) throw error
      return data
    },
  })

  // ---- Fetch matches with all related data ----
  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['admin-scores-data', weekId, seasonId],
    enabled: !!weekId && !!seasonId,
    queryFn: async (): Promise<MatchData[]> => {
      // Fetch matches
      const { data: matches, error: matchErr } = await supabase
        .from('matches').select('*').eq('week_id', weekId!).order('tee_time')
      if (matchErr) throw matchErr
      if (!matches || matches.length === 0) return []

      // Fetch all team IDs
      const teamIds = [...new Set(matches.flatMap((m: Match) => [m.team_a_id, m.team_b_id]))]
      const { data: teams, error: teamsErr } = await supabase.from('teams').select('*').in('id', teamIds)
      if (teamsErr) throw teamsErr

      const teamsById: Record<string, Team> = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))

      // Fetch all player IDs
      const playerIds = [...new Set(
        (teams ?? []).flatMap((t: Team) => [t.player1_id, t.player2_id].filter(Boolean))
      )] as string[]

      const { data: players, error: playersErr } = await supabase
        .from('players').select('*').in('id', playerIds)
      if (playersErr) throw playersErr
      const playersById: Record<string, Player> = Object.fromEntries(
        (players ?? []).map((p: Player) => [p.id, p])
      )

      // Fetch latest handicaps
      const handicapMap: Record<string, number> = {}
      if (playerIds.length > 0) {
        const { data: handicaps } = await supabase
          .from('handicap_history').select('player_id, handicap, week_number')
          .in('player_id', playerIds).eq('season_id', seasonId!)
          .order('week_number', { ascending: false })
        for (const pid of playerIds) {
          const entry = (handicaps ?? []).find((h: any) => h.player_id === pid)
          handicapMap[pid] = entry?.handicap ?? 0
        }
      }

      // Fetch existing match_players
      const matchIds = matches.map((m: Match) => m.id)
      const { data: existingMPs } = await supabase
        .from('match_players').select('*').in('match_id', matchIds)
      const mpByMatchPlayer: Record<string, MatchPlayer> = {}
      for (const mp of (existingMPs ?? []) as MatchPlayer[]) {
        mpByMatchPlayer[`${mp.match_id}:${mp.player_id}`] = mp
      }

      // Build result
      return matches.map((match: Match) => {
        const teamA = teamsById[match.team_a_id]
        const teamB = teamsById[match.team_b_id]

        function getPlayerIds(team: Team): string[] {
          return [team.player1_id, team.player2_id].filter(Boolean) as string[]
        }

        const aIds = teamA ? getPlayerIds(teamA) : []
        const bIds = teamB ? getPlayerIds(teamB) : []

        const hdcps: [number, number, number, number] = [
          handicapMap[aIds[0]] ?? 0,
          handicapMap[aIds[1]] ?? 0,
          handicapMap[bIds[0]] ?? 0,
          handicapMap[bIds[1]] ?? 0,
        ]
        const [sr0, sr1, sr2, sr3] = allocateStrokes(hdcps)

        function buildPlayer(pid: string, sr: number, team: Team): PlayerData {
          const existingMP = mpByMatchPlayer[`${match.id}:${pid}`]
          const isAbsent = existingMP?.is_absent ?? false
          const isGhost = team.is_ghost
          return {
            id: pid,
            name: playersById[pid]?.name ?? 'Unknown',
            handicap: existingMP?.handicap_used ?? handicapMap[pid] ?? 0,
            strokesReceived: existingMP?.strokes_received ?? sr,
            strokesOnHoles: getStrokesOnHoles(existingMP?.strokes_received ?? sr),
            isAbsent,
            isGhost,
          }
        }

        // Ghost/missing player filler
        function ghostPlayer(teamId: string, _sr: number): PlayerData {
          return {
            id: `ghost-${teamId}`,
            name: 'Ghost',
            handicap: 0,
            strokesReceived: 0,
            strokesOnHoles: new Array(18).fill(false),
            isAbsent: false,
            isGhost: true,
          }
        }

        const playersA: PlayerData[] = [
          aIds[0] ? buildPlayer(aIds[0], sr0, teamA) : ghostPlayer(teamA?.id ?? '', sr0),
          aIds[1] ? buildPlayer(aIds[1], sr1, teamA) : ghostPlayer(teamA?.id ?? '', sr1),
        ]
        const playersB: PlayerData[] = [
          bIds[0] ? buildPlayer(bIds[0], sr2, teamB) : ghostPlayer(teamB?.id ?? '', sr2),
          bIds[1] ? buildPlayer(bIds[1], sr3, teamB) : ghostPlayer(teamB?.id ?? '', sr3),
        ]

        // If the whole team is ghost, mark all players as ghost
        if (teamA?.is_ghost) {
          playersA.forEach(p => { p.isGhost = true })
        }
        if (teamB?.is_ghost) {
          playersB.forEach(p => { p.isGhost = true })
        }

        return { match, teamA, teamB, playersA, playersB }
      })
    },
  })

  // ---- Load existing scores ----
  const { data: existingScoresRaw } = useQuery({
    queryKey: ['existing-scores', weekId],
    enabled: !!weekId && !!matchesData && matchesData.length > 0,
    queryFn: async () => {
      const matchIds = matchesData!.map(md => md.match.id)
      // Get match_players for these matches
      const { data: mps } = await supabase
        .from('match_players').select('*').in('match_id', matchIds)
      if (!mps || mps.length === 0) return {}

      const mpIds = (mps as MatchPlayer[]).map(mp => mp.id)
      const { data: scoresRaw } = await supabase
        .from('scores').select('*').in('match_player_id', mpIds)

      // Build map: matchId → playerId → hole → gross
      const result: Record<string, Record<string, Record<number, number>>> = {}
      for (const mp of (mps as MatchPlayer[])) {
        const playerScores = (scoresRaw as Score[] ?? []).filter(s => s.match_player_id === mp.id)
        if (playerScores.length > 0) {
          if (!result[mp.match_id]) result[mp.match_id] = {}
          result[mp.match_id][mp.player_id] = {}
          for (const s of playerScores) {
            result[mp.match_id][mp.player_id][s.hole_number] = s.gross
          }
        }
      }
      return result
    },
  })

  // Initialize scores from DB on load
  useEffect(() => {
    if (existingScoresRaw && Object.keys(existingScoresRaw).length > 0) {
      setScoresByMatch(prev => {
        const merged = { ...existingScoresRaw, ...prev }
        return merged
      })
    }
  }, [existingScoresRaw])

  const handleScoreChange = useCallback((matchId: string, playerId: string, hole: number, value: number) => {
    setScoresByMatch(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] ?? {}),
        [playerId]: {
          ...(prev[matchId]?.[playerId] ?? {}),
          [hole]: value,
        },
      },
    }))
    setSavedMatch(prev => ({ ...prev, [matchId]: false }))
  }, [])

  async function handleSave(md: MatchData) {
    const { match, teamA, teamB, playersA, playersB } = md
    const allPlayers = [...playersA, ...playersB]
    const matchScores = scoresByMatch[match.id] ?? {}
    setSavingMatch(match.id)
    setSaveErrors(prev => ({ ...prev, [match.id]: '' }))

    try {
      // 1. Ensure match_players rows exist
      const mpUpserts = allPlayers
        .filter(p => !p.isGhost || !p.id.startsWith('ghost'))
        .map((p, idx) => ({
          match_id: match.id,
          player_id: p.id,
          team_id: idx < 2 ? teamA.id : teamB.id,
          handicap_used: p.handicap,
          strokes_received: p.strokesReceived,
          is_sub: false,
          is_absent: p.isAbsent,
        }))

      // Upsert match_players (on conflict match_id+player_id)
      const { data: mpRows, error: mpErr } = await supabase
        .from('match_players')
        .upsert(mpUpserts, { onConflict: 'match_id,player_id' })
        .select()
      if (mpErr) throw mpErr

      const mpById: Record<string, string> = {} // playerId → match_player.id
      for (const mp of (mpRows as MatchPlayer[])) {
        mpById[mp.player_id] = mp.id
      }

      // 2. Upsert scores for non-ghost players
      const scoreUpserts: { match_player_id: string; hole_number: number; gross: number }[] = []
      for (const p of allPlayers) {
        if (p.isGhost || p.isAbsent) continue
        const mpId = mpById[p.id]
        if (!mpId) continue
        const playerScores = matchScores[p.id] ?? {}
        for (const h of ROUND_HOLES) {
          const gross = playerScores[h.number]
          if (gross && gross > 0) {
            scoreUpserts.push({ match_player_id: mpId, hole_number: h.number, gross })
          }
        }
      }
      if (scoreUpserts.length > 0) {
        const { error: scErr } = await supabase
          .from('scores')
          .upsert(scoreUpserts, { onConflict: 'match_player_id,hole_number' })
        if (scErr) throw scErr
      }

      // 3. Compute match result
      function buildMP(p: PlayerData, tid: string) {
        return {
          playerId: p.isGhost || p.isAbsent ? 'ghost' : p.id,
          teamId: tid,
          handicap: p.handicap,
          scores: ROUND_HOLES.map(h => ({
            holeNumber: h.number,
            gross: (p.isGhost || p.isAbsent)
              ? ghostGross(h.number)
              : (matchScores[p.id]?.[h.number] ?? ghostGross(h.number)),
          })),
        }
      }
      const result = scoreMatch(
        [buildMP(playersA[0], teamA.id), buildMP(playersA[1], teamA.id)],
        [buildMP(playersB[0], teamB.id), buildMP(playersB[1], teamB.id)]
      )

      // 4. Upsert match_results
      const { error: mrErr } = await supabase.from('match_results').upsert({
        match_id: match.id,
        team_a_points: result.teamATotalPoints,
        team_b_points: result.teamBTotalPoints,
        team_a_hole_points: result.teamAHolePoints,
        team_b_hole_points: result.teamBHolePoints,
        team_a_front_points: result.teamAFrontPoints,
        team_b_front_points: result.teamBFrontPoints,
        team_a_back_points: result.teamABackPoints,
        team_b_back_points: result.teamBBackPoints,
        team_a_overall_points: result.teamAOverallPoints,
        team_b_overall_points: result.teamBOverallPoints,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'match_id' })
      if (mrErr) throw mrErr

      // 5. Update handicap_history for each player
      if (seasonId && week) {
        for (const p of allPlayers) {
          if (p.isGhost || p.isAbsent || p.id.startsWith('ghost')) continue
          const playerScores = matchScores[p.id] ?? {}
          const gross = ROUND_HOLES.reduce((s, h) => s + (playerScores[h.number] ?? 0), 0)
          if (gross === 0) continue

          // Fetch full history for season
          const { data: history } = await supabase
            .from('handicap_history')
            .select('gross_score, week_number')
            .eq('player_id', p.id)
            .eq('season_id', seasonId)
            .order('week_number', { ascending: true })

          const pastGross = (history ?? [])
            .filter((h: any) => h.gross_score != null && h.week_number !== week.number)
            .map((h: any) => h.gross_score as number)

          const allGross = [...pastGross, gross]
          const newHandicap = calculateHandicap(allGross)

          await supabase.from('handicap_history').upsert({
            player_id: p.id,
            season_id: seasonId,
            week_number: week.number,
            handicap: newHandicap,
            gross_score: gross,
          }, { onConflict: 'player_id,season_id,week_number' })
        }
      }

      // 6. Check if all matches in week now have results → set week complete
      if (weekId && matchesData) {
        const allMatchIds = matchesData.map(md => md.match.id)
        const { data: existingResults } = await supabase
          .from('match_results').select('match_id').in('match_id', allMatchIds)
        const resultMatchIds = new Set((existingResults ?? []).map((r: any) => r.match_id))
        resultMatchIds.add(match.id) // just saved this one
        if (allMatchIds.every(id => resultMatchIds.has(id))) {
          await supabase.from('weeks').update({ status: 'complete' }).eq('id', weekId)
          queryClient.invalidateQueries({ queryKey: ['weeks'] })
        }
      }

      setSavedMatch(prev => ({ ...prev, [match.id]: true }))
      queryClient.invalidateQueries({ queryKey: ['admin-scores-data', weekId, seasonId] })
      queryClient.invalidateQueries({ queryKey: ['existing-scores', weekId] })
      queryClient.invalidateQueries({ queryKey: ['match-results'] })
    } catch (err: any) {
      setSaveErrors(prev => ({ ...prev, [match.id]: err?.message ?? 'Save failed' }))
    } finally {
      setSavingMatch(null)
    }
  }

  if (!weekId) return <p className="p-4 text-gray-500">No week selected.</p>
  if (isLoading) return <p className="p-4 text-gray-500">Loading...</p>

  const dateDisplay = week?.date ?? ''
  const weekNum = week?.number ?? '?'

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-800">
        Enter Scores — Week {weekNum}
        {dateDisplay && <span className="text-xl text-gray-500 ml-2 font-normal">({dateDisplay})</span>}
      </h1>

      {(!matchesData || matchesData.length === 0) && (
        <p className="text-gray-500">No matches found for this week.</p>
      )}

      {matchesData?.map(md => (
        <MatchScoreGrid
          key={md.match.id}
          matchData={md}
          scores={scoresByMatch[md.match.id] ?? {}}
          onChange={(pid, hole, val) => handleScoreChange(md.match.id, pid, hole, val)}
          onSave={() => handleSave(md)}
          saving={savingMatch === md.match.id}
          saved={!!savedMatch[md.match.id]}
          error={saveErrors[md.match.id] ?? null}
        />
      ))}
    </div>
  )
}
