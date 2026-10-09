import { COURSE_PAR } from './course'

/**
 * Calculate the handicap to use for the next round (or same round if length === 1).
 *
 * @param grossScores - Array of 18-hole gross scores in chronological order
 *   - Length 1: use that single score (round 1 uses own score)
 *   - Length 2–5: average of all scores
 *   - Length 6+: rolling average of last 5
 * @returns Handicap (minimum 0)
 */
export function calculateHandicap(grossScores: number[]): number {
  if (grossScores.length === 0) return 0

  let avg: number
  if (grossScores.length <= 5) {
    avg = grossScores.reduce((sum, s) => sum + s, 0) / grossScores.length
  } else {
    const last5 = grossScores.slice(-5)
    avg = last5.reduce((sum, s) => sum + s, 0) / last5.length
  }

  const handicap = Math.round((avg - COURSE_PAR) * 0.9)
  return Math.max(0, handicap)
}
