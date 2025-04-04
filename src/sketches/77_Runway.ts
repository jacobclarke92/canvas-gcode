import type GCanvas from '../GCanvas'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'

/**
 * Meandering lines, but have the final trajectory of each line predetermined by a a short start and end point.
 * The lines attempt to match their final trajectory but if they seem like they're going to miss it, or fly into it perpendicularly or something have them veer away.
 * Kind of like planes trying to land but not being aligned to the runway properly and having to circle around and try again.
 */

class Plane {
  ctx: GCanvas
  vars: { [key: string]: number } = {}
  pos: Point
  heading: Point
  lean = 0
  aimLean = 0
  leanSpeed = 0.005
  departureLane: [Point, Point]
  arrivalLane: [Point, Point]
  pts: Point[] = []
  count = 0
  prevLeanBelowAim = false
  constructor(sketch: Sketch, departureLane: [Point, Point], arrivalLane: [Point, Point]) {
    this.ctx = sketch.ctx
    this.vars = sketch.vars
    this.departureLane = departureLane
    this.arrivalLane = arrivalLane
    this.pos = departureLane[1]
    this.heading = new Point(1, 0)
    this.lean = 0
    this.leanSpeed = randFloatRange(this.vars.maxLeanSpeed, this.vars.minLeanSpeed)
    this.aimLean = randFloat(Math.PI)
  }

  scramble() {
    this.aimLean = randFloat(Math.PI)
    // const { minLeanSpeed, maxLeanSpeed } = this.vars
    // this.leanSpeed = randFloatRange(maxLeanSpeed, minLeanSpeed)
    // TODO: adjust to avoid edges of screen
    // TODO: adjust to avoid area around destination if angle is too far off
  }

  step() {
    if (this.count > this.vars.panic) return

    const { planeSpeed, runwayLength, minCommitAngle } = this.vars

    const prevPos = this.pos.clone()
    const entryPt = this.arrivalLane[1]
    const endPt = this.arrivalLane[0]
    const visionRange = runwayLength * 2
    const closeToLanding = prevPos.distanceTo(endPt) < visionRange
    const angleToEntry = Math.atan2(entryPt.y - this.pos.y, entryPt.x - this.pos.x)
    const angleToTarget = Math.atan2(
      this.arrivalLane[0].y - this.pos.y,
      this.arrivalLane[0].x - this.pos.x
    )

    const runwayVector = endPt.clone().subtract(entryPt)

    const angleToDestination = Math.acos(
      runwayVector.dot(this.heading) / (runwayVector.magnitude() * this.heading.magnitude())
    )
    const isAligned = Math.abs(angleToDestination) < minCommitAngle
    if (isAligned) console.log(angleToDestination)

    if (closeToLanding) {
      if (isAligned) {
        if (this.pos.x < entryPt.x) this.aimLean = angleToEntry
        else this.aimLean = angleToTarget
      } else {
        if (this.pos.x < entryPt.x) this.aimLean = angleToEntry
        // else this.aimLean = -angleToTarget
      }
    }

    if (this.lean < this.aimLean) {
      this.lean += this.leanSpeed
      if (!isAligned && !this.prevLeanBelowAim) this.scramble()
      this.prevLeanBelowAim = true
    } else if (this.lean > this.aimLean) {
      this.lean -= this.leanSpeed
      if (!isAligned && this.prevLeanBelowAim) this.scramble()
      this.prevLeanBelowAim = false
    }

    this.heading = this.heading
      .add(
        Math.cos(this.lean) + Math.cos(closeToLanding && isAligned ? angleToTarget : angleToEntry),
        Math.sin(this.lean) + Math.sin(closeToLanding && isAligned ? angleToTarget : angleToEntry)
      )
      .normalize()

    const slowDown = closeToLanding && isAligned ? this.pos.distanceTo(endPt) / visionRange : 1

    this.pos = this.pos.add(
      this.heading.x * planeSpeed * slowDown,
      this.heading.y * planeSpeed * slowDown
    )

    if (isAligned && this.pos.distanceTo(endPt) < 1) {
      this.count = this.vars.panic + 1
    }

    this.ctx.beginPath()
    this.ctx.moveTo(prevPos.x, prevPos.y)
    this.ctx.lineTo(this.pos.x, this.pos.y)
    this.ctx.stroke({ debug: closeToLanding, debugColor: isAligned ? 'green' : 'red' })
    this.pts.push(prevPos)

    this.count++
  }
}

export default class Runway extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('panic', { name: 'panic', initialValue: 1500, min: 1000, max: 100000, step: 1 })
    this.addVar('departures', { name: 'numJoins', initialValue: 5, min: 1, max: 16, step: 1 })
    this.addVar('arrivals', { name: 'numRings', initialValue: 1, min: 1, max: 16, step: 1 })
    this.addVar('laneSpacing', { name: 'numRings', initialValue: 5, min: 0.1, max: 50, step: 0.1 })
    this.addVar('runwayLength', { name: 'runwayLength', initialValue: 30, min: 1, max: 100, step: 0.1 }) // prettier-ignore
    this.addVar('minLeanSpeed', { name: 'minLeanSpeed', initialValue: 0.008, min: 0.001, max: 0.1, step: 0.001 }) // prettier-ignore
    this.addVar('maxLeanSpeed', { name: 'maxLeanSpeed', initialValue: 0.012, min: 0.001, max: 0.1, step: 0.001 }) // prettier-ignore
    this.addVar('planeSpeed', { name: 'planeSpeed', initialValue: 0.5, min: 0.05, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('minCommitAngle', { name: 'minCommitAngle', initialValue: 0.5, min: 0.01, max: Math.PI/2, step: 0.01 }) // prettier-ignore
  }

  mode: 'plan' | 'draw' = 'plan'
  planes: Plane[] = []

  initDraw(): void {
    seedRandom(this.vars.seed)
    seedNoise(this.vars.seed)
    this.mode = 'plan'
    this.planes = []

    const { gutter, departures, arrivals, laneSpacing, runwayLength } = this.vars
    const departureSpace = laneSpacing * (departures - 1)
    const arrivalSpace = laneSpacing * (arrivals - 1)
    const departureLanes: [Point, Point][] = []
    let arrivalLanes: [Point, Point][] = []
    for (let i = 0; i < departures; i++) {
      const y = this.cp.y - departureSpace / 2 + i * laneSpacing
      departureLanes.push([new Point(gutter, y), new Point(gutter + runwayLength, y)])
      this.ctx.strokeLine(...departureLanes[i])
    }
    for (let i = 0; i < arrivals; i++) {
      const y = this.cp.y - arrivalSpace / 2 + i * laneSpacing
      arrivalLanes.push([
        new Point(this.cw - gutter, y),
        new Point(this.cw - gutter - runwayLength, y),
      ])
      this.ctx.strokeLine(...arrivalLanes[i])
    }
    arrivalLanes = shuffle(arrivalLanes)

    for (let i = 0; i < departures; i++) {
      this.planes.push(new Plane(this, departureLanes[i], arrivalLanes[i % arrivalLanes.length]))
    }
  }

  draw(): void {
    if (this.mode === 'plan') {
      for (const plane of this.planes) {
        plane.step()
      }
    }
  }
}
