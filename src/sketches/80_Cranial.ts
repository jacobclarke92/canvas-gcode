import {
  deg1,
  deg5,
  deg30,
  deg35,
  deg90,
  deg135,
  deg137p5,
  deg180,
  deg360,
} from '../constants/angles'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { debugDot, debugDots, debugLine } from '../utils/debugUtils'
import type { Circle } from '../utils/geomUtils'
import { getDistancesToPoint } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { smallestAngleDiff } from '../utils/numberUtils'
import { plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pt = { x: number; y: number }

class Vector extends Point {
  dead = false
  readyToSplit = false
  heading = 0
  prevPts: Point[] = []
  quadrantRef: Quadrant | null = null
  quadrantsRef: Quadrants | null = null

  constructor(...args: ConstructorParameters<typeof Point>) {
    super(...args)
  }

  update(x: number, y: number) {
    const prevPt = new Point(this.x, this.y)
    this.x = x
    this.y = y
    this.heading = prevPt.angleTo(this)
    this.prevPts.push(prevPt)
    if (this.quadrantRef) this.quadrantRef.prevPts.push(prevPt)
    if (this.quadrantsRef) this.quadrantsRef.ensureVectorInCorrectQuadrant(this)
  }
}

class Quadrant {
  vectors: Vector[]
  prevPts: Point[] = []
  constructor() {
    this.vectors = []
  }
}

class Quadrants {
  quadrants: Quadrant[][]
  size: number
  cols: number
  rows: number

  constructor({ size, width, height }: { size: number; width: number; height: number }) {
    this.quadrants = []
    this.size = size
    this.cols = Math.ceil(width / size)
    this.rows = Math.ceil(height / size)
    console.info('Quadrants', this.cols, this.rows)
    for (let y = 0; y <= this.rows; y++) {
      this.quadrants[y] = []
      for (let x = 0; x <= this.cols; x++) {
        this.quadrants[y][x] = new Quadrant()
      }
    }
  }

  get vectors() {
    return this.quadrants.flatMap((q) => q).flatMap((q) => q.vectors)
  }

  getQuadrantForPt(pt: Point): [quadrant: Quadrant | null, col: number, row: number] {
    const x = Math.floor(pt.x / this.size)
    const y = Math.floor(pt.y / this.size)
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return [null, x, y]
    return [this.quadrants[y][x], x, y]
  }

  registerVector(vector: Vector) {
    const [quadrant] = this.getQuadrantForPt(vector)
    if (quadrant) {
      vector.quadrantRef = quadrant
      vector.quadrantsRef = this
      quadrant.vectors.push(vector)
    }
  }

  deregisterVector(vector: Vector) {
    const [quadrant] = this.getQuadrantForPt(vector)
    if (quadrant) {
      const index = quadrant.vectors.indexOf(vector)
      if (index >= 0) quadrant.vectors.splice(index, 1)
    }
  }

  getPointsInQuadrantAndNeighbors(pt: Point | Vector) {
    const [q, col, row] = this.getQuadrantForPt(pt)
    if (!q) return []
    const pts: Point[] = [...q.vectors.filter((v) => v !== pt), ...q.prevPts]
    for (
      let rowOffset = Math.max(0, row - 1);
      rowOffset <= Math.min(this.rows, row + 1);
      rowOffset++
    ) {
      for (
        let colOffset = Math.max(0, col - 1);
        colOffset <= Math.min(this.cols, col + 1);
        colOffset++
      ) {
        if (colOffset === col && rowOffset === row) continue
        const neighborQ = this.quadrants[rowOffset]?.[colOffset]
        if (neighborQ) pts.push(...neighborQ.vectors, ...neighborQ.prevPts)
      }
    }
    return pts
  }

  ensureVectorInCorrectQuadrant(vector: Vector) {
    const [quadrant, col, row] = this.getQuadrantForPt(vector)
    if (!quadrant) return console.warn('missing quadrant for', col, row)
    if (vector.quadrantRef !== quadrant) {
      const removalIndex = vector.quadrantRef.vectors.indexOf(vector)
      if (removalIndex >= 0) vector.quadrantRef.vectors.splice(removalIndex, 1)
      vector.quadrantRef = quadrant
      quadrant.vectors.push(vector)
    }
  }
}

export default class Cranial extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('startingSpawns', { name: 'startingSpawns', initialValue: 5, min: 1, max: 12, step: 1 }) // prettier-ignore
    this.addVar('startingSteps', { name: 'startingSteps', initialValue: 10, min: 1, max: 100, step: 1 }) // prettier-ignore
    this.addVar('drawDist', { name: 'drawDist', initialValue: 0.5, min: 0.1, max: 10, step: 0.01 }) // prettier-ignore
    this.addVar('attractionForce', { name: 'attractionForce', initialValue: 0.5, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('repulsionForce', { name: 'repulsionForce', initialValue: 0.6, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('centerForce', { name: 'centerForce', initialValue: 0.1, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('visionRadius', { name: 'visionRadius', initialValue: 9, min: 0.1, max: 20, step: 0.1 }) // prettier-ignore
    this.addVar('avoidRadius', { name: 'avoidRadius', initialValue: 4.2, min: 0.1, max: 20, step: 0.1 }) // prettier-ignore
    this.addVar('lookaheadAngle', { name: 'lookaheadAngle', initialValue: deg35, min: 0, max: deg90, step: deg1 }) // prettier-ignore
    this.addVar('splitAfter', { name: 'splitAfter', initialValue: 15, min: 1, max: 1000, step: 1 }) // prettier-ignore
    this.addVar('splitAngle', { name: 'splitAngle', initialValue: deg30, min: deg5, max: deg180, step: deg1 }) // prettier-ignore
    this.addVar('overcrowdedThreshold', { name: 'overcrowdedThreshold', initialValue: 30, min: 5, max: 200, step: 1 }) // prettier-ignore
    this.addVar('simulationSteps', { name: 'simulationSteps', initialValue: 250, min: 1, max: 1000, step: 1 }) // prettier-ignore
    this.addVar('obstacleStartSize', { name: 'obstacleStartSize', initialValue: 3.6, min: 1, max: 32, step: 0.1 }) // prettier-ignore
    this.addVar('obstacleGrowRate', { name: 'obstacleGrowRate', initialValue: 0.2, min: 0.1, max: 5, step: 0.1 }) // prettier-ignore
    this.addVar('obstacleExpandRate', { name: 'obstacleExpandRate', initialValue: 2, min: 1, max: 20, step: 0.5 }) // prettier-ignore
    this.vs.createObstacles = new BooleanRange({ name: 'createObstacles', initialValue: true })
    this.vs.containInCircle = new BooleanRange({ name: 'containInCircle', initialValue: true })
    this.vs.debugSurroundings = new BooleanRange({ name: 'debugSurroundings', initialValue: false })
    this.vs.debugAhead = new BooleanRange({ name: 'debugAhead', initialValue: false })
  }

  mode: 'plan' | 'draw' = 'plan'
  quadrants: Quadrants | null = null
  obstacles: Circle[] = []

  initDraw(): void {
    const {
      seed,
      gutter,
      visionRadius,
      startingSpawns,
      startingSteps,
      drawDist,
      simulationSteps,
      obstacleExpandRate,
      obstacleStartSize,
      obstacleGrowRate,
    } = this.vars
    seedRandom(seed)
    seedNoise(seed)

    plotBounds(this)

    this.mode = 'plan'

    this.obstacles = []
    this.quadrants = new Quadrants({
      size: visionRadius * 2,
      width: this.cw,
      height: this.ch,
    })

    const obstaclePts: Point[] = []
    const containRadius = (this.ch - gutter * 2) / 2
    if (this.vs.createObstacles.value) {
      let obstacleAngle = 0
      let obstacleSize = obstacleStartSize
      let obstacleDist = drawDist * startingSteps + obstacleStartSize * 2
      let obstaclePt = this.cp.clone()
      while (this.cp.distanceTo(obstaclePt) < containRadius + obstacleSize) {
        obstaclePt = new Point(
          this.cp.x + Math.cos(obstacleAngle) * obstacleDist,
          this.cp.y + Math.sin(obstacleAngle) * obstacleDist
        )
        this.obstacles.push([obstaclePt.clone(), obstacleSize])
        const detail = Math.floor(obstacleSize * 10)
        for (let p = 0; p < detail; p++) {
          const angle = deg360 * (p / detail)
          obstaclePts.push(obstaclePt.clone().moveAlongAngle(angle, obstacleSize))
        }
        if (this.vs.debugSurroundings.value)
          this.ctx.strokeCircle(obstaclePt, obstacleSize, { debug: true })
        obstacleSize += obstacleGrowRate
        obstacleAngle += deg137p5
        obstacleDist += obstacleExpandRate
      }
    }
    if (this.vs.containInCircle.value) {
      if (this.vs.debugSurroundings.value)
        this.ctx.strokeCircle(this.cp, containRadius, { debug: true })
      const detail = Math.floor(containRadius * 8)
      for (let p = 0; p < detail; p++) {
        const angle = deg360 * (p / detail)
        obstaclePts.push(
          new Point(
            this.cp.x + Math.cos(angle) * containRadius,
            this.cp.y + Math.sin(angle) * containRadius
          )
        )
      }
    }
    obstaclePts.forEach((pt) => {
      const [quadrant] = this.quadrants.getQuadrantForPt(pt)
      if (quadrant) quadrant.prevPts.push(pt)
    })

    const initialDist = drawDist * startingSteps
    const angleSeg = deg360 / startingSpawns
    const distSeg = initialDist / startingSteps
    for (let i = 0; i < startingSpawns; i++) {
      const angle = angleSeg * i
      const vector = new Vector(
        this.cp.x + Math.cos(angle) * initialDist,
        this.cp.y + Math.sin(angle) * initialDist
      )
      vector.readyToSplit = true
      this.quadrants.registerVector(vector)
      const [quadrant] = this.quadrants.getQuadrantForPt(vector)
      for (let n = 0; n < startingSteps; n++) {
        const iN = startingSteps - n
        const pt = new Point(
          vector.x - Math.cos(angle) * (iN * distSeg),
          vector.y - Math.sin(angle) * (iN * distSeg)
        )
        vector.prevPts.push(pt)
        if (!quadrant) {
          console.warn('missing quadrant for', pt.x, pt.y)
          continue
        }
        quadrant.prevPts.push(pt)
      }
    }

    /**
     * TODO:
     Will probably need to add another class for pts (Vectors?) to keep track of current heading
     Vectors should avoid other points within a smaller vision cone
     While also attracting to other points within a larger vision cone
     Aim is to make a brain-esque shape
     */

    for (let i = 0; i < simulationSteps; i++) {
      this.quadrants.vectors
        .filter((vector) => !vector.dead)
        .forEach((vector) => {
          this.vectorStep(vector, i === simulationSteps - 1)
        })
    }

    this.quadrants.vectors.forEach((vector) => {
      this.ctx.beginPath()
      this.ctx.moveTo(vector.x, vector.y)
      for (let i = vector.prevPts.length - 1; i >= 0; i--) {
        const pt = vector.prevPts[i]
        this.ctx.lineTo(pt.x, pt.y)
      }
      this.ctx.stroke()
    })
  }

  vectorStep(vector: Vector, debug = false) {
    const {
      gutter,
      startingSteps,
      visionRadius,
      avoidRadius,
      lookaheadAngle,
      drawDist,
      attractionForce,
      repulsionForce,
      centerForce,
      splitAfter,
      splitAngle,
      overcrowdedThreshold,
    } = this.vars
    const neighboringPts = this.quadrants.getPointsInQuadrantAndNeighbors(vector)
    const moveTowardsPts = neighboringPts.filter((v) => v.distanceTo(vector) <= visionRadius)
    const moveAwayPts = neighboringPts.filter((v) => v.distanceTo(vector) <= avoidRadius)

    if (moveTowardsPts.length === 0) {
      console.warn('no close neighbors')
      vector.dead = true
      debugDot(this.ctx, vector, 'purple')
      return
    }
    const moveTowardsForce = moveTowardsPts
      .reduce(
        (acc, v) =>
          acc.moveAlongAngle(
            vector.angleTo(v),
            (visionRadius - v.distanceTo(vector)) * attractionForce
          ),
        new Point(0, 0)
      )
      .divide(moveTowardsPts.length)

    if (this.vs.debugSurroundings.value && debug) {
      debugLine(
        this.ctx,
        vector,
        vector.clone().moveAlongAngle(moveTowardsForce.angle(), visionRadius),
        'blue'
      )
      this.ctx.strokeCircle(vector, visionRadius, { debug: true, debugColor: 'blue' })
      this.ctx.strokeCircle(vector, avoidRadius, { debug: true, debugColor: 'red' })
      debugDots(this.ctx, moveTowardsPts, 'blue')
    }

    let moveAwayForce = new Point(0, 0)

    if (moveAwayPts.length > 0) {
      if (moveAwayPts.length >= overcrowdedThreshold) {
        vector.dead = true
        if (this.vs.debugAhead.value) debugDot(this.ctx, vector)
        return
      }

      const [ptsDirectlyAhead, ptsNotDirectlyAhead] = moveAwayPts.reduce(
        ([ptsDirectlyAhead, ptsNotDirectlyAhead], pt) => {
          if (smallestAngleDiff(vector.heading, vector.angleTo(pt)) < lookaheadAngle)
            ptsDirectlyAhead.push(pt)
          else ptsNotDirectlyAhead.push(pt)
          return [ptsDirectlyAhead, ptsNotDirectlyAhead]
        },
        [[], []]
      )

      const distances = getDistancesToPoint(vector, ...ptsDirectlyAhead).sort(
        ([, a], [, b]) => a - b
      )
      if (this.vs.debugAhead.value) {
        // debugDots(this.ctx, ptsNotDirectlyAhead, 'yellow')
        debugDots(this.ctx, ptsDirectlyAhead, 'orange')
      }

      // check if running into a wall
      const closestPt = distances[0]
      if (closestPt && closestPt[1] < drawDist * 2 && vector.prevPts.length >= startingSteps) {
        vector.dead = true
        if (this.vs.debugAhead.value) debugDot(this.ctx, vector)
        return
      }

      // set flag if we are ready to split
      if (!vector.readyToSplit && vector.prevPts.length && vector.prevPts.length % splitAfter === 0)
        vector.readyToSplit = true

      if (ptsDirectlyAhead.length <= 0 && vector.readyToSplit) {
        const splitPt = new Point(vector.x, vector.y).moveAlongAngle(
          vector.heading - splitAngle / 2,
          drawDist
        )
        const newVector = new Vector(splitPt.x, splitPt.y)
        this.quadrants.registerVector(newVector)
        newVector.prevPts.push(new Point(vector.x, vector.y))
        vector.readyToSplit = false
      }

      moveAwayForce = moveAwayPts
        .reduce(
          (acc, v) =>
            acc.moveAlongAngle(
              v.angleTo(vector),
              (visionRadius - v.distanceTo(vector)) * repulsionForce
            ),
          new Point(0, 0)
        )
        .divide(moveAwayPts.length)

      if (this.vs.debugSurroundings.value && debug) {
        debugLine(
          this.ctx,
          vector,
          vector.clone().moveAlongAngle(moveAwayForce.angle(), avoidRadius),
          'red'
        )
      }
    }

    const centralAngle = vector.angleTo(this.cp)
    const centralForce = new Point(0, 0).moveAlongAngle(centralAngle, drawDist * centerForce)

    const movementAngle = new Point(
      moveTowardsForce.x + moveAwayForce.x + centralForce.x,
      moveTowardsForce.y + moveAwayForce.y + centralForce.y
    ).angle()

    vector.update(
      vector.x + Math.cos(movementAngle) * drawDist,
      vector.y + Math.sin(movementAngle) * drawDist
    )

    // check if vector is out of bounds
    if (
      vector.x < gutter ||
      vector.x > this.cw - gutter ||
      vector.y < gutter ||
      vector.y > this.ch - gutter
    ) {
      vector.dead = true
      if (this.vs.debugAhead.value) debugDot(this.ctx, vector)
      return
    }
    if (this.vs.containInCircle.value) {
      const containRadius = (this.ch - gutter * 2) / 2
      if (this.cp.distanceTo(vector) > containRadius) {
        vector.dead = true
        if (this.vs.debugAhead.value) debugDot(this.ctx, vector)
        return
      }
    }
    if (this.vs.createObstacles.value) {
      for (const [obstaclePt, obstacleSize] of this.obstacles) {
        if (obstaclePt.distanceTo(vector) < obstacleSize) {
          vector.dead = true
          if (this.vs.debugAhead.value) debugDot(this.ctx, vector)
          return
        }
      }
    }
  }

  draw(): void {
    //
  }
}
