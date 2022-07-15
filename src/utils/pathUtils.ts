import Point from '../Point'
import { Edge } from '../types'

export const EPSILON = 0.000001

// Convert start+end angle arc to start/end points.
export const arcToPoints = (x: number, y: number, aStart: number, aEnd: number, radius: number) => {
  aStart = aStart % (Math.PI * 2)
  aEnd = aEnd % (Math.PI * 2)
  return {
    start: new Point(radius * Math.cos(aStart) + x, radius * Math.sin(aStart) + y),
    end: new Point(radius * Math.cos(aEnd) + x, radius * Math.sin(aEnd) + y),
  }
}

// Convert start/end/center point arc to start/end angle arc.
export const pointsToArc = (center: Point, start: Point, end: Point) => {
  center = center.clone()
  start = start.clone()
  end = end.clone()

  const aStart = Math.atan2(start.y - center.y, start.x - center.x)
  let aEnd = Math.atan2(end.y - center.y, end.x - center.x)
  const radius = center.subtract(start).magnitude()

  // Always assume a full circle if they are the same
  // Handling of 0,0 optimized in the usage
  if (aEnd === aStart) aEnd += Math.PI * 2

  return { start: aStart, end: aEnd, radius }
}

/**
 * Given an angle in radians, will return an equivalent angle between [-pi, pi]
 * We have to work around Javascript's STUPID modulo bug: -2 % 3 is not -2, it is 1.
 * That's why we're calling modulo twice.
 **/
export const normalizeAngle = (angle: number): number =>
  ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI

export const sameFloat = (a: number, b: number, epsilon = EPSILON): boolean => {
  if (Math.abs(a - b) < EPSILON) return true

  const absA = Math.abs(a)
  const absB = Math.abs(b)
  const diff = Math.abs(a - b)

  // shortcut, handles infinities
  if (a == b) return true

  // a or b is zero or both are extremely close to it
  // relative error is less meaningful here
  if (a === 0 || b === 0 || diff < Number.MIN_VALUE) return diff < epsilon * Number.MIN_VALUE

  // use relative error
  return diff / (absA + absB) < epsilon
}

export const samePos = (a: Point, b: Point): boolean => {
  return sameFloat(a.x, b.x) && sameFloat(a.y, b.y) // && sameFloat(a.z, b.z) && sameFloat(a.a, b.a)
}

export const convertPointsToEdges = (pts: Point[]): Edge[] => {
  if (!samePos(pts[0], pts[pts.length - 1])) {
    throw new Error(`convertPointsToEdges: provided points aren't self-closing!`)
  }
  const edges: Edge[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    edges.push([pts[i - 1], pts[i]])
  }
  return edges
}
