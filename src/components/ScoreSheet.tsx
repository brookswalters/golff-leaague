import { PHYSICAL_HOLES, PAR_36, COURSE_PAR } from '../engine/course'
import type { ScoresheetMatch } from '../hooks/useScoresheetData'

interface ScoreSheetProps {
  match: ScoresheetMatch
  weekNumber: number
  date: string
  leagueName: string
}

// All 4 players: [teamA p1, teamA p2, teamB p1, teamB p2]
// Each player row has 18 score boxes + OUT + IN + TOT

const FRONT = PHYSICAL_HOLES // holes 1-9
const BACK = PHYSICAL_HOLES  // holes 10-18 (same par/index, different round hole numbers)

function formatTeeTime(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

interface StrokeCell {
  strokes: number // 0, 1, or 2
}

function StrokeDots({ strokes }: { strokes: number }) {
  if (strokes === 0) return null
  if (strokes === 1) return <span className="absolute top-0 right-0 text-xs leading-none" style={{ fontSize: '8px' }}>•</span>
  return <span className="absolute top-0 right-0 text-xs leading-none" style={{ fontSize: '8px' }}>••</span>
}

function ScoreBox({ strokeDots }: { strokeDots: StrokeCell }) {
  return (
    <td className="score-box border border-gray-400 relative" style={{ width: 24, height: 24, padding: '2px 4px', textAlign: 'center', minWidth: 24 }}>
      <StrokeDots strokes={strokeDots.strokes} />
    </td>
  )
}

function BlankBox({ wide }: { wide?: boolean }) {
  return (
    <td
      className="border border-gray-400"
      style={{ width: wide ? 32 : 24, minWidth: wide ? 32 : 24, height: 24, padding: '2px 4px', textAlign: 'center' }}
    />
  )
}

function HeaderCell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <th
      className="border border-gray-700 bg-gray-100 font-bold text-center"
      style={{ width: wide ? 32 : 24, minWidth: wide ? 32 : 24, padding: '2px 4px', fontSize: 10 }}
    >
      {children}
    </th>
  )
}

function DataCell({ children, bg }: { children?: React.ReactNode; bg?: string }) {
  return (
    <td
      className={`border border-gray-400 text-center ${bg ?? ''}`}
      style={{ padding: '2px 4px', fontSize: 10 }}
    >
      {children}
    </td>
  )
}

function PlayerRow({
  label,
  handicap,
  strokesReceived,
}: {
  label: string
  handicap: number
  strokesReceived: number
}) {
  // strokeCounts[i] = how many strokes on round hole (i+1)
  // Replicate logic from strokes.ts to support double-stroke display (strokesReceived >= 19)
  const strokeCounts: number[] = new Array(18).fill(0)
  if (strokesReceived > 0) {
    const roundHolesByIndex = [
      ...PHYSICAL_HOLES.map((h, i) => ({ roundIdx: i, strokeIndex: h.strokeIndex * 2 - 1 })),
      ...PHYSICAL_HOLES.map((h, i) => ({ roundIdx: i + 9, strokeIndex: h.strokeIndex * 2 })),
    ].sort((a, b) => a.strokeIndex - b.strokeIndex)

    for (let stroke = 0; stroke < strokesReceived; stroke++) {
      const holeIdx = stroke % 18
      const roundIdx = roundHolesByIndex[holeIdx].roundIdx
      strokeCounts[roundIdx]++
    }
  }

  const frontCells = FRONT.map((_, i) => ({ strokes: strokeCounts[i] }))
  const backCells = BACK.map((_, i) => ({ strokes: strokeCounts[i + 9] }))

  return (
    <tr>
      <td
        className="border border-gray-400 font-medium"
        style={{ padding: '2px 6px', fontSize: 10, whiteSpace: 'nowrap', minWidth: 140 }}
      >
        {label}
        <span className="text-gray-500 font-normal ml-1" style={{ fontSize: 9 }}>
          ({handicap} / {strokesReceived})
        </span>
      </td>
      {frontCells.map((cell, i) => (
        <ScoreBox key={i} strokeDots={cell} />
      ))}
      <BlankBox wide />
      {backCells.map((cell, i) => (
        <ScoreBox key={i + 9} strokeDots={cell} />
      ))}
      <BlankBox wide />
      <BlankBox wide />
    </tr>
  )
}

function NetPointsRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        className="border border-gray-400 font-medium text-gray-600"
        style={{ padding: '2px 6px', fontSize: 10, whiteSpace: 'nowrap', minWidth: 140 }}
      >
        {label}
      </td>
      {Array.from({ length: 9 }).map((_, i) => (
        <BlankBox key={i} />
      ))}
      <BlankBox wide />
      {Array.from({ length: 9 }).map((_, i) => (
        <BlankBox key={i + 9} />
      ))}
      <BlankBox wide />
      <BlankBox wide />
    </tr>
  )
}

export default function ScoreSheet({ match, weekNumber, date, leagueName }: ScoreSheetProps) {
  return (
    <div className="score-sheet bg-white" style={{ fontFamily: 'Arial, sans-serif', fontSize: 11 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold" style={{ fontSize: 14 }}>{leagueName}</div>
          <div className="font-semibold" style={{ fontSize: 12 }}>
            {match.teamA.name} vs {match.teamB.name}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold" style={{ fontSize: 12 }}>Week {weekNumber} — {date}</div>
          <div style={{ fontSize: 11 }}>Tee Time: {formatTeeTime(match.teeTime)}</div>
        </div>
      </div>

      {/* Score grid */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 140 }} />
          {Array.from({ length: 9 }).map((_, i) => <col key={i} style={{ width: 24 }} />)}
          <col style={{ width: 32 }} />
          {Array.from({ length: 9 }).map((_, i) => <col key={i + 9} style={{ width: 24 }} />)}
          <col style={{ width: 32 }} />
          <col style={{ width: 32 }} />
        </colgroup>
        <thead>
          {/* Hole number row */}
          <tr>
            <HeaderCell>Hole</HeaderCell>
            {FRONT.map(h => <HeaderCell key={h.number}>{h.number}</HeaderCell>)}
            <HeaderCell wide>OUT</HeaderCell>
            {BACK.map(h => <HeaderCell key={h.number + 9}>{h.number + 9}</HeaderCell>)}
            <HeaderCell wide>IN</HeaderCell>
            <HeaderCell wide>TOT</HeaderCell>
          </tr>
          {/* Par row */}
          <tr>
            <DataCell bg="bg-gray-50">Par</DataCell>
            {FRONT.map(h => <DataCell key={h.number} bg="bg-gray-50">{h.par}</DataCell>)}
            <DataCell bg="bg-gray-50">{PAR_36}</DataCell>
            {BACK.map(h => <DataCell key={h.number + 9} bg="bg-gray-50">{h.par}</DataCell>)}
            <DataCell bg="bg-gray-50">{PAR_36}</DataCell>
            <DataCell bg="bg-gray-50">{COURSE_PAR}</DataCell>
          </tr>
          {/* Stroke index row */}
          <tr>
            <DataCell bg="bg-gray-50">H'cap</DataCell>
            {FRONT.map(h => <DataCell key={h.number} bg="bg-gray-50">{h.strokeIndex}</DataCell>)}
            <DataCell bg="bg-gray-50" />
            {BACK.map(h => <DataCell key={h.number + 9} bg="bg-gray-50">{h.strokeIndex}</DataCell>)}
            <DataCell bg="bg-gray-50" />
            <DataCell bg="bg-gray-50" />
          </tr>
        </thead>
        <tbody>
          {/* Team A players */}
          {match.teamA.players.map(p => (
            <PlayerRow
              key={p.id}
              label={p.name}
              handicap={p.handicap}
              strokesReceived={p.strokesReceived}
            />
          ))}
          {/* Spacer / Team A ghost row if only 1 player */}
          {match.teamA.players.length < 2 && (
            <PlayerRow label="(open)" handicap={0} strokesReceived={0} />
          )}

          {/* Team Net / Points rows for Team A */}
          <NetPointsRow label={`${match.teamA.name} Net`} />

          {/* Separator */}
          <tr style={{ height: 6 }}>
            <td colSpan={23} style={{ border: 'none', background: '#f3f4f6' }} />
          </tr>

          {/* Team B players */}
          {match.teamB.players.map(p => (
            <PlayerRow
              key={p.id}
              label={p.name}
              handicap={p.handicap}
              strokesReceived={p.strokesReceived}
            />
          ))}
          {match.teamB.players.length < 2 && (
            <PlayerRow label="(open)" handicap={0} strokesReceived={0} />
          )}

          {/* Team Net / Points rows for Team B */}
          <NetPointsRow label={`${match.teamB.name} Net`} />

          {/* Separator */}
          <tr style={{ height: 6 }}>
            <td colSpan={23} style={{ border: 'none', background: '#f3f4f6' }} />
          </tr>

          {/* Points rows */}
          <NetPointsRow label={`Points ${match.teamA.name}`} />
          <NetPointsRow label={`Points ${match.teamB.name}`} />
        </tbody>
      </table>

      {/* Signatures */}
      <div className="flex items-center justify-between mt-4" style={{ fontSize: 11 }}>
        <div>
          <span className="font-semibold">Signed — {match.teamA.name}:</span>
          <span className="inline-block border-b border-gray-800 ml-2" style={{ width: 180 }} />
        </div>
        <div>
          <span className="font-semibold">{match.teamB.name}:</span>
          <span className="inline-block border-b border-gray-800 ml-2" style={{ width: 180 }} />
        </div>
      </div>
    </div>
  )
}
