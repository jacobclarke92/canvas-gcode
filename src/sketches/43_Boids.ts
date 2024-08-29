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
      Point.distance(this.previousPositions[this.previousPositions.length - 1], this.position) > 40
    ) {
      this.previousPositions = []
    }
    this.previousPositions.push(this.position.clone())
    if (this.previousPositions.length > tailLength) this.previousPositions.shift()
  }
}

const filterByRadius = (boid: Boid, boids: Boid[], radius: number) =>
  boids.filter((otherBoid) => {
    if (boid.id === otherBoid.id) return false
    return Point.distance(boid.position, otherBoid.position) < radius
  })

export default class Boids extends Sketch {
  static generateGCode = false

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
      initialValue: 0.1,
      min: 0.01,
      max: 1,
      step: 0.01,
    })
    this.addVar('visionRadius', {
      initialValue: 75,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('attraction', {
      initialValue: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
    })
    this.addVar('repulsionRadius', {
      initialValue: 15,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('repulsion', {
      initialValue: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
    })
    this.addVar('alignmentForce', {
      initialValue: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
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
      initialValue: true,
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
    const { gutter, visionRadius, attraction, maxSpeed, repulsionRadius, repulsion } = this.vars

    const attractiveBoid = filterByRadius(boid, this.boids, visionRadius)
    if (debugMode) this.ctx.strokeCircle(boid.position, visionRadius, { debug: true })
    if (debugMode) this.ctx.strokeCircle(boid.position, repulsionRadius, { debug: true })
    for (const otherBoid of attractiveBoid) {
      if (debugMode) {
        this.ctx.beginPath()
        this.ctx.moveTo(...boid.position.toArray())
        this.ctx.lineTo(...otherBoid.position.toArray())
        this.ctx.strokeStyle = 'blue'
        this.ctx.stroke()
        this.ctx.strokeStyle = 'black'
      }
      const distance = Point.distance(boid.position, otherBoid.position)
      const attractionForce = (distance - visionRadius) / visionRadius
      boid.velocity = boid.velocity.moveTowards(
        otherBoid.position,
        attractionForce * (attraction / 100)
      )
    }

    const repulsiveBoids = filterByRadius(boid, this.boids, repulsionRadius)
    for (const otherBoid of repulsiveBoids) {
      if (debugMode) {
        this.ctx.beginPath()
        this.ctx.moveTo(...boid.position.toArray())
        this.ctx.lineTo(...otherBoid.position.toArray())
        this.ctx.strokeStyle = 'magenta'
        this.ctx.stroke()
        this.ctx.strokeStyle = 'black'
      }
      const distance = Point.distance(boid.position, otherBoid.position)
      const repulsionForce = (repulsionRadius - distance) / repulsionRadius
      boid.velocity = boid.velocity.moveAway(otherBoid.position, repulsionForce * repulsion)
    }

    // enforce max speed
    const magnitude = boid.velocity.magnitude()
    if (magnitude > maxSpeed) {
      boid.velocity = boid.velocity.multiply(maxSpeed / magnitude / 0.8)
    }

    boid.position = boid.position.add(boid.velocity)

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

      if (increment % 50 === 0) boid.logPosition(tailLength)
      // if (Point.distance(startPos, boid.position) > 40) continue
      if (boid.previousPositions.length > 1) {
        this.ctx.beginPath()
        this.ctx.strokePath(boid.previousPositions)
        this.ctx.closePath()

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
