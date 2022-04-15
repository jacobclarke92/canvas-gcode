import { Sketch } from '../Sketch'
import { Vector } from '../types'
import { randFloat, randInt, wrap } from '../utils'

export default class InitialSketch extends Sketch {
  pos: Vector

  init() {
    this.pos = { x: this.canvasWidth / 2, y: this.canvasHeight / 2 }
  }

  draw(increment: number) {
    this.pos.x = wrap(this.pos.x, this.canvasWidth)
    this.pos.y = wrap(this.pos.y, this.canvasHeight)

    if (increment % 100 === 0) this.ctx.strokeStyle = `#${randInt(0xffffff).toString(16)}`
    this.ctx.beginPath()
    this.ctx.moveTo(this.pos.x, this.pos.y)
    this.pos.x += randFloat(5, -5)
    this.pos.y += randFloat(5, -5)
    this.ctx.lineTo(this.pos.x, this.pos.y)
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
