import { JoinType } from 'js-angusj-clipper/web'

import type GCanvas from '../GCanvas'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import {
  cyclePointsToStartWith,
  getBottommostPoint,
  getBoundsFromPath,
  getLeftmostPoint,
  getLineIntersectionPoints,
  getRightmostPoint,
  isPointInPolygon,
  pointsToLines,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import { generateSplineWithEnds } from '../utils/splineUtils'
import { relaxSites, sortEdges } from '../utils/voronoiUtils'
import type { BoundingBox, Diagram, Edge, Site } from '../Voronoi'
import { Voronoi } from '../Voronoi'

const ip2p = (ip: IntPoint) => new Point(ip.x, ip.y)
const getPtAtPercent = <Pt extends Point | IntPoint>(
  pts: Pt[],
  percent: number
): [pt: Pt, index: number] => {
  const index = Math.floor(pts.length * percent)
  return [pts[index], index]
}

class Butterfly {
  sketch: Sketch
  ctx: GCanvas
  pt: Point
  scale = 1
  droops = 0
  constructor(opts: {
    sketch: Sketch
    /** Head position */
    pt: Point
    scale?: number
    droops?: number
  }) {
    this.sketch = opts.sketch
    this.ctx = opts.sketch.ctx
    this.pt = opts.pt
    if (opts.scale) this.scale = opts.scale
    if (opts.droops) this.droops = opts.droops
    //
  }

  get vars() {
    return this.sketch.vars
  }

  draw() {
    const headSplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 1.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 1.7 * this.scale),
      new Point(this.pt.x + 1 * this.scale, this.pt.y - 2 * this.scale),
      new Point(this.pt.x - 1 * this.scale, this.pt.y - 2 * this.scale),
    ])
    const bodySplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 2.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 2.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 9.5 * this.scale),
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 9.5 * this.scale),
    ])
    const thoraxSplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.2 * this.scale, this.pt.y + 12 * this.scale),
      new Point(this.pt.x + 1.2 * this.scale, this.pt.y + 12 * this.scale),
      new Point(this.pt.x + 1.2 * this.scale, this.pt.y + 26 * this.scale),
      new Point(this.pt.x - 1.2 * this.scale, this.pt.y + 26 * this.scale),
    ])

    const [headTopRight] = getPtAtPercent(headSplinePts, 0.5)
    const [headTopLeft] = getPtAtPercent(headSplinePts, 0.75)
    const [bodyStartRight, bodyStartRightIndex] = getPtAtPercent(bodySplinePts, 0.32)
    const [bodyEndRight, bodyEndRightIndex] = getPtAtPercent(bodySplinePts, 0.42)
    const [bodyStartLeft] = getPtAtPercent(bodySplinePts, 0.94)
    // const [bodyEndLeft] = getPtAtPercent(bodySplinePts, 0.84)
    const [thoraxStartRight, thoraxStartRightIndex] = getPtAtPercent(thoraxSplinePts, 0.2)
    const [thoraxEndRight, thoraxEndRightIndex] = getPtAtPercent(thoraxSplinePts, 0.55)
    // const [thoraxEndLeft] = getPtAtPercent(thoraxSplinePts, 0.7)

    // debugDots(this.ctx, [
    //   headTopRight,
    //   headTopLeft,
    //   bodyStartRight,
    //   bodyEndRight,
    //   bodyStartLeft,
    //   bodyEndLeft,
    //   thoraxStartRight,
    //   thoraxEndRight,
    //   thoraxEndLeft,
    // ])

    this.drawAntenna(ip2p(headTopLeft), ip2p(headTopRight))

    /**
     * Generate top right wing from simplified shape
     */
    const topWingSplinePts = this.ctx.strokeSmoothPath(
      [
        ip2p(bodyStartRight),
        ip2p(bodyStartRight).add((10 + randFloat(2)) * this.scale, -2 * this.scale),
        ip2p(bodyStartRight).add(
          (40 + randFloat(25)) * this.scale,
          randFloatRange(-5, -15) * this.scale
        ),
        ip2p(bodyStartRight).add((60 + randFloat(5)) * this.scale, 5 * this.scale),
        ip2p(bodyStartRight).add((40 + randFloat(5)) * this.scale, 25 * this.scale),
        ip2p(bodyEndRight),
      ],
      { debug: false }
    )

    const topWingClosedPts = [
      ...bodySplinePts.slice(bodyStartRightIndex, bodyEndRightIndex + 1).reverse(),
      ...topWingSplinePts,
    ].map(ip2p)

    this.drawWingPart(topWingClosedPts)

    /**
     * Generate bottom right wing from simplified shape
     * 1st pass - to generate an initial shape first
     */
    const [topWingJoinPt, topWingJoinIndex] = getPtAtPercent(topWingSplinePts, 0.8)

    const bottomWingFarRightPt = ip2p(topWingJoinPt)
      .clone()
      .moveAlongAngle(ip2p(bodyEndRight).angleTo(ip2p(topWingJoinPt)), 15 * this.scale)
      .add(0, 2 * this.scale)

    let bottomWingPts: (Point | IntPoint)[] = [
      ip2p(topWingJoinPt),
      bottomWingFarRightPt,
      ip2p(topWingJoinPt).add(10 * this.scale, randFloatRange(30, 20) * this.scale),
      ip2p(topWingJoinPt).add(-15 * this.scale, randFloatRange(45, 35) * this.scale),
      // ip2p(thoraxEndRight).moveAlongAngle(randFloatRange(Math.PI * 0.45, Math.PI * 0.3), 20 * this.scale),
      ip2p(thoraxEndRight),
    ]

    const initialBottomWingSplinePts = generateSplineWithEnds(bottomWingPts)
    // const initialBottomWingSplinePts = this.ctx.strokeSmoothPath(bottomWingPts, {
    //   debug: true,
    //   debugColor: 'yellow',
    // })

    /** 2nd pass - to generate a more detailed shape with 'droops' */

    const droopIndexes: number[] = []
    const indexRangeMin = randFloatRange(0.5, 0.4)
    const indexRangeMax = randFloatRange(0.9, 0.8)
    const indexRange = indexRangeMax - indexRangeMin
    const indexRangeSeg = indexRange / (this.droops + 1)
    for (let i = 0; i < this.droops; i++) {
      const index = Math.floor(
        initialBottomWingSplinePts.length * (indexRangeMin + indexRangeSeg / 2 + indexRangeSeg * i)
      )
      droopIndexes.push(index)
    }

    bottomWingPts = [
      ...bottomWingPts.slice(0, 2),
      // initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMin)],
      ...droopIndexes.flatMap((index) => {
        const pt1 = ip2p(initialBottomWingSplinePts[index - 1])
        let pt2 = ip2p(initialBottomWingSplinePts[index + 1])
        let gapDist = pt1.distanceTo(pt2)
        if (gapDist * this.scale < 3) {
          pt2 = ip2p(initialBottomWingSplinePts[index + 3])
          gapDist = pt1.distanceTo(pt2)
        }
        let adjacentAngle = Math.atan2(pt1.y - pt2.y, pt1.x - pt2.x) + Math.PI / 2
        adjacentAngle += (Math.PI / 2 - adjacentAngle) / 2 // orient downwards a bit
        const droopDist = randFloatRange(25, 15) * this.scale
        const droopPt = ip2p(initialBottomWingSplinePts[index]).moveAlongAngle(
          adjacentAngle,
          droopDist
        )
        return [
          pt1,
          // pt1.clone().moveTowards(droopPt, droopDist / 2),
          droopPt.clone().moveAlongAngle(adjacentAngle - Math.PI / 2, gapDist / 6),
          droopPt.clone().moveAlongAngle(adjacentAngle + Math.PI / 2, gapDist / 6),
          // pt2.clone().moveTowards(droopPt, droopDist / 2),
          pt2,
        ]
      }),
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMax)],
      ...bottomWingPts.slice(4),
    ]

    const bottomWingSplinePts = this.ctx.strokeSmoothPath(bottomWingPts, { debug: false })

    const bottomWingClosedPts = [
      ...topWingSplinePts.slice(topWingJoinIndex).reverse(),
      ...thoraxSplinePts.slice(topWingJoinIndex, thoraxEndRightIndex + 1).reverse(),
      ...bottomWingSplinePts,
      ...thoraxSplinePts.slice(thoraxStartRightIndex, thoraxEndRightIndex).reverse(),
    ].map(ip2p)

    /**
     * Draw the bottom wing shape
     */

    this.drawWingPart(bottomWingClosedPts)

    /** Draw outlines! */

    this.ctx.beginPath()
    for (let i = 0; i < topWingSplinePts.length; i++) {
      const pt = topWingSplinePts[i]
      const x = bodyStartLeft.x - (pt.x - bodyStartRight.x)
      if (i === 0) this.ctx.moveTo(x, pt.y)
      else this.ctx.lineTo(x, pt.y)
    }
    this.ctx.stroke()

    this.ctx.beginPath()
    for (let i = 0; i < bottomWingSplinePts.length; i++) {
      const pt = bottomWingSplinePts[i]
      const x = bodyStartLeft.x - (pt.x - bodyStartRight.x)
      if (i === 0) this.ctx.moveTo(x, pt.y)
      else this.ctx.lineTo(x, pt.y)
    }
    this.ctx.stroke()
  }

  drawAntenna(leftPt: Point, rightPt: Point) {
    const length = randFloatRange(30, 15) * this.scale
    const leftAngle = randFloatRange(Math.PI * 0.3, Math.PI * 0.05)
    const rightAngle = randFloatRange(Math.PI * 0.3, Math.PI * 0.05)
    const leftEndPt = leftPt.clone().moveAlongAngle(-Math.PI / 2 + -leftAngle, length)
    const rightEndPt = rightPt.clone().moveAlongAngle(-Math.PI / 2 + rightAngle, length)
    this.ctx.beginPath()
    this.ctx.moveTo(leftPt.x, leftPt.y)
    this.ctx.quadraticCurveTo(leftPt.x, leftPt.y - length / 2, leftEndPt.x, leftEndPt.y)
    this.ctx.moveTo(rightPt.x, rightPt.y)
    this.ctx.quadraticCurveTo(rightPt.x, rightPt.y - length / 2, rightEndPt.x, rightEndPt.y)
    this.ctx.stroke()
  }

  drawWingPart(pts: Point[]) {
    let layers = 0
    pts = this.drawOffsets(pts)
    while (layers < this.vars.minWingLayers) {
      layers++
      if (!pts || !pts.length) break
      if (layers === this.vars.minWingLayers && random() > 0.25) {
        this.drawVoronoi(pts)
        break
      }
      const options = [this.drawOffsets, this.drawLadder, this.drawVoronoi]
      const index = Math.floor(random() * options.length)
      const result = options[index].call(this, pts)
      if (result) pts = result
      else break
    }
  }

  drawOffsets(pts: Point[]) {
    if (!pts || !pts.length) return []

    if (!this.vars.wingBorderIterations) return pts

    let offsetPath: Point[]
    let leftmostPt: Point
    const offsetAmount = this.vars.wingBorderWidth * this.scale
    for (let i = 0; i < this.vars.wingBorderIterations; i++) {
      offsetPath = this.ctx
        .offsetPath(offsetPath || pts, -offsetAmount, {
          joinType: JoinType.Round,
        })
        .sort((a, b) => b.length - a.length)[0]
      if (!offsetPath) continue
      offsetPath.forEach((pt) => pt.subtract(offsetAmount, offsetAmount / 2))
      leftmostPt = getLeftmostPoint(...offsetPath)
      offsetPath = cyclePointsToStartWith(leftmostPt, offsetPath)

      // debugDot(this.ctx, leftmostPt, 'red')
      this.ctx.beginPath()
      this.ctx.moveTo(offsetPath[0].x, offsetPath[0].y)
      for (let i = 1; i < offsetPath.length; i++) this.ctx.lineTo(offsetPath[i].x, offsetPath[i].y)
      this.ctx.lineTo(offsetPath[0].x, offsetPath[0].y)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    return offsetPath
  }

  drawLadder(pts: Point[]) {
    if (!pts || !pts.length) return []

    // Calculate pivot point for ladder lines
    const leftmostPt = getLeftmostPoint(...pts)
    const bottommostPt = getBottommostPoint(...pts)
    const rightmostPt = getRightmostPoint(...pts)
    rightmostPt.y += (bottommostPt.y - rightmostPt.y) * 0.5
    const pivotPt = rightmostPt
      .clone()
      .moveTowards(leftmostPt, rightmostPt.distanceTo(leftmostPt) * 0.8)
    // debugDot(this.ctx, pivotPt, 'green')

    // Get and draw offset path
    let offsetPath = this.ctx
      .offsetPath(pts, -5 * this.scale, { joinType: JoinType.Round })
      .sort((a, b) => a.length - b.length)[0]

    if (!offsetPath) return []

    const offsetLeftmostPt = getLeftmostPoint(...offsetPath)
    offsetPath = cyclePointsToStartWith(offsetLeftmostPt, offsetPath)

    const offsetDiff = offsetLeftmostPt.clone().subtract(leftmostPt.x, leftmostPt.y)
    offsetPath.forEach((pt) => pt.subtract(offsetDiff.x * 0.8, offsetDiff.y * 0.5))

    this.ctx.beginPath()
    this.ctx.moveTo(offsetPath[0].x, offsetPath[0].y)
    for (let i = 1; i < offsetPath.length; i++) this.ctx.lineTo(offsetPath[i].x, offsetPath[i].y)
    this.ctx.lineTo(offsetPath[0].x, offsetPath[0].y)
    this.ctx.stroke()

    const offsetRightmostPt = getRightmostPoint(...offsetPath)
    const offsetBottommostPt = getBottommostPoint(...offsetPath)
    const offsetRightmostPtIndex = offsetPath.indexOf(offsetRightmostPt)
    const offsetBottommostPtIndex = offsetPath.indexOf(offsetBottommostPt)

    // debugDot(this.ctx, offsetPath[0], 'blue') // leftmost -- cycled to start
    // debugDot(this.ctx, offsetRightmostPt, 'blue')
    // debugDot(this.ctx, offsetBottommostPt, 'blue')

    // const averagePos = getMidPt(...offsetPath)
    // debugDot(this.ctx, averagePos)

    // iterate through offset pts starting from rightmost and ending at bottommost

    const ptsAsLines = pointsToLines(pts)
    const startIndex = Math.min(offsetRightmostPtIndex, Math.floor(offsetPath.length * 0.5))
    for (let i = startIndex; i < offsetBottommostPtIndex; i += this.vars.ladderIndexSkip) {
      // const percent = i / offsetPath.length
      // const absolutePercent =
      //   (i - offsetRightmostPtIndex) / (offsetBottommostPtIndex - offsetRightmostPtIndex)
      // const percentSkew = lerp(-this.vars.ladderSkew, this.vars.ladderSkew, absolutePercent)
      // const pt1 = offsetPath[i]
      // const pt2 = pts[Math.floor(pts.length * (percent + percentSkew))]
      const pt1 = offsetPath[i]
      let pt2 = pt1.clone().moveAway(pivotPt, 50 * this.scale)
      const intersectPts = getLineIntersectionPoints([pt1, pt2], ...ptsAsLines)
      if (!intersectPts.length) continue
      pt2 = intersectPts[intersectPts.length - 1][0]
      this.ctx.beginPath()
      this.ctx.moveTo(pt1.x, pt1.y)
      this.ctx.lineTo(pt2.x, pt2.y)
      this.ctx.stroke()
    }

    return offsetPath
  }

  drawVoronoi(pts: Point[]): null {
    if (!pts || !pts.length) return null

    const voronoi = new Voronoi()
    let diagram: Diagram | null = null
    let sites: Site[] = []
    const [top, right, bottom, left] = getBoundsFromPath(pts)
    const boundingBox: BoundingBox = { top: 0, left: 0, width: right - left, height: bottom - top }
    for (let i = 0; i < this.vars.voronoiPts; i++) {
      const pt = new Point(
        randFloatRange(boundingBox.width, 0),
        randFloatRange(boundingBox.height, 0)
      )
      const absolutePt = pt.clone().add(left, top)
      if (isPointInPolygon(absolutePt, pts)) sites.push({ x: pt.x, y: pt.y })
    }

    const compute = (newSites: Site[]) => {
      sites = newSites
      voronoi.recycle(diagram)
      diagram = voronoi.compute(newSites, boundingBox)
    }

    compute(sites)

    for (let i = 0; i < this.vars.loosenIterations; i++) {
      const sites = relaxSites({
        diagram: diagram,
        apoptosisMitosis: this.vars.apoptosisMitosis,
        loosenStrength: this.vars.loosenStrength,
        loosenDistCutoff: this.vars.loosenDistCutoff,
      })
      compute(sites)
    }

    const voronoiEdges = sortEdges(diagram.edges)
    const shapeLines = pointsToLines(pts)
    let iEdge = voronoiEdges.length
    let edge: Edge
    this.ctx.beginPath()
    while (iEdge--) {
      edge = voronoiEdges[iEdge]
      let pt1 = new Point(left + edge.vertex1.x, top + edge.vertex1.y)
      let pt2 = new Point(left + edge.vertex2.x, top + edge.vertex2.y)
      const intersectionPts = getLineIntersectionPoints([pt1, pt2], ...shapeLines)
      const pt1inside = isPointInPolygon(pt1, pts)
      const pt2inside = isPointInPolygon(pt2, pts)
      if (!pt1inside && !pt2inside) continue
      if (intersectionPts.length === 2) {
        pt1 = intersectionPts[0][0]
        pt2 = intersectionPts[1][0]
      } else if (intersectionPts.length > 0) {
        if (pt1inside) pt2 = intersectionPts[intersectionPts.length - 1][0]
        else pt1 = intersectionPts[intersectionPts.length - 1][0]
      }
      this.ctx.moveTo(...pt1.toArray())
      this.ctx.lineTo(...pt2.toArray())
    }
    this.ctx.stroke()
    this.ctx.endPath()
    return null
  }
}

export default class Butterfree extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore

    this.addVar('minWingLayers', { initialValue: 3, min: 0, max: 5, step: 1 })
    this.addVar('wingBorderWidth', { initialValue: 1, min: 0, max: 5, step: 0.1 })
    this.addVar('wingBorderIterations', { initialValue: 1, min: 0, max: 10, step: 1 })

    this.addVar('ladderIndexSkip', { initialValue: 2, min: 1, max: 5, step: 1 })
    this.addVar('ladderSkew', { initialValue: -0.02, min: -0.2, max: 0.1, step: 0.01 })

    this.addVar('voronoiPts', { initialValue: 30, min: 4, max: 250, step: 1 })
    this.addVar('loosenIterations', { initialValue: 2, min: 0, max: 250, step: 1 })
    this.addVar('loosenDistCutoff', { initialValue: 2, min: 0, max: 12, step: 0.1 })
    this.addVar('loosenStrength', { initialValue: 2, min: 1, max: 10, step: 0.001 })
    this.addVar('apoptosisMitosis', { initialValue: 0.1, min: 0.0001, max: 50, step: 0.0001 })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)

    const butterfly1 = new Butterfly({
      sketch: this,
      pt: this.cp.clone(),
      scale: 1,
      droops: 1,
    })

    const butterfly2 = new Butterfly({
      sketch: this,
      pt: this.cp.clone().add(100, 0),
      scale: 0.5,
      droops: 2,
    })

    const butterfly3 = new Butterfly({
      sketch: this,
      pt: this.cp.clone().subtract(100, 0),
      scale: 0.5,
      droops: 2,
    })

    butterfly1.draw()
    butterfly2.draw()
    butterfly3.draw()
  }

  draw(): void {
    //
  }
}
