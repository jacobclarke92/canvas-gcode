import { EndType, JoinType } from 'js-angusj-clipper/web'

import { deg90 } from '../constants/angles'
import type GCanvas from '../GCanvas'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import {
  cyclePointsToStartWith,
  getBottommostPoint,
  getBoundsFromPath,
  getLeftmostPoint,
  getLineIntersectionPoints,
  getMidPt,
  getRightmostPoint,
  isPointInPolygon,
  pointsToLines,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { generateSpline, generateSplineWithEnds } from '../utils/splineUtils'
import { relaxSites, sortEdges } from '../utils/voronoiUtils'
import type { BoundingBox, Diagram, Edge, Site } from '../Voronoi'
import { Voronoi } from '../Voronoi'

const ip2p = (ip: IntPoint) => new Point(ip.x, ip.y)

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

    const headTopRightIndex = Math.floor(headSplinePts.length * 0.5)
    const headTopLeftIndex = Math.floor(headSplinePts.length * 0.75)
    const bodyStartRightIndex = Math.floor(bodySplinePts.length * 0.32)
    const bodyEndRightIndex = Math.floor(bodySplinePts.length * 0.42)
    const bodyStartLeftIndex = Math.floor(bodySplinePts.length * 0.94)
    const bodyEndLeftIndex = Math.floor(bodySplinePts.length * 0.84)
    const thoraxEndRightIndex = Math.floor(thoraxSplinePts.length * 0.55)
    const thoraxEndLeftIndex = Math.floor(thoraxSplinePts.length * 0.7)

    const headTopRight = headSplinePts[headTopRightIndex]
    const headTopLeft = headSplinePts[headTopLeftIndex]
    const bodyStartRight = bodySplinePts[bodyStartRightIndex]
    const bodyEndRight = bodySplinePts[bodyEndRightIndex]
    const bodyStartLeft = bodySplinePts[bodyStartLeftIndex]
    const bodyEndLeft = bodySplinePts[bodyEndLeftIndex]
    const thoraxEndRight = thoraxSplinePts[thoraxEndRightIndex]
    const thoraxEndLeft = thoraxSplinePts[thoraxEndLeftIndex]

    debugDot(this.ctx, headTopRight)
    debugDot(this.ctx, headTopLeft)
    debugDot(this.ctx, bodyStartRight)
    debugDot(this.ctx, bodyEndRight)
    debugDot(this.ctx, bodyStartLeft)
    debugDot(this.ctx, bodyEndLeft)
    debugDot(this.ctx, thoraxEndRight)
    debugDot(this.ctx, thoraxEndLeft)

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

    /**
     * Now we generate pattern inside top right wing
     */

    const topWingClosedPts = [
      ...bodySplinePts.slice(bodyStartRightIndex, bodyEndRightIndex + 1).reverse(),
      ...topWingSplinePts,
    ].map(ip2p)

    let topWingOffsetPath: Point[]
    let topWingOffsetLeftmostPt: Point
    for (let i = 1; i < 5 * this.scale; i += 1 * this.scale) {
      topWingOffsetPath = this.ctx
        .offsetPath(topWingOffsetPath || topWingClosedPts, -0.5, {
          joinType: JoinType.Round,
        })
        .sort((a, b) => a.length - b.length)[0]
      if (!topWingOffsetPath) continue
      topWingOffsetLeftmostPt = topWingOffsetPath.reduce((acc, pt) => (pt.x < acc.x ? pt : acc))
      topWingOffsetPath = cyclePointsToStartWith(topWingOffsetLeftmostPt, topWingOffsetPath)

      debugDot(this.ctx, topWingOffsetLeftmostPt, 'red')
      this.ctx.beginPath()
      this.ctx.moveTo(topWingOffsetPath[0].x, topWingOffsetPath[0].y)
      for (let i = 1; i < topWingOffsetPath.length; i++)
        this.ctx.lineTo(topWingOffsetPath[i].x, topWingOffsetPath[i].y)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    let topWingOffsetPath2 = this.ctx
      .offsetPath(topWingOffsetPath, -5 * this.scale, { joinType: JoinType.Round })
      .sort((a, b) => a.length - b.length)[0]
    const topWingOffset2LeftmostPt = getLeftmostPoint(...topWingOffsetPath2)
    topWingOffsetPath2 = cyclePointsToStartWith(topWingOffset2LeftmostPt, topWingOffsetPath2)

    const offsetDiff = topWingOffset2LeftmostPt
      .clone()
      .subtract(topWingOffsetLeftmostPt.x / 1000, topWingOffsetLeftmostPt.y / 1000) // not sure why it's so large still

    topWingOffsetPath2.forEach((pt) => pt.subtract(offsetDiff.x * 0.8, offsetDiff.y * 0.8))

    this.ctx.beginPath()
    this.ctx.moveTo(topWingOffsetPath2[0].x, topWingOffsetPath2[0].y)
    for (let i = 1; i < topWingOffsetPath2.length; i++)
      this.ctx.lineTo(topWingOffsetPath2[i].x, topWingOffsetPath2[i].y)
    this.ctx.stroke()

    const topWingOffset2RightmostPt = getRightmostPoint(...topWingOffsetPath2)
    const topWingOffset2BottommostPt = getBottommostPoint(...topWingOffsetPath2)
    const topWingOffset2RightmostPtIndex = topWingOffsetPath2.indexOf(topWingOffset2RightmostPt)
    const topWingOffset2RightmostPtIndexPercent =
      topWingOffset2RightmostPtIndex / topWingOffsetPath2.length
    const topWingOffset2BottommostPtIndex = topWingOffsetPath2.indexOf(topWingOffset2BottommostPt)
    const topWingOffset2BottommostPtIndexPercent =
      topWingOffset2BottommostPtIndex / topWingOffsetPath2.length

    debugDot(this.ctx, topWingOffsetPath2[0], 'blue') // leftmost -- cycled to start
    debugDot(this.ctx, topWingOffset2RightmostPt, 'blue')
    debugDot(this.ctx, topWingOffset2BottommostPt, 'blue')

    const averagePos = getMidPt(...topWingOffsetPath2)
    debugDot(this.ctx, averagePos)

    for (let i = topWingOffset2RightmostPtIndex; i < topWingOffset2BottommostPtIndex; i += 2) {
      const percent = i / topWingOffsetPath2.length
      const pt1 = topWingOffsetPath2[i]
      const pt2 = topWingOffsetPath[Math.floor(topWingOffsetPath.length * percent)]
      this.ctx.beginPath()
      this.ctx.moveTo(pt1.x, pt1.y)
      this.ctx.lineTo(pt2.x / 1000, pt2.y / 1000)
      this.ctx.stroke()
    }

    /**
     * Generate bottom right wing from simplified shape
     * 1st pass - to generate an initial shape first
     */
    const thoraxStartRightIndex = Math.floor(topWingSplinePts.length * 0.8)
    const thoraxStartRight = topWingSplinePts[thoraxStartRightIndex]
    debugDot(this.ctx, thoraxStartRight)

    // bottom right wing
    const bottomWingFarRightPt = ip2p(thoraxStartRight)
      .clone()
      .moveAlongAngle(ip2p(bodyEndRight).angleTo(ip2p(thoraxStartRight)), 15 * this.scale)
      .add(0, 2 * this.scale)

    let bottomWingPts: (Point | IntPoint)[] = [
      ip2p(thoraxStartRight),
      bottomWingFarRightPt,
      ip2p(thoraxStartRight).add(10 * this.scale, randFloatRange(30, 20) * this.scale),
      ip2p(thoraxStartRight).add(-15 * this.scale, randFloatRange(45, 35) * this.scale),
      // ip2p(thoraxEndRight).moveAlongAngle(randFloatRange(Math.PI * 0.45, Math.PI * 0.3), 20 * this.scale),
      ip2p(thoraxEndRight),
    ]

    // const initialBottomWingSplinePts = generateSplineWithEnds(bottomWingPts)
    const initialBottomWingSplinePts = this.ctx.strokeSmoothPath(bottomWingPts, {
      debug: true,
      debugColor: 'yellow',
    })

    // for (const pt of initialBottomWingSplinePts) debugDot(this.ctx, pt, 'pink')

    /**
     * 2nd pass - to generate a more detailed shape with 'droops'
     */

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

    /**
     * Bottom wing pattern time
     */

    const bottomWingClosedPts = [
      ...topWingSplinePts.slice(thoraxStartRightIndex).reverse(),
      ...thoraxSplinePts.slice(thoraxStartRightIndex, thoraxEndRightIndex + 1).reverse(),
      ...bottomWingSplinePts,
    ].map(ip2p)

    // this.ctx.strokePath(bottomWingClosedPts, { debug: true, debugColor: 'red' })
    const bottomWingVoronoi = new Voronoi()
    let bottomWingDiagram: Diagram | null = null
    let bottomWingSites: Site[] = []
    const [top, right, bottom, left] = getBoundsFromPath(bottomWingClosedPts)
    const boundingBox: BoundingBox = { top: 0, left: 0, width: right - left, height: bottom - top }
    for (let i = 0; i < this.vars.voronoiPts; i++) {
      const pt = new Point(
        randFloatRange(boundingBox.width, 0),
        randFloatRange(boundingBox.height, 0)
      )
      const absolutePt = pt.clone().add(left, top)
      if (isPointInPolygon(absolutePt, bottomWingClosedPts)) {
        bottomWingSites.push({ x: pt.x, y: pt.y })
        // debugDot(this.ctx, absolutePt, 'green')
      }
    }

    const compute = (sites: Site[]) => {
      bottomWingSites = sites
      bottomWingVoronoi.recycle(bottomWingDiagram)
      bottomWingDiagram = bottomWingVoronoi.compute(bottomWingSites, boundingBox)
    }

    compute(bottomWingSites)

    for (let i = 0; i < this.vars.loosenIterations; i++) {
      const sites = relaxSites({
        diagram: bottomWingDiagram,
        apoptosisMitosis: this.vars.apoptosisMitosis,
        loosenStrength: this.vars.loosenStrength,
        loosenDistCutoff: this.vars.loosenDistCutoff,
      })
      compute(sites)
    }

    const bottomWingVoronoiEdges = sortEdges(bottomWingDiagram.edges)
    const bottomWingShapeLines = pointsToLines(bottomWingClosedPts)
    let iEdge = bottomWingVoronoiEdges.length
    let edge: Edge
    this.ctx.beginPath()
    while (iEdge--) {
      edge = bottomWingVoronoiEdges[iEdge]
      let pt1 = new Point(left + edge.vertex1.x, top + edge.vertex1.y)
      let pt2 = new Point(left + edge.vertex2.x, top + edge.vertex2.y)
      const intersectionPts = getLineIntersectionPoints([pt1, pt2], ...bottomWingShapeLines)
      const pt1inside = isPointInPolygon(pt1, bottomWingClosedPts)
      const pt2inside = isPointInPolygon(pt2, bottomWingClosedPts)
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

    // bottomWingSites.forEach((site) => {
    //   debugDot(this.ctx, new Point(left + site.x, top + site.y), 'green')
    // })

    /*
    // this draws offset paths for the bottom wing
    let bottomWingOffsetPath: Point[]
    let bottomWingOffsetLeftmostPt: Point
    for (let i = 1; i < 7 * this.scale; i += 1 * this.scale) {
      bottomWingOffsetPath = this.ctx
        .offsetPath(bottomWingOffsetPath || bottomWingClosedPts, -0.5, {
          joinType: JoinType.Round,
        })
        .sort((a, b) => b.length - a.length)[0]
      if (!bottomWingOffsetPath) continue
      bottomWingOffsetLeftmostPt = getLeftmostPoint(...bottomWingOffsetPath)

      debugDot(this.ctx, bottomWingOffsetPath[0], 'red')
      this.ctx.beginPath()
      this.ctx.moveTo(bottomWingOffsetPath[0].x, bottomWingOffsetPath[0].y)
      for (let i = 1; i < bottomWingOffsetPath.length; i++) {
        this.ctx.lineTo(bottomWingOffsetPath[i].x, bottomWingOffsetPath[i].y)
      }
      this.ctx.closePath()
      this.ctx.stroke()
    }
      */

    // this.ctx.strokePath(topWingClosedPts, { debug: true, debugColor: 'blue' })

    /*
    debugDot(
      this.ctx,
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMin)],
      'blue'
    )
    debugDot(
      this.ctx,
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMax)],
      'blue'
    )
    */

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
}

export default class Butterfree extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore
    this.addVar('dist', { name: 'dist', initialValue: 80, min: 0, max: 200, step: 0.5 })
    this.addVar('voronoiPts', {
      initialValue: 30,
      min: 4,
      max: 250,
      step: 1,
    })
    this.addVar('loosenIterations', {
      initialValue: 2,
      min: 0,
      max: 250,
      step: 1,
    })
    this.addVar('loosenDistCutoff', {
      initialValue: 2,
      min: 0,
      max: 12,
      step: 0.1,
    })
    this.addVar('loosenStrength', {
      initialValue: 2,
      min: 1,
      max: 10,
      step: 0.001,
    })
    this.addVar('apoptosisMitosis', {
      initialValue: 0.1,
      min: 0.0001,
      max: 50,
      step: 0.0001,
    })
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
