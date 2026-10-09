import { useState, useEffect } from 'react'
import { useLeague } from '../../hooks/useLeague'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

function getLeagueDays(startDate: string, endDate: string, dayOfWeek: number): string[] {
  // dayOfWeek: 0=Sun, 1=Mon, ..., 3=Wed, ..., 6=Sat
  // Returns array of YYYY-MM-DD strings
  const dates: string[] = []
  const start = new Date(startDate + 'T12:00:00') // noon to avoid DST issues
  const end = new Date(endDate + 'T12:00:00')
  const current = new Date(start)
  // Advance to first occurrence of dayOfWeek
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1)
  }
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 7)
  }
  return dates
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const labelCls = 'block text-sm font-semibold text-gray-700 mb-1'

export default function AdminSettings() {
  const { data, isLoading } = useLeague()
  const queryClient = useQueryClient()

  const [leagueName, setLeagueName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [leagueDay, setLeagueDay] = useState(3) // 3 = Wednesday
  const [firstTeeTime, setFirstTeeTime] = useState('09:00')
  const [teeIntervalMin, setTeeIntervalMin] = useState(7)
  const [handicapRounds, setHandicapRounds] = useState(5)
  const [handicapAllowance, setHandicapAllowance] = useState(90)
  const [skinsBuyin, setSkinsBuyin] = useState(2)
  const [skinsGross, setSkinsGross] = useState(true)
  const [skinsCarryover, setSkinsCarryover] = useState(true)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [weeksNote, setWeeksNote] = useState<string | null>(null)

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
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setWeeksNote(null)

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

      let seasonId: string | undefined = data?.season?.id

      if (seasonId) {
        const { error } = await supabase
          .from('seasons')
          .update(seasonData)
          .eq('id', seasonId)
        if (error) throw error
      } else {
        const { data: newSeason, error } = await supabase
          .from('seasons')
          .insert(seasonData)
          .select()
          .single()
        if (error) throw error
        seasonId = newSeason.id
      }

      // Auto-generate weeks if start_date and end_date are set
      let toastMessage = 'Settings saved successfully.'
      if (startDate && endDate && seasonId) {
        // Check if weeks already exist for this season
        const { data: existingWeeks, error: weeksCheckError } = await supabase
          .from('weeks')
          .select('id')
          .eq('season_id', seasonId)
          .limit(1)

        if (weeksCheckError) throw weeksCheckError

        if (existingWeeks && existingWeeks.length > 0) {
          setWeeksNote('Weeks already generated. Manage them in the Schedule tab.')
        } else {
          const dates = getLeagueDays(startDate, endDate, leagueDay)
          if (dates.length > 0) {
            const weekRows = dates.map((date, i) => ({
              season_id: seasonId as string,
              number: i + 1,
              date,
              status: 'scheduled',
            }))
            const { error: insertError } = await supabase.from('weeks').insert(weekRows)
            if (insertError) throw insertError
            toastMessage = `Season saved. ${dates.length} week${dates.length === 1 ? '' : 's'} generated.`
            await queryClient.invalidateQueries({ queryKey: ['weeks', seasonId] })
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['league'] })
      showToast('success', toastMessage)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      showToast('error', message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="p-4 text-base text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

      {weeksNote && (
        <div className="rounded-lg p-4 text-base bg-blue-50 border border-blue-200 text-blue-800">
          {weeksNote}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* League section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">League</h2>
          <div>
            <label className={labelCls}>League Name</label>
            <input
              type="text"
              required
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Season section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Season</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Season Year</label>
              <input
                type="number"
                required
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>First Tee Time</label>
              <input
                type="time"
                value={firstTeeTime}
                onChange={e => setFirstTeeTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>League Day</label>
              <select
                value={leagueDay}
                onChange={e => setLeagueDay(Number(e.target.value))}
                className={inputCls}
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tee Interval (minutes)</label>
              <input
                type="number"
                min={1}
                value={teeIntervalMin}
                onChange={e => setTeeIntervalMin(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Handicap Rounds</label>
              <input
                type="number"
                min={1}
                value={handicapRounds}
                onChange={e => setHandicapRounds(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Handicap Allowance (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={handicapAllowance}
                onChange={e => setHandicapAllowance(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Skins Buy-in ($)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={skinsBuyin}
                onChange={e => setSkinsBuyin(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skinsGross}
                onChange={e => setSkinsGross(e.target.checked)}
                className="w-5 h-5 accent-green-700"
              />
              <span className="text-base font-medium text-gray-700">Skins Gross</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skinsCarryover}
                onChange={e => setSkinsCarryover(e.target.checked)}
                className="w-5 h-5 accent-green-700"
              />
              <span className="text-base font-medium text-gray-700">Skins Carryover</span>
            </label>
          </div>

          {(startDate && endDate) && (
            <p className="text-sm text-gray-500 mt-4">
              Weeks will be auto-generated on save if none exist yet for this season.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white px-8 py-3 rounded-lg text-base font-semibold hover:bg-green-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-medium shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-gray-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
