import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../lib/database.types'

const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const labelCls = 'block text-sm font-semibold text-gray-700 mb-1'

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
        <h1 className="text-3xl font-bold text-gray-800">Players</h1>
        <p className="text-base text-gray-500">Set up a league in Settings first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Players</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-800"
        >
          {showAddForm ? 'Cancel' : 'Add Player'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">New Player</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newSenior}
                onChange={e => setNewSenior(e.target.checked)}
                className="w-5 h-5 accent-green-700"
              />
              <span className="text-base font-medium text-gray-700">Senior (65+)</span>
            </label>
            {addError && (
              <p className="text-base text-red-600">{addError}</p>
            )}
            <button
              type="submit"
              disabled={adding}
              className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-60"
            >
              {adding ? 'Saving...' : 'Add Player'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <p className="text-base text-gray-500">Loading players...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {players && players.length === 0 && (
            <p className="py-4 px-4 text-base text-gray-500">No players yet. Add your first player above.</p>
          )}
          {players?.map(player => (
            <div key={player.id} className="py-4 px-4">
              {editingId === player.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Name *</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editSenior}
                      onChange={e => setEditSenior(e.target.checked)}
                      className="w-5 h-5 accent-green-700"
                    />
                    <span className="text-base font-medium text-gray-700">Senior (65+)</span>
                  </label>
                  {editError && <p className="text-base text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSave(player.id)}
                      disabled={editSaving}
                      className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
                    >
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                      {player.name}
                      {player.is_senior && (
                        <span className="inline-block bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          Senior
                        </span>
                      )}
                      {!player.active && (
                        <span className="inline-block bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                    </p>
                    {player.email && (
                      <p className="text-sm text-gray-500 mt-0.5">{player.email}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => startEdit(player)}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    {player.active && (
                      <button
                        onClick={() => handleDeactivate(player.id)}
                        className="text-sm bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100"
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
