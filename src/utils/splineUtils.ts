import { IntPoint } from '../packages/Clipper/IntPoint'

export function generateSplineWithEnds(points: IntPoint[], resolution = 10): IntPoint[] {
  const pts = [points[points.length - 1], ...points, points[0]]
  return generateSpline(pts, resolution || 12)
}

export function generateSpline(points: IntPoint[], resolution = 10): IntPoint[] {
  // If fewer than 4 points, we can't create a proper Catmull-Rom spline
  if (points.length < 4) {
    return points
  }

  const splinePoints: IntPoint[] = []

  // Iterate through points to create spline segments
  for (let i = 1; i < points.length - 2; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2]

    // Generate interpolated points for each segment
    for (let t = 0; t <= 1; t += 1 / resolution) {
      const point = catmullRomInterpolation(p0, p1, p2, p3, t)
      splinePoints.push(point)
    }
  }

  return splinePoints
}

function catmullRomInterpolation(
  p0: IntPoint,
  p1: IntPoint,
  p2: IntPoint,
  p3: IntPoint,
  t: number
): IntPoint {
  const t2 = t * t
  const t3 = t2 * t

  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)

  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)

  return new IntPoint(x, y)
}

/**
 * Adapted from:
 * https://github.com/Simsso/Online-Tools/blob/master/src/page/logic/cubic-spline-interpolation.js
 */
/*
import * as math from 'mathjs'

import type Point from '../Point'

export function processPoints(points: Point[]) {
  // sort array by x values
  points.sort(function (a, b) {
    if (a.x < b.x) return -1
    if (a.x === b.x) return 0
    return 1
  })

  for (let i = 0; i < points.length; i++) {
    if (i < points.length - 1 && points[i].x === points[i + 1].x) {
      // two points have the same x-value

      // check if the y-value is the same
      if (points[i].y === points[i + 1].y) {
        // remove the latter
        points.splice(i, 1)
        i--
      } else {
        throw Error('SameXDifferentY')
      }
    }
  }

  if (points.length < 2) {
    throw Error('NotEnoughPoints')
  }

  // for (let i = points.length - 1; i >= 0; i--) {
  // 	points[i].x = parseFloat(points[i].x);
  // 	points[i].y = parseFloat(points[i].y);
  // }

  return points
}

export function getMinMax(points: Point[]) {
  // determine max and min x and y values
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x)
    maxX = Math.max(maxX, points[i].x)
    minY = Math.min(minY, points[i].y)
    maxY = Math.max(maxY, points[i].y)
  }

  return {
    minX: minX,
    maxX: maxX,
    minY: minY,
    maxY: maxY,
  }
}

// Cubic spline interpolation
// The function uses the library math.js to ensure high precision results.
// @param p The points. An array of objects with x and y coordinate.
// @param type The interpolation boundary condition ("quadratic", "notaknot", "periodic", "natural"). "natural" is the default value.
export function cubicSplineInterpolation(
  p: Point[],
  boundary: 'quadratic' | 'notaknot' | 'periodic' | 'natural' = 'natural'
) {
  let row = 0
  const solutionIndex = (p.length - 1) * 4

  // initialize matrix
  const m: math.BigNumber[][] = [] // rows
  for (let i = 0; i < (p.length - 1) * 4; i++) {
    // columns (rows + 1)
    m.push([])
    for (let j = 0; j <= (p.length - 1) * 4; j++) {
      m[i].push(math.bignumber(0)) // fill with zeros
    }
  }

  // splines through p equations
  for (let functionNr = 0; functionNr < p.length - 1; functionNr++, row++) {
    const p0 = p[functionNr],
      p1 = p[functionNr + 1]
    m[row][functionNr * 4 + 0] = math.pow(math.bignumber(p0.x), 3) as math.BigNumber
    m[row][functionNr * 4 + 1] = math.pow(math.bignumber(p0.x), 2) as math.BigNumber
    m[row][functionNr * 4 + 2] = math.bignumber(p0.x)
    m[row][functionNr * 4 + 3] = math.bignumber(1)
    m[row][solutionIndex] = math.bignumber(p0.y)

    m[++row][functionNr * 4 + 0] = math.pow(math.bignumber(p1.x), 3) as math.BigNumber
    m[row][functionNr * 4 + 1] = math.pow(math.bignumber(p1.x), 2) as math.BigNumber
    m[row][functionNr * 4 + 2] = math.bignumber(p1.x)
    m[row][functionNr * 4 + 3] = math.bignumber(1)
    m[row][solutionIndex] = math.bignumber(p1.y)
  }

  // first derivative
  for (let functionNr = 0; functionNr < p.length - 2; functionNr++, row++) {
    const p1 = p[functionNr + 1]
    m[row][functionNr * 4 + 0] = math.multiply(
      3,
      math.pow(math.bignumber(p1.x), 2)
    ) as math.BigNumber
    m[row][functionNr * 4 + 1] = math.multiply(2, math.bignumber(p1.x)) as math.BigNumber
    m[row][functionNr * 4 + 2] = math.bignumber(1)
    m[row][functionNr * 4 + 4] = math.multiply(
      -3,
      math.pow(math.bignumber(p1.x), 2)
    ) as math.BigNumber
    m[row][functionNr * 4 + 5] = math.multiply(-2, math.bignumber(p1.x)) as math.BigNumber
    m[row][functionNr * 4 + 6] = math.bignumber(-1)
  }

  // second derivative
  for (let functionNr = 0; functionNr < p.length - 2; functionNr++, row++) {
    const p1 = p[functionNr + 1]
    m[row][functionNr * 4 + 0] = math.multiply(6, math.bignumber(p1.x)) as math.BigNumber
    m[row][functionNr * 4 + 1] = math.bignumber(2)
    m[row][functionNr * 4 + 4] = math.multiply(-6, math.bignumber(p1.x)) as math.BigNumber
    m[row][functionNr * 4 + 5] = math.bignumber(-2)
  }

  // boundary conditions
  switch (boundary) {
    case 'quadratic': // first and last spline quadratic
      m[row++][0] = math.bignumber(1)
      m[row++][solutionIndex - 4 + 0] = math.bignumber(1)
      break

    case 'notaknot': // Not-a-knot spline
      m[row][0 + 0] = math.bignumber(1)
      m[row++][0 + 4] = math.bignumber(-1)
      m[row][solutionIndex - 8 + 0] = math.bignumber(1)
      m[row][solutionIndex - 4 + 0] = math.bignumber(-1)
      break

    case 'periodic': // periodic function
      // first derivative of first and last point equal
      m[row][0] = math.multiply(3, math.pow(math.bignumber(p[0].x), 2)) as math.BigNumber
      m[row][1] = math.multiply(2, math.bignumber(p[0].x)) as math.BigNumber
      m[row][2] = math.bignumber(1)
      m[row][solutionIndex - 4 + 0] = math.multiply(
        -3,
        math.pow(math.bignumber(p[p.length - 1].x), 2)
      ) as math.BigNumber
      m[row][solutionIndex - 4 + 1] = math.multiply(
        -2,
        math.bignumber(p[p.length - 1].x)
      ) as math.BigNumber
      m[row++][solutionIndex - 4 + 2] = math.bignumber(-1)

      // second derivative of first and last point equal
      m[row][0] = math.multiply(6, math.bignumber(p[0].x)) as math.BigNumber
      m[row][1] = math.bignumber(2)
      m[row][solutionIndex - 4 + 0] = math.multiply(
        -6,
        math.bignumber(p[p.length - 1].x)
      ) as math.BigNumber
      m[row][solutionIndex - 4 + 1] = math.bignumber(-2)
      break

    default: // natural spline
      m[row][0 + 0] = math.bignumber(math.multiply(6, p[0].x))
      m[row++][0 + 1] = math.bignumber(2)
      m[row][solutionIndex - 4 + 0] = math.multiply(
        6,
        math.bignumber(p[p.length - 1].x)
      ) as math.BigNumber
      m[row][solutionIndex - 4 + 1] = math.bignumber(2)
      break
  }

  const reducedRowEchelonForm = rref(m)
  const coefficients: math.BigNumber[] = []
  for (let i = 0; i < reducedRowEchelonForm.length; i++) {
    coefficients.push(reducedRowEchelonForm[i][reducedRowEchelonForm[i].length - 1])
  }

  const functions: {
    a: number
    b: number
    c: number
    d: number
    range: { xmin: number; xmax: number }
  }[] = []
  for (let i = 0; i < coefficients.length; i += 4) {
    functions.push({
      a: coefficients[i].toNumber(),
      b: coefficients[i + 1].toNumber(),
      c: coefficients[i + 2].toNumber(),
      d: coefficients[i + 3].toNumber(),
      range: { xmin: p[i / 4].x, xmax: p[i / 4 + 1].x },
    })
  }
  return functions
}

// Reduced row echelon form
// Taken from https://rosettacode.org/wiki/Reduced_row_echelon_form
// Modified to work with math.js (high float precision).
function rref(mat: math.BigNumber[][]) {
  let lead = 0
  for (let r = 0; r < mat.length; r++) {
    if (mat[0].length <= lead) {
      return
    }
    let i = r
    while (mat[i][lead].isZero()) {
      i++
      if (mat.length == i) {
        i = r
        lead++
        if (mat[0].length == lead) {
          return
        }
      }
    }

    const tmp = mat[i]
    mat[i] = mat[r]
    mat[r] = tmp

    let val = mat[r][lead]
    for (let j = 0; j < mat[0].length; j++) {
      mat[r][j] = math.divide(mat[r][j], val) as math.BigNumber
    }

    for (let i = 0; i < mat.length; i++) {
      if (i == r) continue
      val = math.bignumber(mat[i][lead])
      for (let j = 0; j < mat[0].length; j++) {
        mat[i][j] = math.subtract(
          math.bignumber(mat[i][j]),
          math.multiply(val, math.bignumber(mat[r][j]))
        ) as math.BigNumber
      }
    }
    lead++
  }
  return mat
}

/**
 * Adapted from:
 * https://github.com/AlecJStrickland/parametric-cubic-spline/blob/main/index.js
 */
/*
import Point from '../Point'

const cubicSplineInterpolation = (points: Point[]) => {
  const n = points.length
  const h: number[] = []
  const alpha: number[] = []
  const l: number[] = []
  const mu: number[] = []
  const z: number[] = []
  const c: number[] = []
  const b: number[] = []
  const d: number[] = []

  for (let i = 0; i < n - 1; i++) {
    h[i] = points[i + 1].x - points[i].x
    alpha[i] =
      (3 / h[i]) * (points[i + 1].y - points[i].y) -
      (3 / h[i - 1]) * (points[i].y - points[i - 1].y)
  }

  l[0] = 1
  mu[0] = 0
  z[0] = 0

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (points[i + 1].x - points[i - 1].x) - h[i - 1] * mu[i - 1]
    mu[i] = h[i] / l[i]
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i]
  }

  l[n - 1] = 1
  z[n - 1] = 0
  c[n - 1] = 0

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] = (points[j + 1].y - points[j].y) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j])
  }

  return { b, c, d }
}

export const interpolateCubicSpline = (points: Point[], resolution: number): Point[] => {
  const { b, c, d } = cubicSplineInterpolation(points)

  const curve: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    // const h = points[i + 1].x - points[i].x
    for (let j = 0; j <= resolution; j++) {
      const delta = points[i + 1].x - points[i].x
      const t = points[i].x + (delta / resolution) * j
      const deltaX = t - points[i].x
      const interpolatedY = points[i].y + b[i] * deltaX + c[i] * deltaX ** 2 + d[i] * deltaX ** 3
      curve.push(new Point(t, interpolatedY))
    }
  }

  return curve
}
*/
