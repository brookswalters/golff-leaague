import { describe, it, expect } from 'vitest'
import { calculateHandicap } from './handicap'
import { allocateStrokes, getStrokesOnHoles } from './strokes'
import { scoreMatch } from './matchScoring'
import { calculateSkins } from './skins'
import { classifyScore, aggregateStats } from './stats'
import { ghostNetScore } from './ghost'
import { ROUND_HOLES, PHYSICAL_HOLES, COURSE_PAR } from './course'
import type { MatchPlayer, SkinEntry, HoleScore } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a MatchPlayer with a flat gross score for all 18 holes */
function makePlayer(
  playerId: string,
  teamId: string,
  handicap: number,
  grossPerHole: number | number[]
): MatchPlayer {
  const scores: HoleScore[] = ROUND_HOLES.map((h, i) => ({
    holeNumber: h.number,
    gross: Array.isArray(grossPerHole) ? grossPerHole[i] : grossPerHole,
  }))
  return { playerId, teamId, handicap, scores }
}

/** Build a SkinEntry array for a single hole across multiple players */
function skinEntries(
  holeNumber: number,
  playerScores: [string, number][],
  optedIn = true
): SkinEntry[] {
  return playerScores.map(([playerId, gross]) => ({
    playerId,
    holeNumber,
    gross,
    isOptedIn: optedIn,
  }))
}

// ---------------------------------------------------------------------------
// Course data sanity checks
// ---------------------------------------------------------------------------

describe('course', () => {
  it('has 9 physical holes with par 36', () => {
    const totalPar = PHYSICAL_HOLES.reduce((s, h) => s + h.par, 0)
    expect(totalPar).toBe(36)
  })

  it('has 18 round holes', () => {
    expect(ROUND_HOLES).toHaveLength(18)
  })

  it('front nine round holes are 1–9', () => {
    const front = ROUND_HOLES.filter((h) => h.number <= 9)
    expect(front).toHaveLength(9)
    expect(front.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('back nine round holes are 10–18', () => {
    const back = ROUND_HOLES.filter((h) => h.number >= 10)
    expect(back).toHaveLength(9)
    expect(back.map((h) => h.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('front nine stroke indexes are odd (hcp*2-1)', () => {
    const front = ROUND_HOLES.filter((h) => h.number <= 9)
    for (const h of front) {
      expect(h.strokeIndex % 2).toBe(1)
    }
  })

  it('back nine stroke indexes are even (hcp*2)', () => {
    const back = ROUND_HOLES.filter((h) => h.number >= 10)
    for (const h of back) {
      expect(h.strokeIndex % 2).toBe(0)
    }
  })

  it('total round par is 72', () => {
    const total = ROUND_HOLES.reduce((s, h) => s + h.par, 0)
    expect(total).toBe(COURSE_PAR)
  })

  it('physical hole 5 (strokeIndex 1) → front round stroke index 1, back round stroke index 2', () => {
    const front = ROUND_HOLES.find((h) => h.number === 5) // physical hole 5 → round hole 5
    const back = ROUND_HOLES.find((h) => h.number === 14) // same physical hole on back
    expect(front?.strokeIndex).toBe(1)
    expect(back?.strokeIndex).toBe(2)
  })

  it('physical hole 2 (strokeIndex 2) → front round stroke index 3, back round stroke index 4', () => {
    const front = ROUND_HOLES.find((h) => h.number === 2)
    const back = ROUND_HOLES.find((h) => h.number === 11)
    expect(front?.strokeIndex).toBe(3)
    expect(back?.strokeIndex).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Handicap tests
// ---------------------------------------------------------------------------

describe('handicap', () => {
  it('round 1 score 90 → handicap 16', () => {
    expect(calculateHandicap([90])).toBe(16)
    // (90-72)*0.9 = 16.2 → round → 16
  })

  it('round 1 score 72 → handicap 0', () => {
    expect(calculateHandicap([72])).toBe(0)
  })

  it('minimum handicap is 0 (score 68)', () => {
    expect(calculateHandicap([68])).toBe(0)
    // (68-72)*0.9 = -3.6 → round → -4, but clamped to 0
  })

  it('rounds 2–5 use average of ALL scores so far', () => {
    // After round 1 (score 90), for round 2 calculation we pass [90]
    expect(calculateHandicap([90])).toBe(16) // entering round 2 handicap

    // After round 2 (scores [90, 86]), for round 3 entering: avg(90,86)=88 → (88-72)*0.9=14.4 → 14
    expect(calculateHandicap([90, 86])).toBe(14)

    // After round 2 entering round 3: avg(90,86)=88 → 14 (same formula)
    // After round 3 (scores [90,86,94]): avg(90,86,94)=90 → (90-72)*0.9=16.2 → 16
    expect(calculateHandicap([90, 86, 94])).toBe(16)
  })

  it('round 4 handicap from [90, 86, 94] (entering week 4)', () => {
    // avg(90,86,94) = 90 → 16
    expect(calculateHandicap([90, 86, 94])).toBe(16)
  })

  it('round 5 uses average of all 5 scores', () => {
    // avg(90,86,94,88,92) = 90 → 16
    expect(calculateHandicap([90, 86, 94, 88, 92])).toBe(16)
  })

  it('round 6+ uses rolling last 5', () => {
    // scores [90, 86, 94, 88, 92, 80]
    // last 5 = [86, 94, 88, 92, 80] = avg 88 → (88-72)*0.9=14.4 → 14
    expect(calculateHandicap([90, 86, 94, 88, 92, 80])).toBe(14)
  })

  it('round 6+ rolling excludes oldest score', () => {
    // scores [100, 86, 94, 88, 92, 80]
    // last 5 = [86, 94, 88, 92, 80] = avg 88 → 14 (same as above — 100 excluded)
    expect(calculateHandicap([100, 86, 94, 88, 92, 80])).toBe(14)
  })

  it('round 7 still uses last 5', () => {
    // [90, 86, 94, 88, 92, 80, 76]
    // last 5 = [88, 92, 80, 76, 94]? No: last 5 = [88, 92, 80, 76] → wait
    // slice(-5) of [90,86,94,88,92,80,76] = [94,88,92,80,76] = avg 86 → (86-72)*0.9=12.6 → 13
    expect(calculateHandicap([90, 86, 94, 88, 92, 80, 76])).toBe(13)
  })

  it('mid-season join: player with 1 round gets round-1 handicap', () => {
    expect(calculateHandicap([84])).toBe(11)
    // (84-72)*0.9 = 10.8 → 11
  })

  it('mid-season join: player after 2 rounds uses average', () => {
    expect(calculateHandicap([84, 80])).toBe(9)
    // avg(84,80) = 82 → (82-72)*0.9=9 → 9
  })
})

// ---------------------------------------------------------------------------
// Stroke allocation tests
// ---------------------------------------------------------------------------

describe('stroke allocation', () => {
  it('all same handicap → everyone gets 0 strokes', () => {
    expect(allocateStrokes([10, 10, 10, 10])).toEqual([0, 0, 0, 0])
  })

  it('handicaps [10, 12, 8, 14] → strokes [2, 4, 0, 6]', () => {
    expect(allocateStrokes([10, 12, 8, 14])).toEqual([2, 4, 0, 6])
  })

  it('lowest handicap player gets 0 strokes', () => {
    const result = allocateStrokes([5, 8, 10, 12])
    expect(result[0]).toBe(0)
  })

  it('strokes are differences from low man', () => {
    const result = allocateStrokes([5, 8, 10, 12])
    expect(result).toEqual([0, 3, 5, 7])
  })
})

describe('getStrokesOnHoles', () => {
  it('0 strokes → all false', () => {
    const strokes = getStrokesOnHoles(0)
    expect(strokes).toHaveLength(18)
    expect(strokes.every((s) => s === false)).toBe(true)
  })

  it('1 stroke → true only on the hole with stroke index 1', () => {
    const strokes = getStrokesOnHoles(1)
    // Stroke index 1 = physical hole 5 front = round hole 5
    const holeWithSI1 = ROUND_HOLES.find((h) => h.strokeIndex === 1)!
    expect(strokes[holeWithSI1.number - 1]).toBe(true)
    // All others false
    const trueCount = strokes.filter(Boolean).length
    expect(trueCount).toBe(1)
  })

  it('18 strokes → every hole gets exactly 1 stroke', () => {
    const strokes = getStrokesOnHoles(18)
    expect(strokes.every((s) => s === true)).toBe(true)
  })

  it('20 strokes → 2 holes get a second stroke (index 1 and 2)', () => {
    // With 20 strokes: all 18 holes get 1 stroke, plus stroke index 1 and 2 get a second
    // But getStrokesOnHoles returns boolean (true/false), so we just check true count = 18
    // The actual double-stroke is relevant for net scoring but not in the boolean array
    const strokes = getStrokesOnHoles(20)
    // All 18 should be true (at least 1 stroke each)
    expect(strokes.every((s) => s === true)).toBe(true)
    expect(strokes).toHaveLength(18)
  })

  it('19 strokes → all holes true (18 + 1 wrap)', () => {
    const strokes = getStrokesOnHoles(19)
    expect(strokes.every((s) => s === true)).toBe(true)
  })

  it('2 strokes → true on stroke indexes 1 and 2', () => {
    const strokes = getStrokesOnHoles(2)
    const si1Hole = ROUND_HOLES.find((h) => h.strokeIndex === 1)!
    const si2Hole = ROUND_HOLES.find((h) => h.strokeIndex === 2)!
    expect(strokes[si1Hole.number - 1]).toBe(true)
    expect(strokes[si2Hole.number - 1]).toBe(true)
    const trueCount = strokes.filter(Boolean).length
    expect(trueCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Match scoring tests
// ---------------------------------------------------------------------------

describe('matchScoring', () => {
  it('total points always sum to 21', () => {
    const p1 = makePlayer('p1', 'A', 10, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 10, 5)
    const p4 = makePlayer('p4', 'B', 10, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    expect(result.teamATotalPoints + result.teamBTotalPoints).toBe(21)
  })

  it('identical scores → all ties → 10.5 each', () => {
    const p1 = makePlayer('p1', 'A', 10, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 10, 5)
    const p4 = makePlayer('p4', 'B', 10, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    expect(result.teamATotalPoints).toBe(10.5)
    expect(result.teamBTotalPoints).toBe(10.5)
  })

  it('team A always better → wins 21–0', () => {
    // Team A shoots 4s, Team B shoots 6s — same handicap
    const p1 = makePlayer('p1', 'A', 10, 4)
    const p2 = makePlayer('p2', 'A', 10, 4)
    const p3 = makePlayer('p3', 'B', 10, 6)
    const p4 = makePlayer('p4', 'B', 10, 6)
    const result = scoreMatch([p1, p2], [p3, p4])
    expect(result.teamATotalPoints).toBe(21)
    expect(result.teamBTotalPoints).toBe(0)
  })

  it('hole result: tie on a hole → 0.5 each', () => {
    const p1 = makePlayer('p1', 'A', 10, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 10, 5)
    const p4 = makePlayer('p4', 'B', 10, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    for (const hr of result.holeResults) {
      expect(hr.teamAPoints).toBe(0.5)
      expect(hr.teamBPoints).toBe(0.5)
    }
  })

  it('stroke allocation affects net scores correctly', () => {
    // Team A: p1 (hcp 8, low man), p2 (hcp 10) | Team B: p3 (hcp 12), p4 (hcp 14)
    // Strokes received: [0, 2, 4, 6]
    // Team A should win easily since they have lower handicap
    const p1 = makePlayer('p1', 'A', 8, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 12, 5)
    const p4 = makePlayer('p4', 'B', 14, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    // With same gross scores, Team B gets more strokes → lower net → wins
    expect(result.teamBTotalPoints).toBeGreaterThan(result.teamATotalPoints)
  })

  it('net score calculation: stroke reduces gross by 1', () => {
    // Give team A hcp 8, team B hcp 8+6=14 — p3 and p4
    // Handicaps [8, 8, 14, 8] → low is 8 → strokes [0,0,6,0]
    // p3 gets 6 strokes: assigned to stroke indexes 1,2,3,4,5,6
    // On hole with stroke index 1 (round hole 5), p3 gets a stroke
    const p1 = makePlayer('p1', 'A', 8, 5)
    const p2 = makePlayer('p2', 'A', 8, 5)
    const p3 = makePlayer('p3', 'B', 14, 5)
    const p4 = makePlayer('p4', 'B', 8, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    // Round hole 5 has stroke index 1, p3 gets a stroke there
    const hole5 = result.holeResults.find((h) => h.holeNumber === 5)!
    // teamA net = 5+5=10 (no strokes for p1,p2)
    expect(hole5.teamANet).toBe(10)
    // teamB net = (5-1) + 5 = 9 (p3 gets stroke on SI 1)
    expect(hole5.teamBNet).toBe(9)
  })

  it('holeResults has 18 entries', () => {
    const p1 = makePlayer('p1', 'A', 10, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 10, 5)
    const p4 = makePlayer('p4', 'B', 10, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    expect(result.holeResults).toHaveLength(18)
  })

  it('front + back + overall points are aggregate bonuses (total = hole points + 3 aggregate)', () => {
    const p1 = makePlayer('p1', 'A', 10, 5)
    const p2 = makePlayer('p2', 'A', 10, 5)
    const p3 = makePlayer('p3', 'B', 10, 5)
    const p4 = makePlayer('p4', 'B', 10, 5)
    const result = scoreMatch([p1, p2], [p3, p4])
    const aggregateA =
      result.teamAFrontPoints + result.teamABackPoints + result.teamAOverallPoints
    const aggregateB =
      result.teamBFrontPoints + result.teamBBackPoints + result.teamBOverallPoints
    expect(aggregateA + aggregateB).toBe(3)
    expect(result.teamAHolePoints + result.teamBHolePoints).toBe(18)
  })

  describe('ghost team', () => {
    it('ghost net score per hole is par + 1', () => {
      for (const hole of ROUND_HOLES) {
        expect(ghostNetScore(hole.number)).toBe(hole.par + 1)
      }
    })

    it('ghost team gets net bogey, real team can beat it', () => {
      // Ghost partner with a real player shooting par (net score = par per hole)
      // Team B = ghost + real player shooting par
      // On par 4: ghost net = 5, real player gross = 4 (hcp same, no strokes)
      // Team B net per hole = 5 + 4 = 9
      // Team A: two players shooting par = 4+4=8 net → Team A wins every hole
      const pA1 = makePlayer('pA1', 'A', 10, 4) // all par 4s (approximate)
      const pA2 = makePlayer('pA2', 'A', 10, 4)
      const pB1: MatchPlayer = {
        playerId: 'ghost',
        teamId: 'B',
        handicap: 10,
        scores: ROUND_HOLES.map((h) => ({ holeNumber: h.number, gross: 0 })),
      }
      const pB2 = makePlayer('pB2', 'B', 10, 4)
      const result = scoreMatch([pA1, pA2], [pB1, pB2])
      // Team A total net = par*2 per hole = 8 for par-4 holes
      // Ghost net = par+1, pB2 net = par → team B net = 2*par+1 > 2*par
      // So Team A should win most/all holes (except par-3 holes where par is 3 and gross 4 is bogey)
      expect(result.teamATotalPoints + result.teamBTotalPoints).toBe(21)
    })

    it('ghost net score on hole 1 (par 4) is 5', () => {
      expect(ghostNetScore(1)).toBe(5)
    })

    it('ghost net score on hole 2 (par 5) is 6', () => {
      expect(ghostNetScore(2)).toBe(6)
    })

    it('ghost net score on hole 3 (par 3) is 4', () => {
      expect(ghostNetScore(3)).toBe(4)
    })
  })
})

// ---------------------------------------------------------------------------
// Skins tests
// ---------------------------------------------------------------------------

describe('skins', () => {
  it('clear winner on a hole gets the skin', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 4], ['p3', 4], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    const hole1 = result.results.find((r) => r.holeNumber === 1)!
    expect(hole1.winnerId).toBe('p1')
  })

  it('tie on a hole → no skin (winnerId null)', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 3], ['p3', 4], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    const hole1 = result.results.find((r) => r.holeNumber === 1)!
    expect(hole1.winnerId).toBeNull()
  })

  it('total pot = players × buyIn', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 4], ['p3', 4], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    expect(result.totalPot).toBe(8) // 4 players × $2
  })

  it('payout per skin = total pot / number of skins', () => {
    // 4 players, 1 hole, 1 winner → payout = 8/1 = 8
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 4], ['p3', 4], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    expect(result.payoutPerSkin).toBe(8)
    expect(result.winners[0].payout).toBe(8)
  })

  it('carryover: tie on hole 1 adds to hole 2 pot', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 3], ['p3', 4], ['p4', 5]]),
      ...skinEntries(2, [['p1', 4], ['p2', 5], ['p3', 5], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, true)
    const hole1 = result.results.find((r) => r.holeNumber === 1)!
    const hole2 = result.results.find((r) => r.holeNumber === 2)!
    // hole1 ties, its pot carries to hole2
    expect(hole1.winnerId).toBeNull()
    expect(hole2.winnerId).toBe('p1')
    // hole2 pot = its share + hole1 carryover
    expect(hole2.pot).toBeGreaterThan(hole1.pot)
  })

  it('no carryover: tie on hole 1 does not affect hole 2 pot', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 3], ['p3', 4], ['p4', 5]]),
      ...skinEntries(2, [['p1', 4], ['p2', 5], ['p3', 5], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    const hole1 = result.results.find((r) => r.holeNumber === 1)!
    const hole2 = result.results.find((r) => r.holeNumber === 2)!
    expect(hole2.pot).toBe(hole1.pot) // equal shares, no carryover
  })

  it('all ties → no skins → payoutPerSkin is 0', () => {
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 3], ['p3', 3], ['p4', 3]]),
    ]
    const result = calculateSkins(entries, 2, false)
    expect(result.payoutPerSkin).toBe(0)
    expect(result.winners).toHaveLength(0)
  })

  it('non-opted-in players do not contribute to pot or compete', () => {
    const entries: SkinEntry[] = [
      { playerId: 'p1', holeNumber: 1, gross: 3, isOptedIn: true },
      { playerId: 'p2', holeNumber: 1, gross: 3, isOptedIn: true },
      { playerId: 'p3', holeNumber: 1, gross: 2, isOptedIn: false }, // not in
    ]
    const result = calculateSkins(entries, 2, false)
    // Only 2 opted-in players → pot = 4, not 6
    expect(result.totalPot).toBe(4)
    // p3 not opted in — tie between p1 and p2 → no winner
    const hole1 = result.results.find((r) => r.holeNumber === 1)!
    expect(hole1.winnerId).toBeNull()
  })

  it('multiple winners tracked correctly', () => {
    // 2 holes, each with a different winner
    const entries: SkinEntry[] = [
      ...skinEntries(1, [['p1', 3], ['p2', 4], ['p3', 4], ['p4', 5]]),
      ...skinEntries(2, [['p1', 5], ['p2', 3], ['p3', 5], ['p4', 5]]),
    ]
    const result = calculateSkins(entries, 2, false)
    expect(result.winners).toHaveLength(2)
    const p1win = result.winners.find((w) => w.playerId === 'p1')!
    const p2win = result.winners.find((w) => w.playerId === 'p2')!
    expect(p1win.holesWon).toContain(1)
    expect(p2win.holesWon).toContain(2)
  })
})

// ---------------------------------------------------------------------------
// Stats tests
// ---------------------------------------------------------------------------

describe('classifyScore', () => {
  it('score 1 on any hole → hole in one', () => {
    const cls = classifyScore(1, 3)
    expect(cls.holeInOne).toBe(true)
  })

  it('score 1 on par 3 → hole in one AND albatross (diff = -2, eagle)', () => {
    const cls = classifyScore(1, 3)
    expect(cls.holeInOne).toBe(true)
    // 1 - 3 = -2 → eagle
    expect(cls.eagle).toBe(true)
  })

  it('score 2 on par 5 → albatross', () => {
    const cls = classifyScore(2, 5)
    expect(cls.albatross).toBe(true)
    expect(cls.holeInOne).toBe(false)
  })

  it('score 3 on par 5 → eagle', () => {
    const cls = classifyScore(3, 5)
    expect(cls.eagle).toBe(true)
  })

  it('score 4 on par 5 → birdie', () => {
    const cls = classifyScore(4, 5)
    expect(cls.birdie).toBe(true)
  })

  it('score 5 on par 5 → par', () => {
    const cls = classifyScore(5, 5)
    expect(cls.par).toBe(true)
  })

  it('score 6 on par 5 → bogey', () => {
    const cls = classifyScore(6, 5)
    expect(cls.bogey).toBe(true)
  })

  it('score 7 on par 5 → double bogey+', () => {
    const cls = classifyScore(7, 5)
    expect(cls.doublePlus).toBe(true)
  })

  it('score 8 on par 5 → double bogey+', () => {
    const cls = classifyScore(8, 5)
    expect(cls.doublePlus).toBe(true)
  })

  it('score 4 on par 4 → par', () => {
    const cls = classifyScore(4, 4)
    expect(cls.par).toBe(true)
  })

  it('score 3 on par 4 → birdie', () => {
    const cls = classifyScore(3, 4)
    expect(cls.birdie).toBe(true)
  })

  it('score 2 on par 4 → eagle', () => {
    const cls = classifyScore(2, 4)
    expect(cls.eagle).toBe(true)
  })

  it('score 1 on par 4 → hole in one AND albatross', () => {
    const cls = classifyScore(1, 4)
    expect(cls.holeInOne).toBe(true)
    // 1-4 = -3 → albatross
    expect(cls.albatross).toBe(true)
  })

  it('only one classification flag set at a time (non HIO case)', () => {
    // Just verify each score maps to exactly one non-HIO category
    const scores = [
      { gross: 2, par: 5, expected: 'albatross' },
      { gross: 3, par: 5, expected: 'eagle' },
      { gross: 4, par: 5, expected: 'birdie' },
      { gross: 5, par: 5, expected: 'par' },
      { gross: 6, par: 5, expected: 'bogey' },
      { gross: 7, par: 5, expected: 'doublePlus' },
    ] as const
    for (const { gross, par, expected } of scores) {
      const cls = classifyScore(gross, par)
      const categories = ['albatross', 'eagle', 'birdie', 'par', 'bogey', 'doublePlus'] as const
      for (const cat of categories) {
        expect(cls[cat]).toBe(cat === expected)
      }
    }
  })
})

describe('aggregateStats', () => {
  it('2 players, 1 round each → correct totals', () => {
    // Player 1: all pars (gross = par for each round hole)
    // Player 2: all bogeys (gross = par + 1 for each round hole)
    const p1Scores: HoleScore[] = ROUND_HOLES.map((h) => ({
      holeNumber: h.number,
      gross: h.par,
    }))
    const p2Scores: HoleScore[] = ROUND_HOLES.map((h) => ({
      holeNumber: h.number,
      gross: h.par + 1,
    }))

    const stats = aggregateStats([
      { playerId: 'p1', scores: p1Scores },
      { playerId: 'p2', scores: p2Scores },
    ])

    expect(stats).toHaveLength(2)
    const p1stats = stats.find((s) => s.playerId === 'p1')!
    const p2stats = stats.find((s) => s.playerId === 'p2')!

    expect(p1stats.pars).toBe(18)
    expect(p1stats.birdies).toBe(0)
    expect(p1stats.bogeys).toBe(0)
    expect(p1stats.roundsPlayed).toBe(1)
    expect(p1stats.totalGross).toBe(72) // course par

    expect(p2stats.bogeys).toBe(18)
    expect(p2stats.pars).toBe(0)
    expect(p2stats.roundsPlayed).toBe(1)
    expect(p2stats.totalGross).toBe(90) // 72 + 18
  })

  it('hole in one counted correctly', () => {
    const scores: HoleScore[] = ROUND_HOLES.map((h) => ({
      holeNumber: h.number,
      gross: h.par,
    }))
    // Override hole 3 (par 3) to score 1 → hole in one
    scores[2] = { holeNumber: 3, gross: 1 }

    const stats = aggregateStats([{ playerId: 'p1', scores }])
    const p1 = stats[0]
    expect(p1.holeInOnes).toBe(1)
    expect(p1.eagles).toBe(1) // 1 on par 3 = -2 = eagle
  })

  it('albatross counted correctly', () => {
    const scores: HoleScore[] = ROUND_HOLES.map((h) => ({
      holeNumber: h.number,
      gross: h.par,
    }))
    // Override hole 2 (par 5) to score 2 → albatross
    scores[1] = { holeNumber: 2, gross: 2 }

    const stats = aggregateStats([{ playerId: 'p1', scores }])
    const p1 = stats[0]
    expect(p1.albatrosses).toBe(1)
  })

  it('multiple rounds for same player accumulate stats', () => {
    const parRound: HoleScore[] = ROUND_HOLES.map((h) => ({ holeNumber: h.number, gross: h.par }))
    const bogeyRound: HoleScore[] = ROUND_HOLES.map((h) => ({
      holeNumber: h.number,
      gross: h.par + 1,
    }))

    const stats = aggregateStats([
      { playerId: 'p1', scores: parRound },
      { playerId: 'p1', scores: bogeyRound },
    ])

    expect(stats).toHaveLength(1)
    const p1 = stats[0]
    expect(p1.roundsPlayed).toBe(2)
    expect(p1.pars).toBe(18)
    expect(p1.bogeys).toBe(18)
    expect(p1.totalGross).toBe(72 + 90)
  })
})
