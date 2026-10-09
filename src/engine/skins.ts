import { SkinEntry, SkinResult, SkinsWeekResult } from './types'

/**
 * Calculate skins results for a week.
 *
 * @param entries - All SkinEntry records for the week (all holes, all players)
 * @param buyIn - Per-player buy-in amount (e.g. $2)
 * @param carryover - If true, unclaimed pots carry to the next hole
 */
export function calculateSkins(
  entries: SkinEntry[],
  buyIn: number,
  carryover: boolean
): SkinsWeekResult {
  // Only opted-in players participate
  const optedIn = entries.filter((e) => e.isOptedIn)

  // Total pot = unique opted-in players × buyIn
  const uniquePlayers = new Set(optedIn.map((e) => e.playerId))
  const totalPot = uniquePlayers.size * buyIn

  // Group entries by hole number
  const holeNumbers = Array.from(new Set(optedIn.map((e) => e.holeNumber))).sort((a, b) => a - b)

  // Map holeNumber → entries for that hole
  const byHole = new Map<number, SkinEntry[]>()
  for (const entry of optedIn) {
    if (!byHole.has(entry.holeNumber)) byHole.set(entry.holeNumber, [])
    byHole.get(entry.holeNumber)!.push(entry)
  }

  const results: SkinResult[] = []
  let carryPot = 0

  for (const hn of holeNumbers) {
    const holeEntries = byHole.get(hn) ?? []
    const holePot = totalPot / holeNumbers.length + (carryover ? carryPot : 0)

    if (holeEntries.length === 0) {
      results.push({ holeNumber: hn, winnerId: null, gross: 0, pot: holePot })
      if (carryover) carryPot = holePot
      else carryPot = 0
      continue
    }

    const minGross = Math.min(...holeEntries.map((e) => e.gross))
    const lowScorers = holeEntries.filter((e) => e.gross === minGross)

    if (lowScorers.length === 1) {
      // Skin won
      const winner = lowScorers[0]
      results.push({ holeNumber: hn, winnerId: winner.playerId, gross: minGross, pot: holePot })
      carryPot = 0
    } else {
      // Tie — no skin
      results.push({ holeNumber: hn, winnerId: null, gross: minGross, pot: holePot })
      if (carryover) {
        carryPot = holePot
      } else {
        carryPot = 0
      }
    }
  }

  // Tally winners
  const skinResults = results.filter((r) => r.winnerId !== null)
  const skinCount = skinResults.length
  const payoutPerSkin = skinCount > 0 ? totalPot / skinCount : 0

  const winnersMap = new Map<string, { holesWon: number[]; payout: number }>()
  for (const r of skinResults) {
    if (!r.winnerId) continue
    if (!winnersMap.has(r.winnerId)) {
      winnersMap.set(r.winnerId, { holesWon: [], payout: 0 })
    }
    const w = winnersMap.get(r.winnerId)!
    w.holesWon.push(r.holeNumber)
    w.payout += payoutPerSkin
  }

  const winners = Array.from(winnersMap.entries()).map(([playerId, { holesWon, payout }]) => ({
    playerId,
    holesWon,
    payout,
  }))

  return {
    results,
    payoutPerSkin,
    totalPot,
    winners,
  }
}
