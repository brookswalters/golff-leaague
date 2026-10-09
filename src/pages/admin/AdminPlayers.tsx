import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../lib/database.types'

export default function AdminPlayers() {
  const { data: leagueData } = useLeague()
  const queryClient = useQueryClient()

  const leagueId = leagueData?.league?.id

  const { data: players, isLoading } = useQuery({
    queryKey: ['players', leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('league_id', leagueId)
        .order('name')
      if (error) throw error
      return data as Player[]
    },
  })

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSenior, setNewSenior] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSenior, setEditSenior] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function startEdit(player: Player) {
    setEditingId(player.id)
    setEditName(player.name)
    setEditEmail(player.email ?? '')
    setEditSenior(player.is_senior)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!leagueId) return
    setAdding(true)
    setAddError(null)
    const { error } = await supabase.from('players').insert({
      league_id: leagueId,
      name: newName,
      email: newEmail || null,
      is_senior: newSenior,
    })
    setAdding(false)
    if (error) {
      setAddError(error.message)
    } else {
      setNewName('')
      setNewEmail('')
      setNewSenior(false)
      setShowAddForm(false)
      queryClient.invalidateQueries({ queryKey: ['players', leagueId] })
    }
  }

  async function handleEditSave(playerId: string) {
    setEditSaving(true)
    setEditError(null)
    const { error } = await supabase
      .from('players')
      .update({ name: editName, email: editEmail || null, is_senior: editSenior })
      .eq('id', playerId)
    setEditSaving(false)
    if (error) {
      setEditError(error.message)
    } else {
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['players', leagueId] })
    }
  }

  async function handleDeactivate(playerId: string) {
    await supabase.from('players').update({ active: false }).eq('id', playerId)
    queryClient.invalidateQueries({ queryKey: ['players', leagueId] })
  }

  if (!leagueId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Players</h1>
        <p className="text-gray-500">Set up a league in Settings first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Players</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm font-medium"
        >
          {showAddForm ? 'Cancel' : 'Add Player'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">New Player</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newSenior}
                onChange={e => setNewSenior(e.target.checked)}
                className="w-4 h-4 accent-green-700"
              />
              <span className="text-sm font-medium text-gray-700">Senior (65+)</span>
            </label>
            {addError && (
              <p className="text-sm text-red-600">{addError}</p>
            )}
            <button
              type="submit"
              disabled={adding}
              className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 font-medium disabled:opacity-60"
            >
              {adding ? 'Saving...' : 'Add Player'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading players...</p>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {players && players.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">No players yet.</p>
          )}
          {players?.map(player => (
            <div key={player.id} className="p-4">
              {editingId === player.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editSenior}
                      onChange={e => setEditSenior(e.target.checked)}
                      className="w-4 h-4 accent-green-700"
                    />
                    <span className="text-sm font-medium text-gray-700">Senior (65+)</span>
                  </label>
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSave(player.id)}
                      disabled={editSaving}
                      className="bg-green-700 text-white px-3 py-1 rounded text-sm hover:bg-green-800 disabled:opacity-60"
                    >
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {player.name}
                      {player.is_senior && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          Senior
                        </span>
                      )}
                      {!player.active && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </p>
                    {player.email && (
                      <p className="text-sm text-gray-500">{player.email}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(player)}
                      className="border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {player.active && (
                      <button
                        onClick={() => handleDeactivate(player.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
