import { ROUND_HOLES } from './course'

/**
 * Returns the net score per hole for a ghost team (mode: 'net_bogey').
 * net_bogey: par + 1 for every hole.
 *
 * @param holeNumber - Round hole number (1–18)
 */
export function ghostNetScore(holeNumber: number): number {
  const hole = ROUND_HOLES.find((h) => h.number === holeNumber)
  if (!hole) throw new Error(`Invalid hole number: ${holeNumber}`)
  return hole.par + 1
}
