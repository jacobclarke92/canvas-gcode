import Point from '../Point'
import { Sketch } from '../Sketch'
import { random, seedRandom } from '../utils/random'
import Range from './tools/Range'

interface Circle {
  position: Point
  radius: number
}

export default class BubblesInCircle extends Sketch {
  static generateGCode = false

  redrawnCount: number
  reordered: boolean
  circles: Circle[]
  lastPoint: Point
  radius: number

  init() {
    this.vs.seed = new Range({ initialValue: 1391, min: 1000, max: 5000, step: 1 })
    this.vs.atLeast = new Range({ initialValue: 777, min: 1, max: 5000, step: 1, disableRandomize: true })
    this.vs.maxRadius = new Range({ initialValue: 300, min: 0.5, max: 45, step: 0.5, disableRandomize: true })
    this.vs.minRadius = new Range({ initialValue: 0.2, min: 0.1, max: 5, step: 0.05, disableRandomize: true })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    this.reordered = false
    this.redrawnCount = 0
    this.circles = []
    this.radius = Math.min(this.cw, this.ch) * 0.45
    this.ctx.beginPath()
    this.ctx.circle(this.cx, this.cy, this.radius)
    this.ctx.stroke()
    this.ctx.closePath()
  }

  draw(increment: number): void {
    if (this.circles.length > this.vs.atLeast.value) {
      if (!this.reordered) {
        const center = new Point(this.cx, this.cy)
        this.circles.sort((a, b) => Point.distance(center, b.position) - Point.distance(center, a.position))
        this.ctx.reset()
        this.ctx.beginPath()
        this.ctx.circle(this.cx, this.cy, this.radius)
        this.ctx.stroke()
        this.ctx.closePath()
        this.reordered = true
      } else {
        if (this.redrawnCount < this.circles.length) {
          const circle = this.circles[this.redrawnCount]
          this.ctx.beginPath()
          this.ctx.circle(circle.position.x, circle.position.y, circle.radius)
          this.ctx.stroke()
          this.ctx.closePath()
          this.redrawnCount++
        }
      }
      return
    }

    const angle = random() * Math.PI * 2
    const dist = random() * this.radius
    const point = new Point(this.cx + Math.cos(angle) * dist, this.cy + Math.sin(angle) * dist)

    let newRadius = 0
    let allowed = true

    const distToEdge = this.radius - Point.distance(new Point(this.cx, this.cy), point)
    if (!this.circles.length) {
      newRadius = distToEdge
    } else {
      const radiuses: number[] = []
      for (let circle of this.circles) {
        const dist = Point.distance(circle.position, point)
        if (dist <= circle.radius) {
          allowed = false
          continue
        }
        radiuses.push(dist - circle.radius)
      }
      radiuses.sort((a, b) => a - b)
      newRadius = radiuses[0]
      if (allowed && newRadius > distToEdge) {
        newRadius = distToEdge
      }
    }
    if (newRadius > this.vs.maxRadius.value || newRadius < this.vs.minRadius.value) {
      allowed = false
    }

    if (allowed && newRadius > 0) {
      this.circles.push({
        position: point,
        radius: newRadius,
      })
      this.ctx.beginPath()
      this.ctx.circle(point.x, point.y, newRadius)
      this.ctx.stroke()
      this.ctx.closePath()
    }
  }
}
