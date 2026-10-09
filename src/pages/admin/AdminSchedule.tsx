import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'
import type { Team, Week, Match, Player } from '../../lib/database.types'

export default function AdminSchedule() {
  const { data: leagueData } = useLeague()
  const queryClient = useQueryClient()
  const seasonId = leagueData?.season?.id
  const leagueId = leagueData?.league?.id

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

  // --- Add Week form ---
  const [showAddWeek, setShowAddWeek] = useState(false)
  const [weekNumber, setWeekNumber] = useState(1)
  const [weekDate, setWeekDate] = useState('')
  const [addingWeek, setAddingWeek] = useState(false)
  const [weekError, setWeekError] = useState<string | null>(null)

  async function handleAddWeek(e: React.FormEvent) {
    e.preventDefault()
    if (!seasonId) return
    setAddingWeek(true)
    setWeekError(null)
    const { error } = await supabase.from('weeks').insert({
      season_id: seasonId,
      number: weekNumber,
      date: weekDate,
    })
    setAddingWeek(false)
    if (error) {
      setWeekError(error.message)
    } else {
      setWeekNumber((weeks?.length ?? 0) + 2)
      setWeekDate('')
      setShowAddWeek(false)
      queryClient.invalidateQueries({ queryKey: ['weeks', seasonId] })
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

  function teamName_by_id(id: string) {
    return teams?.find(t => t.id === id)?.name ?? id
  }

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-500">Set up a season in Settings first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>

      {/* Teams section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Teams</h2>
          <button
            onClick={() => setShowAddTeam(!showAddTeam)}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm font-medium"
          >
            {showAddTeam ? 'Cancel' : 'Add Team'}
          </button>
        </div>

        {showAddTeam && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">New Team</h3>
            <form onSubmit={handleAddTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Player 1</label>
                  <select
                    value={teamP1}
                    onChange={e => setTeamP1(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                  >
                    <option value="">— none —</option>
                    {players?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Player 2</label>
                  <select
                    value={teamP2}
                    onChange={e => setTeamP2(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                  >
                    <option value="">— none —</option>
                    {players?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamGhost}
                  onChange={e => setTeamGhost(e.target.checked)}
                  className="w-4 h-4 accent-green-700"
                />
                <span className="text-sm font-medium text-gray-700">Ghost Team</span>
              </label>
              {teamError && <p className="text-sm text-red-600">{teamError}</p>}
              <button
                type="submit"
                disabled={addingTeam}
                className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 font-medium disabled:opacity-60"
              >
                {addingTeam ? 'Saving...' : 'Add Team'}
              </button>
            </form>
          </div>
        )}

        {teamsLoading ? (
          <p className="text-gray-500 text-sm">Loading teams...</p>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {(!teams || teams.length === 0) && (
              <p className="p-4 text-gray-500 text-sm">No teams yet.</p>
            )}
            {teams?.map(team => {
              const p1 = players?.find(p => p.id === team.player1_id)
              const p2 = players?.find(p => p.id === team.player2_id)
              return (
                <div key={team.id} className="p-4">
                  <p className="font-medium text-gray-900">
                    {team.name}
                    {team.is_ghost && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Ghost</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {[p1?.name, p2?.name].filter(Boolean).join(' / ') || 'No players assigned'}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Weeks section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Weeks</h2>
          <button
            onClick={() => setShowAddWeek(!showAddWeek)}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm font-medium"
          >
            {showAddWeek ? 'Cancel' : 'Add Week'}
          </button>
        </div>

        {showAddWeek && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">New Week</h3>
            <form onSubmit={handleAddWeek} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Week Number *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={weekNumber}
                    onChange={e => setWeekNumber(Number(e.target.value))}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={weekDate}
                    onChange={e => setWeekDate(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
              </div>
              {weekError && <p className="text-sm text-red-600">{weekError}</p>}
              <button
                type="submit"
                disabled={addingWeek}
                className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 font-medium disabled:opacity-60"
              >
                {addingWeek ? 'Saving...' : 'Add Week'}
              </button>
            </form>
          </div>
        )}

        {weeksLoading ? (
          <p className="text-gray-500 text-sm">Loading weeks...</p>
        ) : (
          <div className="space-y-4">
            {(!weeks || weeks.length === 0) && (
              <p className="text-gray-500 text-sm">No weeks yet.</p>
            )}
            {weeks?.map(week => {
              const weekMatches = matches?.filter(m => m.week_id === week.id) ?? []
              return (
                <div key={week.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Week {week.number} — {week.date}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        week.status === 'complete'
                          ? 'bg-green-100 text-green-700'
                          : week.status === 'rainout'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {week.status}
                      </span>
                    </div>
                    <button
                      onClick={() => openAddMatch(week.id)}
                      className="bg-green-700 text-white px-3 py-1 rounded text-sm hover:bg-green-800"
                    >
                      Add Match
                    </button>
                  </div>

                  {/* Add match form for this week */}
                  {addMatchWeekId === week.id && (
                    <form onSubmit={handleAddMatch} className="border border-gray-200 rounded p-4 space-y-3 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700">New Match</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Team A *</label>
                          <select
                            required
                            value={matchTeamA}
                            onChange={e => setMatchTeamA(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                          >
                            <option value="">— select —</option>
                            {teams?.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Team B *</label>
                          <select
                            required
                            value={matchTeamB}
                            onChange={e => setMatchTeamB(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                          >
                            <option value="">— select —</option>
                            {teams?.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tee Time</label>
                          <input
                            type="time"
                            value={matchTeeTime}
                            onChange={e => setMatchTeeTime(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                          />
                        </div>
                      </div>
                      {matchError && <p className="text-sm text-red-600">{matchError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={addingMatch}
                          className="bg-green-700 text-white px-3 py-1 rounded text-sm hover:bg-green-800 disabled:opacity-60"
                        >
                          {addingMatch ? 'Saving...' : 'Save Match'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMatchWeekId(null)}
                          className="border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {weekMatches.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {weekMatches.map(match => (
                        <div key={match.id} className="py-2 text-sm text-gray-700">
                          {teamName_by_id(match.team_a_id)} vs {teamName_by_id(match.team_b_id)}
                          {match.tee_time && (
                            <span className="ml-2 text-gray-400">@ {match.tee_time}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
