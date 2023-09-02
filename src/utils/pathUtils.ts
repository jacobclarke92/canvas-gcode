import Point from '../Point'
import type { Edge } from '../types'

export const EPSILON = 0.000001

// Convert start+end angle arc to start/end points.
export const arcToPoints = (x: number, y: number, aStart: number, aEnd: number, radiusX: number, radiusY?: number) => {
  if (radiusY === undefined) radiusY = radiusX
  aStart = aStart % (Math.PI * 2)
  aEnd = aEnd % (Math.PI * 2)
  return {
    start: new Point(radiusX * Math.cos(aStart) + x, radiusX * Math.sin(aStart) + y),
    end: new Point(radiusY * Math.cos(aEnd) + x, radiusY * Math.sin(aEnd) + y),
  }
}

export const lineToPoints = (
  ...args:
    | [pt1: Point, pt2: Point, divisions: number]
    | [x1: number, y1: number, x2: number, y2: number, divisions: number]
) => {
  const pt1 = args.length === 3 ? args[0] : new Point(args[0], args[1])
  const pt2 = args.length === 3 ? args[1] : new Point(args[2], args[3])
  const divisions = args.length === 3 ? args[2] : args[4]

  const angle = pt1.angleTo(pt2)
  const dist = pt1.distanceTo(pt2)

  const points = []

  for (let i = 1; i < divisions + 1; i++) {
    const pt = pt1.clone().moveAlongAngle(angle, (dist / (divisions + 1)) * i)
    points.push(pt)
  }

  return points
}

export const ellipseToPoints = (
  ...args:
    | [
        center: Point,
        radiusX: number,
        radiusY: number,
        startAngle: number,
        endAngle: number,
        antiClockwise: boolean,
        divisions: number
      ]
    | [
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
        startAngle: number,
        endAngle: number,
        antiClockwise: boolean,
        divisions: number
      ]
) => {
  const centerX = args.length === 7 ? args[0].x : args[0]
  const centerY = args.length === 7 ? args[0].y : args[1]
  const radiusX = args.length === 7 ? args[1] : args[2]
  const radiusY = args.length === 7 ? args[2] : args[3]
  const startAngle = args.length === 7 ? args[3] : args[4]
  const endAngle = args.length === 7 ? args[4] : args[5]
  const antiClockwise = args.length === 7 ? args[5] : args[6]
  const divisions = args.length === 7 ? args[6] : args[7]

  const points: Point[] = []

  let j: number,
    t: number,
    angle: number,
    deltaAngle = endAngle - startAngle

  for (j = 0; j <= divisions; j++) {
    t = j / divisions

    if (deltaAngle === -Math.PI * 2) deltaAngle = Math.PI * 2
    if (deltaAngle < 0) deltaAngle += Math.PI * 2
    if (deltaAngle > Math.PI * 2) deltaAngle -= Math.PI * 2

    if (antiClockwise) {
      // sin(pi) and sin(0) are the same
      // So we have to special case for full circles
      if (deltaAngle === Math.PI * 2) deltaAngle = 0
      angle = endAngle + (1 - t) * (Math.PI * 2 - deltaAngle)
    } else {
      angle = startAngle + t * deltaAngle
    }

    const tx = centerX + radiusX * Math.cos(angle)
    const ty = centerY + radiusY * Math.sin(angle)

    points.push(new Point(tx, ty))
  }

  return points
}

export const circleToPoints = (
  ...args:
    | [center: Point, radius: number, divisions: number]
    | [centerX: number, centerY: number, radius: number, divisions: number]
) => {
  const centerX = args.length === 3 ? args[0].x : args[0]
  const centerY = args.length === 3 ? args[0].y : args[1]
  const radius = args.length === 3 ? args[1] : args[2]
  const divisions = args.length === 3 ? args[2] : args[3]
  return ellipseToPoints(centerX, centerY, radius, radius, 0, Math.PI * 2, false, divisions)
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

export const samePos = (a: Point, b: Point, epsilon = EPSILON): boolean => {
  return sameFloat(a.x, b.x, epsilon) && sameFloat(a.y, b.y, epsilon) // && sameFloat(a.z, b.z) && sameFloat(a.a, b.a)
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
