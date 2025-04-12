import { deg360 } from '../constants/angles'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { Line, LooseLine } from '../types'
import { sign } from './numberUtils'

export type Circle = [point: Point, radius: number]
export type Bounds = [top: number, right: number, bottom: number, left: number]

/**
 * ---------------
 * General utils
 * ---------------
 */

export const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
export const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b

export const mod = (a: number, n: number) => a - Math.floor(a / n) * n

/**
 * ---------------
 * Angle utils
 * ---------------
 */

export const radToDeg = (rad: number): number => (rad * 180) / Math.PI
export const degToRad = (deg: number): number => (deg * Math.PI) / 180

// https://stackoverflow.com/a/1878936/13326984
// export const smallestSignedAngleDiff = (angle1: number, angle2: number): number => {
//   const TAU = deg360
//   const a = mod(angle1 - angle2, TAU)
//   const b = mod(angle2 - angle1, TAU)
//   return a < b ? -a : b
// }

export const smallestSignedAngleDiff = (angle1: number, angle2: number): number => {
  let diff = Math.abs(angle1 - angle2) % deg360
  if (diff > Math.PI) diff = deg360 - diff
  return diff
}

export const normalizeAngle = (angle: number) => {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

/**
 * ---------------
 * Point utils
 * ---------------
 */

export const getMidPt = (...pts: Point[]): Point =>
  pts.reduce((acc, pt) => acc.add(pt), new Point(0, 0)).divide(pts.length)

export const getDistancesToPoint = (pt: Point, ...pts: [Point] | Point[]): [Point, number][] =>
  pts.map((p) => [p, pt.distanceTo(p)])

export const getClosestPoint = (pt: Point, ...pts: [Point] | Point[]): Point =>
  getDistancesToPoint(pt, ...pts).sort((a, b) => a[1] - b[1])[0][0]

export const getClosestButNotSamePoint = (pt: Point, ...pts: [Point] | Point[]): Point | null => {
  if (!pts.length) throw new Error('No points to compare')
  const ptsWithDist = getDistancesToPoint(pt, ...pts)
    .sort((a, b) => a[1] - b[1])
    .filter((p) => p[1] > 0.0001)
  if (!ptsWithDist.length) return null
  return ptsWithDist[0][0]
}

export const getLeftmostPoint = (...pts: Point[]): Point =>
  pts.reduce((acc, pt) => (pt.x < acc.x ? pt : acc))

export const getRightmostPoint = (...pts: Point[]): Point =>
  pts.reduce((acc, pt) => (pt.x > acc.x ? pt : acc))

export const getTopmostPoint = (...pts: Point[]): Point =>
  pts.reduce((acc, pt) => (pt.y < acc.y ? pt : acc))

export const getBottommostPoint = (...pts: Point[]): Point =>
  pts.reduce((acc, pt) => (pt.y > acc.y ? pt : acc))

/** Orders points in clockwise direction starting from the topmost point */
export const orderPointsClockwise = (points: Point[]): Point[] => {
  const center = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length,
    }),
    { x: 0, y: 0 }
  )

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x)
    const angleB = Math.atan2(b.y - center.y, b.x - center.x)
    return angleA - angleB
  })
}

export const cyclePointsToStartWith = (startingPt: Point, points: Point[]) => {
  const index = points.indexOf(startingPt)
  if (index < 0) {
    console.warn('[reorderPointsStartingWith] pt not found in array')
    return points
  }
  return [...points.slice(index), ...points.slice(0, index)]
}

export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  const { x: px, y: py } = point
  let isInside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: x1, y: y1 } = polygon[i]
    const { x: x2, y: y2 } = polygon[j]

    const intersect = y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1

    if (intersect) isInside = !isInside
  }

  return isInside
}

/**
 * ---------------
 * Line utils
 * ---------------
 */

export const pointsToLines = (points: Point[], unclosed = false): Line[] => {
  const lines: Line[] = []
  for (let i = 0; i < points.length - 1; i++) {
    lines.push([points[i], points[i + 1]])
  }
  if (unclosed) {
    lines.push([points[points.length - 1], points[0]])
  }
  return lines
}

export const trimLineToIntersectionPoints = (line: Line, lines: Line[]): Line => {
  const intersectionPoints = getLineIntersectionPoints(line, ...lines)
  if (intersectionPoints.length > 2) console.log('more than 2 intersection points')
  else if (intersectionPoints.length < 2) return line
  return [intersectionPoints[0][0], intersectionPoints[1][0]]
}

export const linesIntersect = (line1: LooseLine, line2: LooseLine): boolean => {
  const [a1, a2] = line1
  const [b1, b2] = line2

  const denominator = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y)
  if (denominator === 0) return false

  const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denominator
  const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denominator

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
}

export const lineIntersectsWithAny = (line: LooseLine, ...lines: LooseLine[]): boolean => {
  for (const l of lines) {
    if (linesIntersect(line, l)) return true
  }
  return false
}

export const getLineIntersectionPoint = (line1: LooseLine, line2: LooseLine): Point | null => {
  const [l1p1, l1p2] = line1
  const [l2p1, l2p2] = line2

  const denominator = (l2p2.y - l2p1.y) * (l1p2.x - l1p1.x) - (l2p2.x - l2p1.x) * (l1p2.y - l1p1.y)
  if (denominator === 0) return null

  const ua =
    ((l2p2.x - l2p1.x) * (l1p1.y - l2p1.y) - (l2p2.y - l2p1.y) * (l1p1.x - l2p1.x)) / denominator
  const ub =
    ((l1p2.x - l1p1.x) * (l1p1.y - l2p1.y) - (l1p2.y - l1p1.y) * (l1p1.x - l2p1.x)) / denominator

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    const x = l1p1.x + ua * (l1p2.x - l1p1.x)
    const y = l1p1.y + ua * (l1p2.y - l1p1.y)
    return new Point(x, y)
  }

  return null
}

export const getLineIntersectionPoints = <LineType extends Line | [IntPoint, IntPoint]>(
  line: LineType,
  ...lines: LineType[]
): [Point, LineType][] => {
  const pointsAndLines: [Point, LineType][] = []
  for (const l of lines) {
    const pt = getLineIntersectionPoint(line, l)
    if (pt) pointsAndLines.push([pt, l])
  }
  return pointsAndLines
}

/**
 * ---------------
 * Triangle utils
 * ---------------
 */

/** Determines if a point lies inside a triangle using barycentric coordinates */
export const isPointInTriangle = (point: Point, v1: Point, v2: Point, v3: Point): boolean => {
  const denominator = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y)

  const a = ((v2.y - v3.y) * (point.x - v3.x) + (v3.x - v2.x) * (point.y - v3.y)) / denominator
  const b = ((v3.y - v1.y) * (point.x - v3.x) + (v1.x - v3.x) * (point.y - v3.y)) / denominator
  const c = 1 - a - b

  // If all coordinates are between 0 and 1, the point is inside the triangle
  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1
}

/**
 * ---------------
 * Rectangle (quadrilateral) utils
 * ---------------
 */

/**
 * Liang-Barsky function by Daniel White
 * http://www.skytopia.com/project/articles/compsci/clipping.html
 */
export const getPointsWhereLineIntersectsRectangle = (
  [p1, p2]: Line,
  bounds: Bounds
): [Point, Point] => {
  const [ymin, xmax, ymax, xmin] = bounds
  let t0 = 0
  let t1 = 1
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  let p: number, q: number, r: number

  for (let edge = 0; edge < 4; edge++) {
    // Traverse through left, right, bottom, top edges.
    if (edge === 0) {
      p = -dx
      q = -(xmin - p1.x)
    }
    if (edge === 1) {
      p = dx
      q = xmax - p1.x
    }
    if (edge === 2) {
      p = -dy
      q = -(ymin - p1.y)
    }
    if (edge === 3) {
      p = dy
      q = ymax - p1.y
    }

    r = q / p

    if (p === 0 && q < 0) return null // Don't draw line at all. (parallel line outside)

    if (p < 0) {
      if (r > t1) return null // Don't draw line at all.
      else if (r > t0) t0 = r // Line is clipped!
    } else if (p > 0) {
      if (r < t0) return null // Don't draw line at all.
      else if (r < t1) t1 = r // Line is clipped!
    }
  }

  return [
    //
    new Point(p1.x + t0 * dx, p1.y + t0 * dy),
    new Point(p1.x + t1 * dx, p1.y + t1 * dy),
  ]
}

export const isPointInQuadrilateral = (point: Point, quad: Point[]): boolean => {
  if (quad.length !== 4) throw new Error('Quadrilateral must be defined by exactly 4 points')

  const sortedPoints = orderPointsClockwise(quad)

  // Ray casting algorithm
  let inside = false
  for (let i = 0, j = sortedPoints.length - 1; i < sortedPoints.length; j = i++) {
    const xi = sortedPoints[i].x
    const yi = sortedPoints[i].y
    const xj = sortedPoints[j].x
    const yj = sortedPoints[j].y

    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}
export const isPointInRectangle = isPointInQuadrilateral

/**
 * ---------------
 * Circle utils
 * ---------------
 */

export const lineIntersectsCircle = ([p1, p2]: Line, pt: Point, radius: number): boolean => {
  const x1 = p1.clone().subtract(pt)
  const x2 = p2.clone().subtract(pt)

  const dv = x2.clone().subtract(x1)
  const dr = dv.magnitude()
  const D = x1.x * x2.y - x2.x * x1.y

  // evaluate if there is an intersection
  const di = radius * radius * dr * dr - D * D
  if (di < 0.0) return false

  return true
}

export const lineIntersectsCircles = (
  [p1, p2]: Line,
  ...circles: [pos: Point, rad: number][]
): boolean => {
  for (const [pos, rad] of circles) {
    if (lineIntersectsCircle([p1, p2], pos, rad)) return true
  }
  return false
}

export const getPointsWhereLineIntersectsCircle = (
  [p1, p2]: Line,
  pt: Point,
  radius: number
): Point[] | [] => {
  const x1 = p1.clone().subtract(pt)
  const x2 = p2.clone().subtract(pt)

  const dv = x2.clone().subtract(x1)
  const dr = dv.magnitude()
  const D = x1.x * x2.y - x2.x * x1.y

  // evaluate if there is an intersection
  const di = radius * radius * dr * dr - D * D
  if (di < 0.0) return []

  const t = Math.sqrt(di)

  const intersectionPoints: Point[] = []
  intersectionPoints.push(
    new Point(D * dv.y + sign(dv.y) * dv.x * t, -D * dv.x + Math.abs(dv.y) * t)
      .divide(dr * dr)
      .add(pt)
  )
  if (di > 0.0) {
    intersectionPoints.push(
      new Point(D * dv.y - sign(dv.y) * dv.x * t, -D * dv.x - Math.abs(dv.y) * t)
        .divide(dr * dr)
        .add(pt)
    )
  }
  return intersectionPoints
}

export const pointInCircle = (pt: Point, circlePos: Point, radius: number): boolean =>
  pt.distanceTo(circlePos) < radius

export const pointInCircles = (pt: Point, ...circles: [pos: Point, rad: number][]): boolean => {
  for (const [pos, rad] of circles) {
    if (pointInCircle(pt, pos, rad)) return true
  }
  return false
}

export const circleOverlapsCircle = (
  [circle1Pos, circle1Rad]: [Point, number],
  [circle2Pos, circle2Rad]: [Point, number]
): boolean => circle1Pos.distanceTo(circle2Pos) < circle1Rad + circle2Rad

export const circleOverlapsCircles = (
  [circlePos, circleRad]: [Point, number],
  ...circles: [pos: Point, rad: number][]
): boolean => {
  for (const [pos, rad] of circles) {
    if (circleOverlapsCircle([circlePos, circleRad], [pos, rad])) return true
  }
  return false
}

export const getCircleCircleIntersectionPoints = (
  [circle1Pos, circle1Rad]: [Point, number],
  [circle2Pos, circle2Rad]: [Point, number]
): Point[] | [] => {
  const d = circle1Pos.distanceTo(circle2Pos)
  if (d > circle1Rad + circle2Rad || d < Math.abs(circle1Rad - circle2Rad)) return []

  const a = (circle1Rad * circle1Rad - circle2Rad * circle2Rad + d * d) / (2 * d)
  const h = Math.sqrt(circle1Rad * circle1Rad - a * a)

  const p2 = circle1Pos
    .clone()
    .subtract(circle2Pos)
    .multiply(a / d)
    .add(circle2Pos)
  const x3 = (h * (circle2Pos.y - circle1Pos.y)) / d
  const y3 = (h * (circle2Pos.x - circle1Pos.x)) / d

  return [new Point(p2.x + x3, p2.y - y3), new Point(p2.x - x3, p2.y + y3)]
}

/**
 * ---------------
 * Boundary utils
 * ---------------
 */

export const boundsOverlap = (bound1: Bounds, bound2: Bounds): boolean => {
  const [top1, right1, bottom1, left1] = bound1
  const [top2, right2, bottom2, left2] = bound2
  if (top2 > bottom1 || top1 > bottom2) return false
  if (left2 > right1 || left1 > right2) return false
  return true
}

export const boundsOverlapAny = (bound: Bounds, ...bounds: Bounds[]): boolean => {
  for (const boundCheck of bounds) {
    if (boundsOverlap(bound, boundCheck)) return true
  }
  return false
}

export const isInBounds = (pt: Point, bounds: Bounds, gutter = 0): boolean => {
  const top = bounds[0] + gutter
  const right = bounds[1] - gutter
  const bottom = bounds[2] - gutter
  const left = bounds[3] + gutter
  return pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom
}

export const getBoundsFromCircles = (
  ...circles: [pos: Point, rad: number][]
): [top: number, right: number, bottom: number, left: number] => {
  const xs: number[] = []
  const ys: number[] = []
  for (const [pos, rad] of circles) {
    xs.push(pos.x - rad)
    xs.push(pos.x + rad)
    ys.push(pos.y - rad)
    ys.push(pos.y + rad)
  }
  return [Math.min(...ys), Math.max(...xs), Math.max(...ys), Math.min(...xs)]
}

export const getBoundsFromPath = (path: Point[]): Bounds => {
  if (!path.length) throw new Error('Path is empty')
  const xs = path.map((p) => p.x)
  const ys = path.map((p) => p.y)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  const left = Math.min(...xs)
  return [top, right, bottom, left]
}

/**
 * ---------------
 * Curve utils
 * ---------------
 */

export const getBezierPoint = (
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  t: number
): Point => {
  const oneMinusT = 1 - t
  const oneMinusTSquared = oneMinusT * oneMinusT
  const oneMinusTCubed = oneMinusTSquared * oneMinusT
  const tSquared = t * t
  const tCubed = tSquared * t

  const x =
    oneMinusTCubed * start.x +
    3 * oneMinusTSquared * t * control1.x +
    3 * oneMinusT * tSquared * control2.x +
    tCubed * end.x

  const y =
    oneMinusTCubed * start.y +
    3 * oneMinusTSquared * t * control1.y +
    3 * oneMinusT * tSquared * control2.y +
    tCubed * end.y

  return new Point(x, y)
}

export const getBezierPoints = (
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  numPoints: number
): Point[] => {
  const points: Point[] = []
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints
    points.push(getBezierPoint(start, control1, control2, end, t))
  }
  return points
}

/** @deprecated This is some LLM generated garbage that infinitely recurses */
export const getContinuousBezierApproximation = (
  controlPoints: Point[],
  outputSegmentCount: number
): Point[] => {
  return Array.from({ length: outputSegmentCount + 1 }, (_, i) => {
    const t = i / outputSegmentCount
    return getContinuousBezierPoint(t, controlPoints, 0, controlPoints.length)
  })
}

/** @deprecated This is some LLM generated garbage that infinitely recurses */
export const getContinuousBezierPoint = (
  t: number,
  controlPoints: Point[],
  index: number,
  count: number
): Point => {
  if (count == 1) return controlPoints[index]
  const P0 = getContinuousBezierPoint(t, controlPoints, index, count - 1)
  const P1 = getContinuousBezierPoint(t, controlPoints, index + 1, count - 1)
  return new Point((1 - t) * P0.x + t * P1.x, (1 - t) * P0.y + t * P1.y)
}

export const getTangentsToCircle = (pt: Point, circlePt: Point, radius: number): [Point, Point] => {
  const relativePt = circlePt.clone().subtract(pt)
  const distance = relativePt.magnitude()
  const angle = Math.asin(radius / distance)
  const angleToPt = Math.atan2(relativePt.y, relativePt.x)

  const tangentAngle1 = angleToPt - angle
  const tangentAngle2 = angleToPt + angle

  const tangent1 = new Point(
    radius * Math.sin(tangentAngle1),
    radius * -Math.cos(tangentAngle1)
  ).add(circlePt)
  const tangent2 = new Point(
    radius * -Math.sin(tangentAngle2),
    radius * Math.cos(tangentAngle2)
  ).add(circlePt)
  return [tangent1, tangent2]
}

function getArcRange(arc: [start: number, end: number]) {
  const start = normalizeAngle(arc[0])
  const end = normalizeAngle(arc[1])

  if (start > end) {
    // Arc wraps around the -π to π transition
    return [
      { angle: start, type: 'start' },
      { angle: Math.PI, type: 'end' },
      { angle: -Math.PI, type: 'start' },
      { angle: end, type: 'end' },
    ]
  } else {
    return [
      { angle: start, type: 'start' },
      { angle: end, type: 'end' },
    ]
  }
}

/**
 * Ensure the arc start and end points are the right way around!
 */
export function arcsOverlap(
  arc1: [start: number, end: number],
  arc2: [start: number, end: number]
): { overlaps: boolean; skew: 'left' | 'right' | null } {
  const arc1Ranges = getArcRange(arc1)
  const arc2Ranges = getArcRange(arc2)

  let overlapFound = false
  let leftOverlap = false
  let rightOverlap = false

  for (let i = 0; i < arc1Ranges.length; i++) {
    const aStart = arc1Ranges[i]
    for (let j = 0; j < arc2Ranges.length; j++) {
      const bStart = arc2Ranges[j]

      if (aStart.type === 'start' && bStart.type === 'start') continue // Ignore start vs start
      if (aStart.type === 'end' && bStart.type === 'end') continue // Ignore end vs end

      const nextA = arc1Ranges[i + 1] || arc1Ranges[i]
      const nextB = arc2Ranges[j + 1] || arc2Ranges[j]

      if (
        (aStart.angle <= bStart.angle && nextA.angle >= bStart.angle) ||
        (bStart.angle <= aStart.angle && nextB.angle >= aStart.angle)
      ) {
        overlapFound = true
        if (aStart.angle < bStart.angle) {
          leftOverlap = true // Arc1 starts before Arc2
        } else {
          rightOverlap = true // Arc2 starts before Arc1
        }
      }
    }
  }

  if (!overlapFound) {
    return { overlaps: false, skew: null }
  }

  if (leftOverlap && rightOverlap) {
    return { overlaps: true, skew: null }
  } else if (leftOverlap) {
    return { overlaps: true, skew: 'left' }
  } else if (rightOverlap) {
    return { overlaps: true, skew: 'right' }
  }
}
