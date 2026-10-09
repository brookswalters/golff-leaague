import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ROUND_HOLES } from '../engine/course'
import { allocateStrokes, getStrokesOnHoles } from '../engine/strokes'
import type { Match, Team, Player, MatchPlayer, Score, MatchResult } from '../lib/database.types'

const FRONT = [1,2,3,4,5,6,7,8,9]
const BACK  = [10,11,12,13,14,15,16,17,18]

function parFor(n: number): number {
  return ROUND_HOLES.find(h => h.number === n)!.par
}

function formatTeeTime(tt: string | null): string {
  if (!tt) return ''
  return tt.slice(0, 5)
}

interface PlayerRow {
  name: string
  scores: Record<number, number> // hole → gross
  strokesOnHoles: boolean[]
}

interface MatchCardProps {
  match: Match
  teamA: Team
  teamB: Team
  playersA: PlayerRow[]
  playersB: PlayerRow[]
  result: MatchResult | null
}

function MatchCard({ match, teamA, teamB, playersA, playersB, result }: MatchCardProps) {
  const allPlayers = [...playersA, ...playersB]
  const hasScores = allPlayers.some(p => Object.keys(p.scores).length > 0)

  function netScore(p: PlayerRow, hole: number): number | null {
    const g = p.scores[hole]
    if (g == null) return null
    const stroke = p.strokesOnHoles[hole - 1] ? 1 : 0
    return g - stroke
  }

  function teamNet(players: PlayerRow[], hole: number): number | null {
    const nets = players.map(p => netScore(p, hole))
    if (nets.some(n => n == null)) return null
    return nets.reduce((s, n) => s! + n!, 0)!
  }

  function holePoint(hole: number): [number, number] {
    const an = teamNet(playersA, hole)
    const bn = teamNet(playersB, hole)
    if (an == null || bn == null) return [0, 0]
    if (an < bn) return [1, 0]
    if (bn < an) return [0, 1]
    return [0.5, 0.5]
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-800">
          {teamA.name} <span className="text-gray-400 font-normal mx-1">vs</span> {teamB.name}
          {match.tee_time && (
            <span className="text-sm text-gray-500 ml-2 font-normal">@ {formatTeeTime(match.tee_time)}</span>
          )}
        </h2>
        {result && (
          <div className="flex items-center gap-3 text-lg font-bold">
            <span className="text-green-700">{teamA.name}: {result.team_a_points}</span>
            <span className="text-gray-400">–</span>
            <span className="text-blue-700">{teamB.name}: {result.team_b_points}</span>
          </div>
        )}
      </div>

      {!hasScores ? (
        <p className="text-gray-400 italic">Scores not entered yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                <tr className="bg-green-800 text-white">
                  <th className="sticky left-0 z-10 bg-green-800 px-3 py-2 text-left min-w-[110px]">Player</th>
                  {FRONT.map(h => (
                    <th key={h} className="px-1 py-2 w-9 text-center">{h}</th>
                  ))}
                  <th className="px-2 py-2 w-10 text-center bg-green-700">OUT</th>
                  {BACK.map(h => (
                    <th key={h} className="px-1 py-2 w-9 text-center">{h}</th>
                  ))}
                  <th className="px-2 py-2 w-10 text-center bg-green-700">IN</th>
                  <th className="px-2 py-2 w-12 text-center bg-green-600">TOT</th>
                </tr>
                <tr className="bg-gray-100 text-gray-400">
                  <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1">Par</td>
                  {FRONT.map(h => <td key={h} className="px-1 py-1 text-center">{parFor(h)}</td>)}
                  <td className="px-2 py-1 text-center font-semibold bg-gray-200">{FRONT.reduce((s,h)=>s+parFor(h),0)}</td>
                  {BACK.map(h => <td key={h} className="px-1 py-1 text-center">{parFor(h)}</td>)}
                  <td className="px-2 py-1 text-center font-semibold bg-gray-200">{BACK.reduce((s,h)=>s+parFor(h),0)}</td>
                  <td className="px-2 py-1 text-center font-semibold bg-gray-200">72</td>
                </tr>
              </thead>
              <tbody>
                {allPlayers.map((p, pidx) => {
                  const isA = pidx < 2
                  const rowBg = isA ? 'bg-green-50' : 'bg-blue-50'
                  const outGross = FRONT.reduce((s,h) => s + (p.scores[h] ?? 0), 0)
                  const inGross = BACK.reduce((s,h) => s + (p.scores[h] ?? 0), 0)
                  return (
                    <tr key={pidx} className={`${rowBg} border-t border-gray-100`}>
                      <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1 font-medium text-gray-800`}>{p.name}</td>
                      {FRONT.map(h => {
                        const g = p.scores[h]
                        const net = netScore(p, h)
                        return (
                          <td key={h} className="px-1 py-1 text-center">
                            {g != null ? (
                              <div>
                                <div>{g}</div>
                                {p.strokesOnHoles[h-1] && net != null && (
                                  <div className="text-green-600 text-[10px]">{net}</div>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-2 py-1 text-center font-semibold text-gray-600 bg-gray-100">
                        {outGross > 0 ? outGross : ''}
                      </td>
                      {BACK.map(h => {
                        const g = p.scores[h]
                        const net = netScore(p, h)
                        return (
                          <td key={h} className="px-1 py-1 text-center">
                            {g != null ? (
                              <div>
                                <div>{g}</div>
                                {p.strokesOnHoles[h-1] && net != null && (
                                  <div className="text-green-600 text-[10px]">{net}</div>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-2 py-1 text-center font-semibold text-gray-600 bg-gray-100">
                        {inGross > 0 ? inGross : ''}
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-gray-700 bg-gray-100">
                        {outGross + inGross > 0 ? outGross + inGross : ''}
                      </td>
                    </tr>
                  )
                })}

                {/* Points per hole row */}
                <tr className="border-t-2 border-gray-300 bg-white">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1 text-xs font-semibold text-gray-500">Pts A</td>
                  {FRONT.map(h => {
                    const [ap] = holePoint(h)
                    return (
                      <td key={h} className="px-1 py-1 text-center text-xs font-semibold text-green-700">
                        {ap > 0 ? ap : ''}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-center text-xs font-bold text-green-700 bg-gray-100">
                    {result?.team_a_front_points ?? ''}
                  </td>
                  {BACK.map(h => {
                    const [ap] = holePoint(h)
                    return (
                      <td key={h} className="px-1 py-1 text-center text-xs font-semibold text-green-700">
                        {ap > 0 ? ap : ''}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-center text-xs font-bold text-green-700 bg-gray-100">
                    {result?.team_a_back_points ?? ''}
                  </td>
                  <td className="px-2 py-1 text-center text-xs font-bold text-green-700 bg-gray-100">
                    {result?.team_a_hole_points ?? ''}
                  </td>
                </tr>
                <tr className="border-t border-gray-100 bg-white">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1 text-xs font-semibold text-gray-500">Pts B</td>
                  {FRONT.map(h => {
                    const [, bp] = holePoint(h)
                    return (
                      <td key={h} className="px-1 py-1 text-center text-xs font-semibold text-blue-700">
                        {bp > 0 ? bp : ''}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-center text-xs font-bold text-blue-700 bg-gray-100">
                    {result?.team_b_front_points ?? ''}
                  </td>
                  {BACK.map(h => {
                    const [, bp] = holePoint(h)
                    return (
                      <td key={h} className="px-1 py-1 text-center text-xs font-semibold text-blue-700">
                        {bp > 0 ? bp : ''}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-center text-xs font-bold text-blue-700 bg-gray-100">
                    {result?.team_b_back_points ?? ''}
                  </td>
                  <td className="px-2 py-1 text-center text-xs font-bold text-blue-700 bg-gray-100">
                    {result?.team_b_hole_points ?? ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {result && (
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div className="bg-green-50 rounded-lg px-4 py-2">
                <div className="text-xs text-gray-500 mb-1">Point Summary</div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div className="font-semibold text-right">Front</div>
                  <div className="text-center">Holes</div>
                  <div className="font-semibold">Back</div>
                  <div className="text-right text-green-700">{result.team_a_front_points}</div>
                  <div className="text-center text-gray-400">vs</div>
                  <div className="text-blue-700">{result.team_b_front_points}</div>
                  <div className="text-right text-green-700">{result.team_a_hole_points}</div>
                  <div className="text-center text-gray-400">pts</div>
                  <div className="text-blue-700">{result.team_b_hole_points}</div>
                  <div className="text-right text-green-700">{result.team_a_back_points}</div>
                  <div className="text-center text-gray-400">vs</div>
                  <div className="text-blue-700">{result.team_b_back_points}</div>
                </div>
                <div className="mt-2 pt-2 border-t border-green-200 flex justify-between text-sm font-bold">
                  <span className="text-green-700">{teamA.name}: {result.team_a_points}</span>
                  <span className="text-blue-700">{teamB.name}: {result.team_b_points}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Results() {
  const { weekId } = useParams<{ weekId: string }>()

  const { data: week, isLoading: weekLoading } = useQuery({
    queryKey: ['week', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase.from('weeks').select('*').eq('id', weekId!).single()
      if (error) throw error
      return data
    },
  })

  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches-week', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('week_id', weekId!).order('tee_time')
      if (error) throw error
      return data as Match[]
    },
  })

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['teams-results', weekId],
    enabled: !!matches && matches.length > 0,
    queryFn: async () => {
      const ids = [...new Set((matches ?? []).flatMap(m => [m.team_a_id, m.team_b_id]))]
      const { data, error } = await supabase.from('teams').select('*').in('id', ids)
      if (error) throw error
      return Object.fromEntries((data as Team[]).map(t => [t.id, t]))
    },
  })

  // Fetch match_players
  const { data: matchPlayers } = useQuery({
    queryKey: ['match-players-results', weekId],
    enabled: !!matches && matches.length > 0,
    queryFn: async () => {
      const matchIds = (matches ?? []).map(m => m.id)
      const { data, error } = await supabase.from('match_players').select('*').in('match_id', matchIds)
      if (error) throw error
      return data as MatchPlayer[]
    },
  })

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ['players-results', weekId],
    enabled: !!matchPlayers && matchPlayers.length > 0,
    queryFn: async () => {
      const ids = [...new Set((matchPlayers ?? []).map(mp => mp.player_id))]
      if (ids.length === 0) return {} as Record<string, Player>
      const { data, error } = await supabase.from('players').select('*').in('id', ids)
      if (error) throw error
      return Object.fromEntries((data as Player[]).map(p => [p.id, p]))
    },
  })

  // Fetch scores
  const { data: scores } = useQuery({
    queryKey: ['scores-results', weekId],
    enabled: !!matchPlayers && matchPlayers.length > 0,
    queryFn: async () => {
      const mpIds = (matchPlayers ?? []).map(mp => mp.id)
      if (mpIds.length === 0) return [] as Score[]
      const { data, error } = await supabase.from('scores').select('*').in('match_player_id', mpIds)
      if (error) throw error
      return data as Score[]
    },
  })

  // Fetch match results
  const { data: matchResults } = useQuery({
    queryKey: ['match-results-week', weekId],
    enabled: !!matches && matches.length > 0,
    queryFn: async () => {
      const matchIds = (matches ?? []).map(m => m.id)
      const { data, error } = await supabase.from('match_results').select('*').in('match_id', matchIds)
      if (error) throw error
      return Object.fromEntries((data as MatchResult[]).map(r => [r.match_id, r]))
    },
  })

  if (weekLoading || matchesLoading) return <p className="p-4 text-gray-500">Loading results...</p>
  if (!weekId || !week) return <p className="p-4 text-gray-500">Week not found.</p>

  // Build per-match cards
  const mpByMatchPlayer: Record<string, MatchPlayer> = {}
  for (const mp of (matchPlayers ?? [])) {
    mpByMatchPlayer[`${mp.match_id}:${mp.player_id}`] = mp
  }

  const scoresByMPId: Record<string, Score[]> = {}
  for (const s of (scores ?? [])) {
    if (!scoresByMPId[s.match_player_id]) scoresByMPId[s.match_player_id] = []
    scoresByMPId[s.match_player_id].push(s)
  }

  function buildPlayerRows(match: Match, team: Team, teamPids: [string, string]): PlayerRow[] {
    const allPids = teamPids.filter(Boolean)
    const otherTeam = team.id === match.team_a_id ? teams?.[match.team_b_id] : teams?.[match.team_a_id]
    const otherPids: [string, string] = team.id === match.team_a_id
      ? [teams?.[match.team_b_id]?.player1_id ?? '', teams?.[match.team_b_id]?.player2_id ?? '']
      : [teams?.[match.team_a_id]?.player1_id ?? '', teams?.[match.team_a_id]?.player2_id ?? '']

    const aIds = team.id === match.team_a_id ? teamPids : otherPids
    const bIds = team.id === match.team_a_id ? otherPids : teamPids

    const hdcps: [number, number, number, number] = [
      (matchPlayers ?? []).find(mp => mp.match_id === match.id && mp.player_id === aIds[0])?.handicap_used ?? 0,
      (matchPlayers ?? []).find(mp => mp.match_id === match.id && mp.player_id === aIds[1])?.handicap_used ?? 0,
      (matchPlayers ?? []).find(mp => mp.match_id === match.id && mp.player_id === bIds[0])?.handicap_used ?? 0,
      (matchPlayers ?? []).find(mp => mp.match_id === match.id && mp.player_id === bIds[1])?.handicap_used ?? 0,
    ]
    const [sr0, sr1, sr2, sr3] = allocateStrokes(hdcps)

    return allPids.map((pid, i) => {
      const isTeamA = team.id === match.team_a_id
      const srIdx = isTeamA ? (i === 0 ? sr0 : sr1) : (i === 0 ? sr2 : sr3)
      const mp = (matchPlayers ?? []).find(p => p.match_id === match.id && p.player_id === pid)
      const sr = mp?.strokes_received ?? srIdx
      const soh = getStrokesOnHoles(sr)

      const mpScores = mp ? (scoresByMPId[mp.id] ?? []) : []
      const scoreMap: Record<number, number> = {}
      for (const s of mpScores) scoreMap[s.hole_number] = s.gross

      return {
        name: players?.[pid]?.name ?? 'Unknown',
        scores: scoreMap,
        strokesOnHoles: soh,
      }
    })
    void otherTeam // suppress unused
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">
          Week {week.number} Results
          <span className="text-xl font-normal text-gray-500 ml-2">({week.date})</span>
        </h1>
        <Link to="/schedule" className="text-sm text-green-700 hover:underline">← Schedule</Link>
      </div>

      {(!matches || matches.length === 0) && (
        <p className="text-gray-500">No matches this week.</p>
      )}

      {(matches ?? []).map(match => {
        const tA = teams?.[match.team_a_id]
        const tB = teams?.[match.team_b_id]
        if (!tA || !tB) return null
        const aIds: [string, string] = [tA.player1_id ?? '', tA.player2_id ?? '']
        const bIds: [string, string] = [tB.player1_id ?? '', tB.player2_id ?? '']
        const playersA = buildPlayerRows(match, tA, aIds)
        const playersB = buildPlayerRows(match, tB, bIds)
        return (
          <MatchCard
            key={match.id}
            match={match}
            teamA={tA}
            teamB={tB}
            playersA={playersA}
            playersB={playersB}
            result={matchResults?.[match.id] ?? null}
          />
        )
      })}
    </div>
  )
}
