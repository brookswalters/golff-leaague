import type { MatchPlayer, MatchResult, HoleResult } from './types'
import { ROUND_HOLES } from './course'
import { allocateStrokes, getStrokesOnHoles } from './strokes'
import { ghostNetScore } from './ghost'

/**
 * Score a match between two teams.
 *
 * Ghost players (playerId === 'ghost') use net bogey (par + 1) per hole.
 * All other players use their gross scores minus strokes received.
 */
export function scoreMatch(
  teamA: [MatchPlayer, MatchPlayer],
  teamB: [MatchPlayer, MatchPlayer]
): MatchResult {
  const allPlayers = [...teamA, ...teamB]

  // Build handicap array [a1, a2, b1, b2]
  const handicaps: [number, number, number, number] = [
    teamA[0].handicap,
    teamA[1].handicap,
    teamB[0].handicap,
    teamB[1].handicap,
  ]

  const strokesReceived = allocateStrokes(handicaps)
  const strokesOnHoles = allPlayers.map((_, idx) => getStrokesOnHoles(strokesReceived[idx]))

  const holeResults: HoleResult[] = []
  let teamAHolePoints = 0
  let teamBHolePoints = 0

  for (const hole of ROUND_HOLES) {
    const hn = hole.number

    // Net score per player on this hole
    const netScores = allPlayers.map((player, idx) => {
      if (player.playerId === 'ghost') {
        return ghostNetScore(hn)
      }
      const holeScore = player.scores.find((s) => s.holeNumber === hn)
      if (!holeScore) throw new Error(`Missing score for player ${player.playerId} hole ${hn}`)
      const stroke = strokesOnHoles[idx][hn - 1] ? 1 : 0
      return holeScore.gross - stroke
    })

    const teamANet = netScores[0] + netScores[1]
    const teamBNet = netScores[2] + netScores[3]

    let teamAPoints: number
    let teamBPoints: number
    if (teamANet < teamBNet) {
      teamAPoints = 1
      teamBPoints = 0
    } else if (teamBNet < teamANet) {
      teamAPoints = 0
      teamBPoints = 1
    } else {
      teamAPoints = 0.5
      teamBPoints = 0.5
    }

    holeResults.push({ holeNumber: hn, teamANet, teamBNet, teamAPoints, teamBPoints })
    teamAHolePoints += teamAPoints
    teamBHolePoints += teamBPoints
  }

  // Front nine: holes 1–9
  const frontResults = holeResults.filter((r) => r.holeNumber <= 9)
  const frontANet = frontResults.reduce((s, r) => s + r.teamANet, 0)
  const frontBNet = frontResults.reduce((s, r) => s + r.teamBNet, 0)

  let teamAFrontPoints: number
  let teamBFrontPoints: number
  if (frontANet < frontBNet) {
    teamAFrontPoints = 1
    teamBFrontPoints = 0
  } else if (frontBNet < frontANet) {
    teamAFrontPoints = 0
    teamBFrontPoints = 1
  } else {
    teamAFrontPoints = 0.5
    teamBFrontPoints = 0.5
  }

  // Back nine: holes 10–18
  const backResults = holeResults.filter((r) => r.holeNumber >= 10)
  const backANet = backResults.reduce((s, r) => s + r.teamANet, 0)
  const backBNet = backResults.reduce((s, r) => s + r.teamBNet, 0)

  let teamABackPoints: number
  let teamBBackPoints: number
  if (backANet < backBNet) {
    teamABackPoints = 1
    teamBBackPoints = 0
  } else if (backBNet < backANet) {
    teamABackPoints = 0
    teamBBackPoints = 1
  } else {
    teamABackPoints = 0.5
    teamBBackPoints = 0.5
  }

  // Overall: all 18 holes
  const overallANet = holeResults.reduce((s, r) => s + r.teamANet, 0)
  const overallBNet = holeResults.reduce((s, r) => s + r.teamBNet, 0)

  let teamAOverallPoints: number
  let teamBOverallPoints: number
  if (overallANet < overallBNet) {
    teamAOverallPoints = 1
    teamBOverallPoints = 0
  } else if (overallBNet < overallANet) {
    teamAOverallPoints = 0
    teamBOverallPoints = 1
  } else {
    teamAOverallPoints = 0.5
    teamBOverallPoints = 0.5
  }

  const teamATotalPoints =
    teamAHolePoints + teamAFrontPoints + teamABackPoints + teamAOverallPoints
  const teamBTotalPoints =
    teamBHolePoints + teamBFrontPoints + teamBBackPoints + teamBOverallPoints

  return {
    holeResults,
    teamAHolePoints,
    teamBHolePoints,
    teamAFrontPoints,
    teamBFrontPoints,
    teamABackPoints,
    teamBBackPoints,
    teamAOverallPoints,
    teamBOverallPoints,
    teamATotalPoints,
    teamBTotalPoints,
  }
}
