import type { ScoreClassification, PlayerStats, HoleScore } from './types'
import { ROUND_HOLES } from './course'

/**
 * Classify a single hole score relative to par.
 */
export function classifyScore(gross: number, par: number): ScoreClassification {
  const diff = gross - par
  return {
    holeInOne: gross === 1,
    albatross: diff <= -3,
    eagle: diff === -2,
    birdie: diff === -1,
    par: diff === 0,
    bogey: diff === 1,
    doublePlus: diff >= 2,
  }
}

/**
 * Aggregate stats across multiple player rounds.
 *
 * @param rounds - Array of { playerId, scores } where scores has 18 entries (round holes 1–18)
 * @returns PlayerStats[] — one entry per unique playerId
 */
export function aggregateStats(
  rounds: { playerId: string; scores: HoleScore[] }[]
): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>()

  for (const round of rounds) {
    if (!statsMap.has(round.playerId)) {
      statsMap.set(round.playerId, {
        playerId: round.playerId,
        holeInOnes: 0,
        albatrosses: 0,
        eagles: 0,
        birdies: 0,
        pars: 0,
        bogeys: 0,
        doublePlus: 0,
        roundsPlayed: 0,
        totalGross: 0,
      })
    }

    const stats = statsMap.get(round.playerId)!
    stats.roundsPlayed++

    for (const holeScore of round.scores) {
      const hole = ROUND_HOLES.find((h) => h.number === holeScore.holeNumber)
      if (!hole) throw new Error(`Invalid hole number: ${holeScore.holeNumber}`)

      const cls = classifyScore(holeScore.gross, hole.par)
      stats.totalGross += holeScore.gross

      if (cls.holeInOne) stats.holeInOnes++
      // Note: hole-in-one can also be an albatross on a par 4+, but typically
      // on a par 3 it's just a hole-in-one. We track it separately.
      if (cls.albatross) stats.albatrosses++
      if (cls.eagle) stats.eagles++
      if (cls.birdie) stats.birdies++
      if (cls.par) stats.pars++
      if (cls.bogey) stats.bogeys++
      if (cls.doublePlus) stats.doublePlus++
    }
  }

  return Array.from(statsMap.values())
}
