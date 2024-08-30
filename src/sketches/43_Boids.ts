import Point from '../Point'
import { Sketch } from '../Sketch'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

let _id = 0

class Boid {
  public position: Point
  public velocity: Point
  public readonly id: number
  public previousPositions: Point[] = []

  constructor(x: number, y: number, speed = 1, angle = 0) {
    this.id = _id++
    this.position = new Point(x, y)
    this.velocity = new Point(speed * Math.cos(angle), speed * Math.sin(angle))
  }

  public logPosition(tailLength: number) {
    if (
      this.previousPositions.length > 1 &&
      Point.distance(this.previousPositions[this.previousPositions.length - 1], this.position) > 10
    ) {
      this.previousPositions = []
    }
    this.previousPositions.push(this.position.clone())
    if (this.previousPositions.length > tailLength)
      this.previousPositions.slice(this.previousPositions.length - tailLength)
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
  static generateGCode = false
  static disableOverclock = true

  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('stopAfter', {
      initialValue: 69,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 200,
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
    this.addVar('tailLength', {
      initialValue: 25,
      min: 0,
      max: 500,
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
  }

  done = false
  boids: Boid[] = []

  initDraw(): void {
    const { seed, numBoids, gutter } = this.vars
    seedRandom(seed)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.done = false
    this.boids = []
    for (let i = 0; i < numBoids; i++) {
      const boid = new Boid(
        gutter + randFloatRange(this.cw - gutter * 2),
        gutter + randFloatRange(this.ch - gutter * 2),
        randFloatRange(3, 1),
        randFloatRange(Math.PI * 2)
      )
      this.boids.push(boid)
    }
  }

  updateBoid(boid: Boid) {
    const debugMode = !!this.vs.debugMode.value
    const {
      gutter,
      visionRadius,
      herdAttraction,
      maxSpeed,
      repulsionRadius,
      repulsion,
      alignmentForce,
    } = this.vars

    // move towards the average position of the herd
    const herd = filterByRadius(boid, this.boids, visionRadius)
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

    if (debugMode) {
      this.ctx.strokeCircle(boid.position, visionRadius, { debug: true })
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
    boid.position = boid.position.add(boid.velocity)

    // wrap around screen
    if (this.vs.crossOver.value) {
      if (boid.position.x < gutter) boid.position.x = this.cw - gutter
      else if (boid.position.x > this.cw - gutter) boid.position.x = gutter
      if (boid.position.y < gutter) boid.position.y = this.ch - gutter
      else if (boid.position.y > this.ch - gutter) boid.position.y = gutter
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
    const { stopAfter, tailLength } = this.vars

    if (this.done) return

    // if (increment > stopAfter) {
    //   this.done = true
    //   penUp(this)
    //   return
    // }

    this.ctx.reset()

    for (const boid of this.boids) {
      // const startPos = boid.position.clone()
      this.updateBoid(boid)
      if (!displayTrails) this.ctx.strokeRectCentered(boid.position, 1, 1)

      if (increment % 50 === 0) boid.logPosition(tailLength)
      // if (Point.distance(startPos, boid.position) > 40) continue
      if (displayTrails && boid.previousPositions.length > 1) {
        this.ctx.strokePath(boid.previousPositions)

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
      // this.ctx.moveTo(...startPos.toArray())
      // this.ctx.lineTo(...boid.position.toArray())
      // this.ctx.stroke()
    }
  }
}
