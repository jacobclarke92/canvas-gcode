import { Sketch } from '../Sketch'
import type { Vector } from '../types'
import { randFloat, randInt, randIntRange, wrap } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import Range from './tools/Range'

export default class Calibration extends Sketch {
  pos: Vector
  static generateGCode = true
  static enableCutouts = false

  init() {
    //
  }

  initDraw() {
    //
    initPen(this)
    plotBounds(this)

    const offset = 0

    /**
     * Horizontal lines
     */
    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + 10, offset + (i + 1) * 10 - 2)
      this.ctx.lineTo(offset + 10, offset + (i + 1) * 10 + 2)
      this.ctx.lineTo(offset + 10, offset + (i + 1) * 10 + 2)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + this.cw / 2 - i * 12, offset + (i + 1) * 10 - 2)
      this.ctx.lineTo(offset + this.cw / 2 - i * 12, offset + (i + 1) * 10 + 2)
      this.ctx.lineTo(offset + this.cw / 2 - i * 12, offset + (i + 1) * 10 - 2)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + 10, offset + (i + 1) * 10)
      this.ctx.lineTo(offset + this.cw / 2 - i * 12, offset + (i + 1) * 10)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    /**
     * Vertical lines
     */

    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + this.cw - (i + 1) * 10 - 2, offset + 10)
      this.ctx.lineTo(offset + this.cw - (i + 1) * 10 + 2, offset + 10)
      this.ctx.lineTo(offset + this.cw - (i + 1) * 10 - 2, offset + 10)
      this.ctx.stroke()
      this.ctx.endPath()
    }

    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + this.cw - (i + 1) * 10 - 2, offset + this.ch - 16 * (i + 1))
      this.ctx.lineTo(offset + this.cw - (i + 1) * 10 + 2, offset + this.ch - 16 * (i + 1))
      this.ctx.lineTo(offset + this.cw - (i + 1) * 10 - 2, offset + this.ch - 16 * (i + 1))
      this.ctx.stroke()
      this.ctx.endPath()
    }

    for (let i = 0; i < 10; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(offset + this.cw - (i + 1) * 10, offset + 10)
      this.ctx.lineTo(offset + this.cw - (i + 1) * 10, offset + this.ch - 16 * (i + 1))
      this.ctx.stroke()
      this.ctx.endPath()
    }

    const rectSize = 2
    const rectGrow = 2
    const gap = 1
    for (let i = 0; i < 10; i++) {
      this.ctx.strokeRect(
        offset + 10 + i * (rectGrow + i * gap),
        offset + this.ch - 10 - rectSize - i * rectGrow,
        rectSize + i * rectGrow,
        rectSize + i * rectGrow
      )
    }

    penUp(this)
  }

  draw(increment: number) {
    //
  }
}
