export const PAR_36 = 36
export const COURSE_PAR = 72

// Physical holes 1–9
export const PHYSICAL_HOLES = [
  { number: 1, par: 4, strokeIndex: 5 },
  { number: 2, par: 5, strokeIndex: 2 },
  { number: 3, par: 3, strokeIndex: 9 },
  { number: 4, par: 4, strokeIndex: 3 },
  { number: 5, par: 5, strokeIndex: 1 },
  { number: 6, par: 3, strokeIndex: 8 },
  { number: 7, par: 4, strokeIndex: 6 },
  { number: 8, par: 4, strokeIndex: 4 },
  { number: 9, par: 4, strokeIndex: 7 },
]

// 18 round holes: 1–9 front, 10–18 back
// roundStrokeIndex: front = physicalStrokeIndex * 2 - 1, back = physicalStrokeIndex * 2
export const ROUND_HOLES = [
  ...PHYSICAL_HOLES.map((h, i) => ({
    number: i + 1,
    par: h.par,
    physicalHole: h.number,
    strokeIndex: h.strokeIndex * 2 - 1,
  })),
  ...PHYSICAL_HOLES.map((h, i) => ({
    number: i + 10,
    par: h.par,
    physicalHole: h.number,
    strokeIndex: h.strokeIndex * 2,
  })),
].sort((a, b) => a.number - b.number)
