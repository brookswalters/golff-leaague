export interface HoleScore {
  holeNumber: number // 1–18
  gross: number
}

export interface PlayerRound {
  playerId: string
  scores: HoleScore[] // 18 holes
  handicapUsed: number
}

export interface MatchPlayer {
  playerId: string
  teamId: string
  handicap: number
  scores: HoleScore[]
}

export interface HoleResult {
  holeNumber: number
  teamANet: number
  teamBNet: number
  teamAPoints: number
  teamBPoints: number
}

export interface MatchResult {
  holeResults: HoleResult[]
  teamAHolePoints: number
  teamBHolePoints: number
  teamAFrontPoints: number
  teamBFrontPoints: number
  teamABackPoints: number
  teamBBackPoints: number
  teamAOverallPoints: number
  teamBOverallPoints: number
  teamATotalPoints: number
  teamBTotalPoints: number
}

export interface SkinEntry {
  playerId: string
  holeNumber: number
  gross: number
  isOptedIn: boolean
}

export interface SkinResult {
  holeNumber: number
  winnerId: string | null
  gross: number
  pot: number
}

export interface SkinsWeekResult {
  results: SkinResult[]
  payoutPerSkin: number
  totalPot: number
  winners: {
    playerId: string
    holesWon: number[]
    payout: number
  }[]
}

export interface ScoreClassification {
  holeInOne: boolean
  albatross: boolean
  eagle: boolean
  birdie: boolean
  par: boolean
  bogey: boolean
  doublePlus: boolean
}

export interface PlayerStats {
  playerId: string
  holeInOnes: number
  albatrosses: number
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doublePlus: number
  roundsPlayed: number
  totalGross: number
}
