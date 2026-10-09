import { ROUND_HOLES } from './course'

/**
 * Returns an array of 18 booleans indexed 0–17 (round hole 1–18).
 * strokesOnHole[i] = true if the player gets a stroke on round hole (i+1).
 *
 * Strokes are assigned to round holes in stroke index order (index 1 first).
 * If strokesReceived > 18, the player gets a second stroke on holes starting
 * at stroke index 1 again.
 */
export function getStrokesOnHoles(strokesReceived: number): boolean[] {
  // Sort holes by strokeIndex ascending
  const sortedByIndex = [...ROUND_HOLES].sort((a, b) => a.strokeIndex - b.strokeIndex)

  // strokeCounts[holeNumber] = how many strokes on that hole
  const strokeCounts = new Array(19).fill(0) // index 1–18

  for (let stroke = 0; stroke < strokesReceived; stroke++) {
    const holeIndex = stroke % 18
    const hole = sortedByIndex[holeIndex]
    strokeCounts[hole.number]++
  }

  // Build boolean array indexed 0–17 (hole 1 = index 0)
  return Array.from({ length: 18 }, (_, i) => strokeCounts[i + 1] > 0)
}

/**
 * Given 4 player handicaps [teamA_p1, teamA_p2, teamB_p1, teamB_p2],
 * returns strokes received for each player off the lowest handicap.
 */
export function allocateStrokes(
  handicaps: [number, number, number, number]
): [number, number, number, number] {
  const lowest = Math.min(...handicaps)
  return handicaps.map((h) => h - lowest) as [number, number, number, number]
}
