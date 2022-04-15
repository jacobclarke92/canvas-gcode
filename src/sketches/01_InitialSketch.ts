import { Sketch } from '../Sketch'
import { Vector } from '../types'
import { randFloat, randInt, wrap } from '../utils/numberUtils'

export default class InitialSketch extends Sketch {
  pos: Vector

  init() {
    this.pos = { x: this.canvasWidth / 2, y: this.canvasHeight / 2 }
  }

  draw(increment: number) {
    this.pos.x = wrap(this.pos.x, this.canvasWidth)
    this.pos.y = wrap(this.pos.y, this.canvasHeight)

    if (increment % 100 === 0) this.ctx.strokeStyle = `#${(randInt(128) * 65793).toString(16)}`

    this.ctx.beginPath()
    this.ctx.moveTo(this.pos.x, this.pos.y)
    this.pos.x += randFloat(5, -5)
    this.pos.y += randFloat(5, -5)
    this.ctx.lineTo(this.pos.x, this.pos.y)
    this.ctx.stroke()
    this.ctx.closePath()

    if (increment % 150 === 0 && Math.random() > 0.5 && 'circle' in this.ctx) {
      const prevFillStyle = this.ctx.fillStyle
      const prevStrokeStyle = this.ctx.strokeStyle
      this.ctx.strokeStyle = `#000`
      this.ctx.fillStyle = `#${Math.floor(16777215 / 2 + randInt(16777215 / 2)).toString(16)}`
      this.ctx.beginPath()
      this.ctx.circle(this.pos.x + randInt(30, -30), this.pos.y + randInt(30, -30), randFloat(12, 3))
      this.ctx.fill()
      this.ctx.stroke()
      this.ctx.closePath()
      this.ctx.strokeStyle = prevStrokeStyle
      this.ctx.fillStyle = prevFillStyle
    }
  }
}
