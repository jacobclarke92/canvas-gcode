import Point from '../Point'
import { Line } from '../types'
import { sign } from './numberUtils'

export const linesIntersect = (line1: Line, line2: Line): boolean => {
  const [a1, a2] = line1
  const [b1, b2] = line2

  const denominator = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y)
  if (denominator === 0) return false

  const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denominator
  const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denominator

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
}

export const getLineIntersectionPoint = (line1: Line, line2: Line): Point | null => {
  const [l1p1, l1p2] = line1
  const [l2p1, l2p2] = line2

  const denominator = (l2p2.y - l2p1.y) * (l1p2.x - l1p1.x) - (l2p2.x - l2p1.x) * (l1p2.y - l1p1.y)
  if (denominator === 0) return null

  const ua = ((l2p2.x - l2p1.x) * (l1p1.y - l2p1.y) - (l2p2.y - l2p1.y) * (l1p1.x - l2p1.x)) / denominator
  const ub = ((l1p2.x - l1p1.x) * (l1p1.y - l2p1.y) - (l1p2.y - l1p1.y) * (l1p1.x - l2p1.x)) / denominator

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    const x = l1p1.x + ua * (l1p2.x - l1p1.x)
    const y = l1p1.y + ua * (l1p2.y - l1p1.y)
    return new Point(x, y)
  }

  return null
}

export const getLineIntersectionPoints = (line: Line, ...lines: Line[]) => {
  const pointsAndLines: [Point, Line][] = []
  for (const l of lines) {
    const pt = getLineIntersectionPoint(line, l)
    if (pt) pointsAndLines.push([pt, l])
  }
  return pointsAndLines
}

export const getClosestPoint = (pt: Point, ...pts: [Point] | Point[]): Point => {
  let closestPt = pt
  let closestDist = Infinity
  for (let i = 0; i < pts.length; i++) {
    const dist = pt.distanceTo(pts[i])
    if (dist < closestDist) {
      closestPt = pts[i]
      closestDist = dist
    }
  }
  return closestPt
}

export const lineIntersectsCircle = ([p1, p2]: Line, pt: Point, radius: number) => {
  let x1 = p1.clone().subtract(pt)
  let x2 = p2.clone().subtract(pt)

  let dv = x2.clone().subtract(x1)
  let dr = dv.magnitude()
  let D = x1.x * x2.y - x2.x * x1.y

  // evaluate if there is an intersection
  let di = radius * radius * dr * dr - D * D
  if (di < 0.0) return false

  return true
}

export const getPointsWhereLineIntersectsCircle = ([p1, p2]: Line, pt: Point, radius: number) => {
  let x1 = p1.clone().subtract(pt)
  let x2 = p2.clone().subtract(pt)

  let dv = x2.clone().subtract(x1)
  let dr = dv.magnitude()
  let D = x1.x * x2.y - x2.x * x1.y

  // evaluate if there is an intersection
  let di = radius * radius * dr * dr - D * D
  if (di < 0.0) return []

  let t = Math.sqrt(di)

  const intersectionPoints: Point[] = []
  intersectionPoints.push(
    new Point(D * dv.y + sign(dv.y) * dv.x * t, -D * dv.x + Math.abs(dv.y) * t).divide(dr * dr).add(pt)
  )
  if (di > 0.0) {
    intersectionPoints.push(
      new Point(D * dv.y - sign(dv.y) * dv.x * t, -D * dv.x - Math.abs(dv.y) * t).divide(dr * dr).add(pt)
    )
  }
  return intersectionPoints
}