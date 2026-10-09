import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'
import type { Team, Week, Match, Player } from '../../lib/database.types'

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

// ---- Matchup generator helpers ----

interface GeneratorState {
  open: boolean
  method: 'random' | 'handicap'
  pairings: [Team, Team][]
  teeTimes: string[]
  loading: boolean
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function randomPairings(teams: Team[]): [Team, Team][] {
  const shuffled = [...teams].sort(() => Math.random() - 0.5)
  const pairs: [Team, Team][] = []
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]])
  }
  return pairs
}

function handicapPairings(teams: Team[], handicaps: Record<string, number>): [Team, Team][] {
  const sorted = [...teams].sort((a, b) => (handicaps[b.id] ?? 0) - (handicaps[a.id] ?? 0))
  const pairs: [Team, Team][] = []
  for (let i = 0; i < sorted.length - 1; i += 2) {
    pairs.push([sorted[i], sorted[i + 1]])
  }
  return pairs
}

function buildTeeTimes(count: number, firstTeeTime: string, intervalMin: number): string[] {
  const times: string[] = []
  for (let i = 0; i < count; i++) {
    times.push(addMinutes(firstTeeTime, i * intervalMin))
  }
  return times
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const labelCls = 'block text-sm font-semibold text-gray-700 mb-1'

export default function AdminSchedule() {
  const { data: leagueData } = useLeague()
  const queryClient = useQueryClient()
  const seasonId = leagueData?.season?.id
  const leagueId = leagueData?.league?.id
  const season = leagueData?.season

  // --- Teams ---
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('season_id', seasonId)
        .order('name')
      if (error) throw error
      return data as Team[]
    },
  })

  const { data: players } = useQuery({
    queryKey: ['players', leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('league_id', leagueId)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Player[]
    },
  })

  // --- Weeks ---
  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ['weeks', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weeks')
        .select('*')
        .eq('season_id', seasonId)
        .order('number')
      if (error) throw error
      return data as Week[]
    },
  })

  // --- Matches ---
  const { data: matches } = useQuery({
    queryKey: ['matches', seasonId],
    enabled: !!seasonId && !!weeks && weeks.length > 0,
    queryFn: async () => {
      const weekIds = weeks?.map(w => w.id) ?? []
      if (weekIds.length === 0) return [] as Match[]
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .in('week_id', weekIds)
        .order('tee_time')
      if (error) throw error
      return data as Match[]
    },
  })

  // --- Add Team form ---
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamP1, setTeamP1] = useState('')
  const [teamP2, setTeamP2] = useState('')
  const [teamGhost, setTeamGhost] = useState(false)
  const [addingTeam, setAddingTeam] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!seasonId) return
    setAddingTeam(true)
    setTeamError(null)
    const { error } = await supabase.from('teams').insert({
      season_id: seasonId,
      name: teamName,
      player1_id: teamP1 || null,
      player2_id: teamP2 || null,
      is_ghost: teamGhost,
    })
    setAddingTeam(false)
    if (error) {
      setTeamError(error.message)
    } else {
      setTeamName('')
      setTeamP1('')
      setTeamP2('')
      setTeamGhost(false)
      setShowAddTeam(false)
      queryClient.invalidateQueries({ queryKey: ['teams', seasonId] })
    }
  }

  // --- Week actions ---
  const [weekActionLoading, setWeekActionLoading] = useState<string | null>(null)

  async function handleSetWeekStatus(weekId: string, status: string) {
    setWeekActionLoading(weekId)
    const { error } = await supabase.from('weeks').update({ status }).eq('id', weekId)
    setWeekActionLoading(null)
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['weeks', seasonId] })
    }
  }

  async function handleDeleteWeek(week: Week) {
    if (!window.confirm(`Delete Week ${week.number} (${week.date})? This cannot be undone.`)) return
    setWeekActionLoading(week.id)
    const { error } = await supabase.from('weeks').delete().eq('id', week.id)
    setWeekActionLoading(null)
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['weeks', seasonId] })
      queryClient.invalidateQueries({ queryKey: ['matches', seasonId] })
    }
  }

  // --- Add Match form (per week) ---
  const [addMatchWeekId, setAddMatchWeekId] = useState<string | null>(null)
  const [matchTeamA, setMatchTeamA] = useState('')
  const [matchTeamB, setMatchTeamB] = useState('')
  const [matchTeeTime, setMatchTeeTime] = useState('')
  const [addingMatch, setAddingMatch] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  function openAddMatch(weekId: string) {
    setAddMatchWeekId(weekId)
    setMatchTeamA('')
    setMatchTeamB('')
    setMatchTeeTime('')
    setMatchError(null)
  }

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!addMatchWeekId) return
    setAddingMatch(true)
    setMatchError(null)
    const { error } = await supabase.from('matches').insert({
      week_id: addMatchWeekId,
      team_a_id: matchTeamA,
      team_b_id: matchTeamB,
      tee_time: matchTeeTime || null,
    })
    setAddingMatch(false)
    if (error) {
      setMatchError(error.message)
    } else {
      setAddMatchWeekId(null)
      queryClient.invalidateQueries({ queryKey: ['matches', seasonId] })
    }
  }

  function getTeamName(id: string) {
    return teams?.find(t => t.id === id)?.name ?? id
  }

  // --- Matchup generator state ---
  const [generators, setGenerators] = useState<Record<string, GeneratorState>>({})
  const [savingMatchups, setSavingMatchups] = useState<string | null>(null)

  function getGenerator(weekId: string): GeneratorState {
    return generators[weekId] ?? {
      open: false,
      method: 'random',
      pairings: [],
      teeTimes: [],
      loading: false,
    }
  }

  function setGenerator(weekId: string, patch: Partial<GeneratorState>) {
    setGenerators(prev => ({
      ...prev,
      [weekId]: { ...getGenerator(weekId), ...patch },
    }))
  }

  async function fetchTeamHandicaps(teamsToScore: Team[]): Promise<Record<string, number>> {
    if (!seasonId) return {}
    const handicaps: Record<string, number> = {}

    await Promise.all(
      teamsToScore.map(async team => {
        const playerIds = [team.player1_id, team.player2_id].filter(Boolean) as string[]
        let total = 0
        await Promise.all(
          playerIds.map(async pid => {
            const { data } = await supabase
              .from('handicap_history')
              .select('handicap')
              .eq('player_id', pid)
              .eq('season_id', seasonId)
              .order('week_number', { ascending: false })
              .limit(1)
              .maybeSingle()
            total += data?.handicap ?? 0
          })
        )
        handicaps[team.id] = total
      })
    )

    return handicaps
  }

  async function handleOpenGenerator(weekId: string) {
    const cur = getGenerator(weekId)
    if (cur.open) {
      setGenerator(weekId, { open: false })
      return
    }
    setGenerator(weekId, { open: true, loading: true, pairings: [], teeTimes: [] })
    await runGenerate(weekId, 'random')
  }

  async function runGenerate(weekId: string, method: 'random' | 'handicap') {
    const activeTeams = teams ?? []
    const firstTeeTime = season?.first_tee_time ?? '08:00'
    const intervalMin = season?.tee_interval_min ?? 10

    let pairs: [Team, Team][]

    if (method === 'handicap') {
      const handicaps = await fetchTeamHandicaps(activeTeams)
      pairs = handicapPairings(activeTeams, handicaps)
    } else {
      pairs = randomPairings(activeTeams)
    }

    const teeTimes = buildTeeTimes(pairs.length, firstTeeTime, intervalMin)

    setGenerator(weekId, {
      open: true,
      method,
      pairings: pairs,
      teeTimes,
      loading: false,
    })
  }

  async function handleRegenerate(weekId: string) {
    const cur = getGenerator(weekId)
    setGenerator(weekId, { loading: true })
    await runGenerate(weekId, cur.method)
  }

  async function handleChangeMethod(weekId: string, method: 'random' | 'handicap') {
    setGenerator(weekId, { method, loading: true })
    await runGenerate(weekId, method)
  }

  function handleTeeTimeChange(weekId: string, idx: number, value: string) {
    const cur = getGenerator(weekId)
    const updated = [...cur.teeTimes]
    updated[idx] = value
    setGenerator(weekId, { teeTimes: updated })
  }

  async function handleSaveMatchups(weekId: string) {
    if (!seasonId) return
    const cur = getGenerator(weekId)
    const weekMatches = matches?.filter(m => m.week_id === weekId) ?? []

    if (weekMatches.length > 0) {
      const ok = window.confirm('This week already has matches. Replace them?')
      if (!ok) return
      const { error: delError } = await supabase
        .from('matches')
        .delete()
        .in('id', weekMatches.map(m => m.id))
      if (delError) {
        alert('Error deleting existing matches: ' + delError.message)
        return
      }
    }

    setSavingMatchups(weekId)

    const inserts = cur.pairings.map(([teamA, teamB], idx) => ({
      week_id: weekId,
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      tee_time: cur.teeTimes[idx] ? `${cur.teeTimes[idx]}:00` : null,
    }))

    const { error } = await supabase.from('matches').insert(inserts)
    setSavingMatchups(null)

    if (error) {
      alert('Error saving matchups: ' + error.message)
    } else {
      setGenerator(weekId, { open: false })
      queryClient.invalidateQueries({ queryKey: ['matches', seasonId] })
    }
  }

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">Schedule</h1>
        <p className="text-base text-gray-500">Set up a season in Settings first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Schedule</h1>

      {/* Teams section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Teams</h2>
          <button
            onClick={() => setShowAddTeam(!showAddTeam)}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
          >
            {showAddTeam ? 'Cancel' : 'Add Team'}
          </button>
        </div>

        {showAddTeam && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
            <h3 className="text-base font-semibold text-gray-800 mb-4">New Team</h3>
            <form onSubmit={handleAddTeam} className="space-y-4">
              <div>
                <label className={labelCls}>Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Player 1</label>
                  <select
                    value={teamP1}
                    onChange={e => setTeamP1(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— none —</option>
                    {players?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Player 2</label>
                  <select
                    value={teamP2}
                    onChange={e => setTeamP2(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— none —</option>
                    {players?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamGhost}
                  onChange={e => setTeamGhost(e.target.checked)}
                  className="w-5 h-5 accent-green-700"
                />
                <span className="text-base font-medium text-gray-700">Ghost Team</span>
              </label>
              {teamError && <p className="text-base text-red-600">{teamError}</p>}
              <button
                type="submit"
                disabled={addingTeam}
                className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-60"
              >
                {addingTeam ? 'Saving...' : 'Add Team'}
              </button>
            </form>
          </div>
        )}

        {teamsLoading ? (
          <p className="text-base text-gray-500">Loading teams...</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {(!teams || teams.length === 0) && (
              <p className="py-4 text-base text-gray-500">No teams yet.</p>
            )}
            {teams?.map(team => {
              const p1 = players?.find(p => p.id === team.player1_id)
              const p2 = players?.find(p => p.id === team.player2_id)
              return (
                <div key={team.id} className="py-3">
                  <p className="text-base font-semibold text-gray-800">
                    {team.name}
                    {team.is_ghost && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Ghost</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[p1?.name, p2?.name].filter(Boolean).join(' / ') || 'No players assigned'}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Weeks section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Weeks</h2>
          {weeks && weeks.length > 0 && (
            <span className="text-sm text-gray-500">{weeks.length} week{weeks.length === 1 ? '' : 's'}</span>
          )}
        </div>

        {weeksLoading ? (
          <p className="text-base text-gray-500">Loading weeks...</p>
        ) : !weeks || weeks.length === 0 ? (
          <p className="text-base text-gray-500">
            No weeks scheduled yet. Set your season start and end dates in Settings to generate the schedule.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Week list overview */}
            <div className="divide-y divide-gray-100">
              {weeks.map(week => {
                const isActionLoading = weekActionLoading === week.id
                return (
                  <div key={week.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base font-bold text-gray-800 w-20 shrink-0">
                        Week {week.number}
                      </span>
                      <span className="text-sm text-gray-500">{week.date}</span>
                      <StatusBadge status={week.status} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {week.status === 'rainout' ? (
                        <button
                          onClick={() => handleSetWeekStatus(week.id, 'scheduled')}
                          disabled={isActionLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : week.status !== 'complete' ? (
                        <button
                          onClick={() => handleSetWeekStatus(week.id, 'rainout')}
                          disabled={isActionLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                        >
                          Rainout
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDeleteWeek(week)}
                        disabled={isActionLoading}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Per-week match management */}
            <div className="space-y-4 pt-2">
              {weeks.map(week => {
                const weekMatches = matches?.filter(m => m.week_id === week.id) ?? []
                const gen = getGenerator(week.id)
                const isSaving = savingMatchups === week.id

                return (
                  <div key={week.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-gray-800">
                          Week {week.number}
                        </p>
                        <span className="text-sm text-gray-500">{week.date}</span>
                        <StatusBadge status={week.status} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => handleOpenGenerator(week.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          {gen.open ? 'Close Generator' : 'Generate Matchups'}
                        </button>
                        <button
                          onClick={() => openAddMatch(week.id)}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                        >
                          Add Match
                        </button>
                      </div>
                    </div>

                    {/* Matchup generator panel */}
                    {gen.open && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
                        <h4 className="text-base font-semibold text-gray-800">Generate Matchups</h4>

                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-base">
                            <input
                              type="radio"
                              name={`method-${week.id}`}
                              value="random"
                              checked={gen.method === 'random'}
                              onChange={() => handleChangeMethod(week.id, 'random')}
                              className="accent-blue-600"
                            />
                            <span>Random</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-base">
                            <input
                              type="radio"
                              name={`method-${week.id}`}
                              value="handicap"
                              checked={gen.method === 'handicap'}
                              onChange={() => handleChangeMethod(week.id, 'handicap')}
                              className="accent-blue-600"
                            />
                            <span>By Handicap</span>
                          </label>
                        </div>

                        {gen.loading ? (
                          <p className="text-base text-gray-500">Loading...</p>
                        ) : gen.pairings.length === 0 ? (
                          <p className="text-base text-gray-500">No teams available to pair.</p>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {gen.pairings.map(([teamA, teamB], idx) => (
                                <div key={idx} className="flex items-center gap-3 flex-wrap">
                                  <span className="text-base font-medium text-gray-900 min-w-[120px]">
                                    {teamA.name}
                                  </span>
                                  <span className="text-sm text-gray-400 font-semibold">vs</span>
                                  <span className="text-base font-medium text-gray-900 min-w-[120px]">
                                    {teamB.name}
                                  </span>
                                  <input
                                    type="time"
                                    value={gen.teeTimes[idx] ?? ''}
                                    onChange={e => handleTeeTimeChange(week.id, idx, e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleRegenerate(week.id)}
                                disabled={gen.loading}
                                className="border border-blue-400 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-60"
                              >
                                Regenerate
                              </button>
                              <button
                                onClick={() => handleSaveMatchups(week.id)}
                                disabled={isSaving || gen.loading}
                                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60"
                              >
                                {isSaving ? 'Saving...' : 'Save Matchups'}
                              </button>
                              <button
                                onClick={() => setGenerator(week.id, { open: false })}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Add match form for this week */}
                    {addMatchWeekId === week.id && (
                      <form onSubmit={handleAddMatch} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
                        <h4 className="text-base font-semibold text-gray-700">New Match</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Team A *</label>
                            <select
                              required
                              value={matchTeamA}
                              onChange={e => setMatchTeamA(e.target.value)}
                              className={inputCls}
                            >
                              <option value="">— select —</option>
                              {teams?.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Team B *</label>
                            <select
                              required
                              value={matchTeamB}
                              onChange={e => setMatchTeamB(e.target.value)}
                              className={inputCls}
                            >
                              <option value="">— select —</option>
                              {teams?.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Tee Time</label>
                            <input
                              type="time"
                              value={matchTeeTime}
                              onChange={e => setMatchTeeTime(e.target.value)}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        {matchError && <p className="text-base text-red-600">{matchError}</p>}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={addingMatch}
                            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60"
                          >
                            {addingMatch ? 'Saving...' : 'Save Match'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddMatchWeekId(null)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {weekMatches.length > 0 && (
                      <div className="divide-y divide-gray-100 pl-2">
                        {weekMatches.map(match => (
                          <div key={match.id} className="py-2 text-base text-gray-700">
                            <span className="font-medium">{getTeamName(match.team_a_id)}</span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className="font-medium">{getTeamName(match.team_b_id)}</span>
                            {match.tee_time && (
                              <span className="ml-2 text-sm text-gray-400">@ {match.tee_time}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
