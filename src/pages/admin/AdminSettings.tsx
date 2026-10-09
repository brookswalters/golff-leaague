import { useState, useEffect } from 'react'
import { useLeague } from '../../hooks/useLeague'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export default function AdminSettings() {
  const { data, isLoading } = useLeague()
  const queryClient = useQueryClient()

  const [leagueName, setLeagueName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [firstTeeTime, setFirstTeeTime] = useState('09:00')
  const [teeIntervalMin, setTeeIntervalMin] = useState(7)
  const [handicapRounds, setHandicapRounds] = useState(5)
  const [handicapAllowance, setHandicapAllowance] = useState(90)
  const [skinsBuyin, setSkinsBuyin] = useState(2)
  const [skinsGross, setSkinsGross] = useState(true)
  const [skinsCarryover, setSkinsCarryover] = useState(true)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (data) {
      setLeagueName(data.league.name)
      if (data.season) {
        setYear(data.season.year)
        setStartDate(data.season.start_date ?? '')
        setEndDate(data.season.end_date ?? '')
        setFirstTeeTime(data.season.first_tee_time ?? '09:00')
        setTeeIntervalMin(data.season.tee_interval_min)
        setHandicapRounds(data.season.handicap_rounds)
        setHandicapAllowance(Math.round(data.season.handicap_allowance * 100))
        setSkinsBuyin(data.season.skins_buyin)
        setSkinsGross(data.season.skins_gross)
        setSkinsCarryover(data.season.skins_carryover)
      }
    }
  }, [data])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      let leagueId = data?.league?.id

      if (leagueId) {
        const { error } = await supabase
          .from('leagues')
          .update({ name: leagueName })
          .eq('id', leagueId)
        if (error) throw error
      } else {
        const { data: newLeague, error } = await supabase
          .from('leagues')
          .insert({ name: leagueName })
          .select()
          .single()
        if (error) throw error
        leagueId = newLeague.id
      }

      const seasonData = {
        league_id: leagueId,
        year,
        start_date: startDate || null,
        end_date: endDate || null,
        first_tee_time: firstTeeTime,
        tee_interval_min: teeIntervalMin,
        handicap_rounds: handicapRounds,
        handicap_allowance: handicapAllowance / 100,
        skins_buyin: skinsBuyin,
        skins_gross: skinsGross,
        skins_carryover: skinsCarryover,
      }

      if (data?.season?.id) {
        const { error } = await supabase
          .from('seasons')
          .update(seasonData)
          .eq('id', data.season.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('seasons').insert(seasonData)
        if (error) throw error
      }

      await queryClient.invalidateQueries({ queryKey: ['league'] })
      showToast('success', 'Settings saved successfully.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      showToast('error', message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {toast && (
        <div
          className={`rounded p-3 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* League section */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">League</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
            <input
              type="text"
              required
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
        </div>

        {/* Season section */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Season</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season Year</label>
              <input
                type="number"
                required
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Tee Time</label>
              <input
                type="time"
                value={firstTeeTime}
                onChange={e => setFirstTeeTime(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tee Interval (minutes)</label>
              <input
                type="number"
                min={1}
                value={teeIntervalMin}
                onChange={e => setTeeIntervalMin(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handicap Rounds</label>
              <input
                type="number"
                min={1}
                value={handicapRounds}
                onChange={e => setHandicapRounds(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handicap Allowance (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={handicapAllowance}
                onChange={e => setHandicapAllowance(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skins Buy-in ($)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={skinsBuyin}
                onChange={e => setSkinsBuyin(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skinsGross}
                onChange={e => setSkinsGross(e.target.checked)}
                className="w-4 h-4 accent-green-700"
              />
              <span className="text-sm font-medium text-gray-700">Skins Gross</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skinsCarryover}
                onChange={e => setSkinsCarryover(e.target.checked)}
                className="w-4 h-4 accent-green-700"
              />
              <span className="text-sm font-medium text-gray-700">Skins Carryover</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 font-medium disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
