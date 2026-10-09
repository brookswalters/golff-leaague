import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { League, Season } from '../lib/database.types'

export function useLeague() {
  return useQuery({
    queryKey: ['league'],
    queryFn: async () => {
      const { data: league } = await supabase.from('leagues').select('*').limit(1).single()
      if (!league) return null
      const { data: season } = await supabase
        .from('seasons')
        .select('*')
        .eq('league_id', league.id)
        .order('year', { ascending: false })
        .limit(1)
        .single()
      return { league: league as League, season: season as Season | null }
    },
  })
}
