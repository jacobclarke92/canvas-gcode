import { deg360 } from '../constants/angles'
import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { circleOverlapsCircles, pointInCircles } from '../utils/geomUtils'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

let _id = 0

class Boid {
  public position: Point
  public velocity: Point
  public readonly id: number
  public previousPaths: Point[][] = []
  public previousPositions: Point[] = []
  public tailPositions: Point[] = []

  constructor(x: number, y: number, speed = 1, angle = 0) {
    this.id = _id++
    this.position = new Point(x, y)
    this.velocity = new Point(speed * Math.cos(angle), speed * Math.sin(angle))
  }

  public logPosition(tailLength: number) {
    if (
      this.previousPositions.length > 0 &&
      Point.distance(this.previousPositions[this.previousPositions.length - 1], this.position) > 5
    ) {
      this.previousPaths.push(this.previousPositions)
      this.previousPositions = []
      this.tailPositions = []
    }
    const pos = this.position.clone()
    this.previousPositions.push(pos)
    this.tailPositions.push(pos)
    if (this.tailPositions.length > tailLength)
      this.tailPositions.slice(this.tailPositions.length - tailLength)
  }
}

const filterByRadius = (boid: Boid, boids: Boid[], radius: number) =>
  boids.filter((otherBoid) => {
    if (boid.id === otherBoid.id) return false
    return Point.distance(boid.position, otherBoid.position) < radius
  })

const nClosest = (boid: Boid, boids: Boid[], n: number) => {
  const distances = boids.map((otherBoid) => ({
    boid: otherBoid,
    distance: Point.distance(boid.position, otherBoid.position),
  }))
  distances.sort((a, b) => a.distance - b.distance)
  return distances.slice(0, n).map((d) => d.boid)
}

export default class Boids extends Sketch {
  static generateGCode = true
  static disableOverclock = true

  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('speedUp', {
      initialValue: 10,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('waitFor', {
      initialValue: 50,
      min: 1,
      max: 500,
      step: 1,
    })
    this.addVar('stopAfter', {
      initialValue: 150,
      min: 1,
      max: 500,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 70,
      step: 1,
    })
    this.addVar('numBoids', {
      initialValue: 12,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('maxSpeed', {
      initialValue: 1,
      min: 0.01,
      max: 10,
      step: 0.01,
    })
    this.addVar('visionRadius', {
      initialValue: 30,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('visionConeAngle', {
      initialValue: deg360,
      min: 0.01,
      max: deg360,
      step: 0.001,
    })
    this.addVar('herdAttraction', {
      initialValue: 0.005,
      min: 0,
      max: 0.1,
      step: 0.0001,
    })
    this.addVar('repulsionRadius', {
      initialValue: 8,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('repulsion', {
      initialValue: 0.05,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('alignmentForce', {
      initialValue: 0.05,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('centerPull', {
      initialValue: 0.001,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('tailLength', {
      initialValue: 25,
      min: 0,
      max: 500,
      step: 1,
    })
    this.addVar('numPens', {
      initialValue: 4,
      min: 1,
      max: colors.length + 1,
      step: 1,
    })
    this.vs.crossOver = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.debugMode = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.displayTrails = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.includeHazards = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.addVar('hazards', {
      initialValue: 3,
      min: 0,
      max: 20,
      step: 1,
    })
    this.addVar('hazardMinRadius', {
      initialValue: 10,
      min: 1,
      max: 50,
      step: 0.1,
    })
    this.addVar('hazardMaxRadius', {
      initialValue: 15,
      min: 1,
      max: 100,
      step: 0.1,
    })
    this.addVar('hazardRepulsion', {
      initialValue: 0.05,
      min: 0.001,
      max: 1,
      step: 0.001,
    })
  }

  pathsCaptured = false
  done = false
  boids: Boid[] = []
  hazards: [pt: Point, radius: number][] = []

  initDraw(): void {
    const { seed, numBoids, gutter } = this.vars
    seedRandom(seed)
    // seedNoise(this.vs.seed.value)

    this.pathsCaptured = false
    this.done = false

    this.hazards = []
    if (this.vs.includeHazards.value) {
      let panik = 0
      for (let i = 0; i < this.vars.hazards; i++) {
        if (panik > 200) break
        const radius = randFloatRange(this.vars.hazardMinRadius, this.vars.hazardMaxRadius)
        const pt = new Point(
          gutter + radius + randFloatRange(this.cw - (gutter + radius) * 2),
          gutter + radius + randFloatRange(this.ch - (gutter + radius) * 2)
        )
        if (circleOverlapsCircles([pt, radius], ...this.hazards)) {
          i--
          panik++
          continue
        }
        this.hazards.push([pt, radius])
      }
    }

    this.boids = []
    for (let i = 0; i < numBoids; i++) {
      const x = gutter + randFloatRange(this.cw - gutter * 2)
      const y = gutter + randFloatRange(this.ch - gutter * 2)
      if (pointInCircles(new Point(x, y), ...this.hazards)) {
        i--
        continue
      }
      const boid = new Boid(x, y, randFloatRange(3, 1), randFloatRange(deg360))
      this.boids.push(boid)
    }
  }

  updateBoid(boid: Boid) {
    const debugMode = !!this.vs.debugMode.value
    const {
      gutter,
      visionRadius,
      visionConeAngle,
      herdAttraction,
      maxSpeed,
      repulsionRadius,
      repulsion,
      alignmentForce,
      centerPull,
      hazardRepulsion,
    } = this.vars

    // move towards the average position of the herd
    const currentDirection = boid.velocity.clone().divide(boid.velocity.magnitude())
    const herd = filterByRadius(boid, this.boids, visionRadius).filter((otherBoid) => {
      const diff = otherBoid.position.clone().subtract(boid.position)
      const diffNormalized = diff.clone().normalize()
      const dotProduct =
        currentDirection.x * diffNormalized.x + currentDirection.y * diffNormalized.y
      const angle = Math.acos(dotProduct)
      return angle < visionConeAngle
    })
    const herdCenter = new Point(0, 0)
    for (const otherBoid of herd) herdCenter.add(otherBoid.position)
    if (herd.length) {
      herdCenter.divide(herd.length)
      boid.velocity.x += (herdCenter.x - boid.position.x) * herdAttraction
      boid.velocity.y += (herdCenter.y - boid.position.y) * herdAttraction
    }

    // generally align with the herd
    const alignmentVector = new Point(0, 0)
    for (const otherBoid of herd) alignmentVector.add(otherBoid.velocity)
    if (herd.length > 0) {
      alignmentVector.divide(herd.length)
      boid.velocity.x += (alignmentVector.x - boid.velocity.x) * alignmentForce
      boid.velocity.y += (alignmentVector.y - boid.velocity.y) * alignmentForce
    }

    // move away from personal space deniers
    const personalSpaceDeniers = filterByRadius(boid, this.boids, repulsionRadius)
    const repulsionResponse = new Point(0, 0)
    for (const otherBoid of personalSpaceDeniers)
      repulsionResponse.add(boid.position.clone().subtract(otherBoid.position))
    boid.velocity.x += repulsionResponse.x * repulsion
    boid.velocity.y += repulsionResponse.y * repulsion

    // add force to center of screen
    const center = new Point(this.cx, this.cy)
    boid.velocity.x += (center.x - boid.position.x) * centerPull
    boid.velocity.y += (center.y - boid.position.y) * centerPull

    if (this.vs.includeHazards.value) {
      for (const [pt, radius] of this.hazards) {
        if (Point.distance(boid.position, pt) < radius) {
          boid.velocity.x += (boid.position.x - pt.x) * hazardRepulsion
          boid.velocity.y += (boid.position.y - pt.y) * hazardRepulsion
        }
      }
    }

    if (debugMode) {
      this.ctx.beginPath()
      this.ctx.moveTo(...boid.position.toArray())
      this.ctx.arc(
        boid.position.x,
        boid.position.y,
        visionRadius,
        boid.velocity.angle() - visionConeAngle / 2,
        boid.velocity.angle() + visionConeAngle / 2,
        false
      )
      this.ctx.lineTo(...boid.position.toArray())
      this.ctx.stroke()
      // this.ctx.strokeCircle(boid.position, visionRadius, { debug: true })
      this.ctx.strokeCircle(boid.position, repulsionRadius, { debug: true })
      for (const otherBoid of herd) {
        this.ctx.beginPath()
        this.ctx.moveTo(...boid.position.toArray())
        this.ctx.lineTo(...otherBoid.position.toArray())
        this.ctx.strokeStyle = 'blue'
        this.ctx.stroke()
        this.ctx.strokeStyle = 'black'
      }
    }

    // enforce max speed
    const magnitude = boid.velocity.magnitude()
    if (magnitude > maxSpeed) {
      boid.velocity.x = (boid.velocity.x / magnitude) * maxSpeed
      boid.velocity.y = (boid.velocity.y / magnitude) * maxSpeed
    }

    // move boid
    boid.position.add(boid.velocity)

    // wrap around screen
    if (this.vs.crossOver.value) {
      let moved = false
      if (boid.position.x < gutter) {
        boid.position.x = this.cw - gutter
        moved = true
      } else if (boid.position.x > this.cw - gutter) {
        boid.position.x = gutter
        moved = true
      }
      if (boid.position.y < gutter) {
        boid.position.y = this.ch - gutter
        moved = true
      } else if (boid.position.y > this.ch - gutter) {
        boid.position.y = gutter
        moved = true
      }
      if (moved && this.vs.includeHazards.value) {
        for (const [pt, radius] of this.hazards) {
          if (Point.distance(boid.position, pt) < radius) {
            const diff = boid.position.clone().subtract(pt)
            boid.position.add(diff.normalize().multiply(radius))
          }
        }
      }
    } else if (
      boid.position.x < gutter ||
      boid.position.x > this.cw - gutter ||
      boid.position.y < gutter ||
      boid.position.y > this.ch - gutter
    ) {
      const index = this.boids.indexOf(boid)
      this.boids.splice(index, 1)
    }
  }

  draw(increment: number): void {
    const debugMode = !!this.vs.debugMode.value
    const displayTrails = !!this.vs.displayTrails.value
    const { speedUp, waitFor, stopAfter, tailLength, numPens } = this.vars

    if (this.done) return

    if (this.pathsCaptured) {
      this.ctx.reset()
      initPen(this)
      // plotBounds(this)

      console.log('time to draw paths')

      let i = 0
      const colorPaths: Point[][][] = []
      for (const boid of this.boids) {
        const colorIndex = i % numPens
        if (boid.previousPositions.length > 1) boid.previousPaths.push(boid.previousPositions)
        if (!colorPaths[colorIndex]) colorPaths[colorIndex] = []
        for (const path of boid.previousPaths) colorPaths[colorIndex].push(path)
        i++
      }
      for (let i = 0; i < numPens; i++) {
        const color = colors[i]
        this.ctx.strokeStyle = color
        for (const path of colorPaths[i]) {
          this.ctx.strokePath(path)
        }
        if (i < numPens - 1) stopAndWigglePen(this)
      }

      this.done = true
      penUp(this)
      return
    }

    this.ctx.reset()

    for (let i = 0; i < speedUp; i++) {
      const count = increment * speedUp + i
      const isLastRenderFrame = i === speedUp - 1

      if (this.vs.includeHazards.value && isLastRenderFrame) {
        for (const [pt, radius] of this.hazards) {
          this.ctx.strokeCircle(pt, radius, { debug: true })
        }
      }

      for (const boid of this.boids) {
        this.updateBoid(boid)
        if (isLastRenderFrame && !displayTrails)
          this.ctx.strokeRectCentered(boid.position, 1.5, 1.5)

        if (count >= waitFor) boid.logPosition(tailLength)

        if (isLastRenderFrame && displayTrails && boid.tailPositions.length > 1) {
          this.ctx.strokePath(boid.tailPositions)

          if (debugMode) {
            this.ctx.beginPath()
            this.ctx.moveTo(...boid.position.toArray())
            this.ctx.lineTo(
              boid.position.x + boid.velocity.x * 100,
              boid.position.y + boid.velocity.y * 100
            )
            this.ctx.stroke({ debug: true })
          }
        }
      }
      if (count > waitFor + stopAfter) {
        this.pathsCaptured = true
        return
      }
    }
  }
}
