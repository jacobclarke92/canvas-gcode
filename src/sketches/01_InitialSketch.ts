import { Sketch } from '../Sketch'
import type { Vector } from '../types'
import { randFloat, randInt, randIntRange, wrap } from '../utils/numberUtils'
import Range from './tools/Range'

export default class InitialSketch extends Sketch {
  pos: Vector
  static generateGCode = false
  static enableCutouts = false

  init() {
    this.pos = { x: this.canvasWidth / 2, y: this.canvasHeight / 2 }
    this.vs.xDrift = new Range({ name: 'x Drift', min: 0, max: 20, initialValue: 5 })
    this.vs.yDrift = new Range({ name: 'y Drift', min: 0, max: 20, initialValue: 5 })
    this.vs.circleMinRadius = new Range({ name: 'Min rad', min: 0, max: 25, initialValue: 3 })
    this.vs.circleMaxRadius = new Range({ name: 'Max rad', min: 0, max: 50, initialValue: 12 })
    this.vs.circleDrift = new Range({ name: 'Circle Drift', min: 0, max: 100, initialValue: 30 })
    this.vs.circleSpawnRate = new Range({ name: 'Spawn rate', min: 1, max: 300, step: 1, initialValue: 150 })
    this.vs.circleSpawnChance = new Range({ name: 'Spawn chance', min: 0, max: 1, initialValue: 0.5 })
  }

  initDraw() {
    if (this.vs.circleMaxRadius.value < this.vs.circleMinRadius.value) {
      this.vs.circleMaxRadius.setValue(this.vs.circleMinRadius.value, true)
    }
  }

  draw(increment: number) {
    this.pos.x = wrap(this.pos.x, this.canvasWidth)
    this.pos.y = wrap(this.pos.y, this.canvasHeight)

    if (increment % 100 === 0) this.ctx.strokeStyle = `#${(randIntRange(128) * 65793).toString(16)}`

    this.ctx.beginPath()
    this.ctx.moveTo(this.pos.x, this.pos.y)
    this.pos.x += randFloat(this.vs.xDrift.value)
    this.pos.y += randFloat(this.vs.yDrift.value)
    this.ctx.lineTo(this.pos.x, this.pos.y)
    this.ctx.stroke()
    this.ctx.closePath()

    if (increment % this.vs.circleSpawnRate.value === 0 && Math.random() < this.vs.circleSpawnChance.value) {
      const prevFillStyle = this.ctx.fillStyle
      const prevStrokeStyle = this.ctx.strokeStyle
      this.ctx.strokeStyle = `#000`
      this.ctx.fillStyle = `#${Math.floor(16777215 / 2 + randIntRange(16777215 / 2)).toString(16)}`
      this.ctx.beginPath()
      this.ctx.circle(
        this.pos.x + randInt(this.vs.circleDrift.value),
        this.pos.y + randInt(this.vs.circleDrift.value),
        randIntRange(this.vs.circleMaxRadius.value, this.vs.circleMinRadius.value)
      )
      this.ctx.fill()
      this.ctx.stroke()
      this.ctx.closePath()
      this.ctx.strokeStyle = prevStrokeStyle
      this.ctx.fillStyle = prevFillStyle
    }
  }
}
