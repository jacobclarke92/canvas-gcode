import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { isInBounds } from '../utils/geomUtils'
import { initPen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

const milli = 1000000

const tendrilToLines = (tendril: Point[]): Line[] => {
  const lines: Line[] = []
  for (let i = 0; i < tendril.length - 1; i++) {
    lines.push([tendril[i], tendril[i + 1]])
  }
  return lines
}

export default class Genuary8 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 128, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { disableRandomize: true, initialValue: 3, min: 0, max: 100, step: 0.1 })
    // this.addVar('minSegLength', { initialValue: 2, min: 1, max: 24, step: 1 })
    this.addVar('maxSegLength', { initialValue: 8, min: 1, max: 24, step: 1 })
    this.addVar('var1', { initialValue: 25, min: 1, max: 50, step: 1 })
    this.addVar('var2', { initialValue: 20, min: 1, max: 50, step: 1 })
    this.addVar('maxTendrils', { initialValue: 160, min: 1, max: 1000, step: 1 })

    this.vs.debugColors = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  drawn = 0

  pos: Point = new Point(this.cw / 2, this.ch / 2)
  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    // plotBounds(this)
    // Challenge: Draw a million of something

    this.drawn = 0
    this.pos = new Point(this.cw / 2, this.ch / 2)

    // this.ctx.dot(this.cw / 2, this.ch / 2)
    // this.ctx.dot(this.cw / 2 + 10, this.ch / 2)
    // this.ctx.dot(this.cw / 2 + 10, this.ch / 2 + 10)
    // this.ctx.dot(this.cw / 2, this.ch / 2 + 10)
    // this.ctx.stroke()
  }

  draw(increment: number): void {
    //
    const { var1, var2 } = this.vars

    let frame = increment * this.vars.speedUp
    if (frame > milli) return
    if (increment % 1000 === 0) document.title = `Genuary 8: ${increment * this.vars.speedUp}`
    for (let i = 0; i < this.vars.speedUp; i++) {
      const percent = frame / milli
      frame++
      if (this.drawn > milli) {
        // this.ctx.stroke()
        break
      }
      this.pos.add(
        Math.cos(frame / 4 / ((1 - percent) * var1)) * (frame / 7500 / ((1 - percent) * var2)),
        Math.sin(frame / 4 / ((1 - percent) * var1)) * (frame / 7500 / ((1 - percent) * var2))
      )
      this.pos.add(
        //
        (this.cp.x - this.pos.x) / 8,
        (this.cp.y - this.pos.y) / 8
      )
      // if (this.cp.distanceTo(this.pos) > 20) {
      if (isInBounds(this.pos, [0, this.cw, this.ch, 0])) {
        this.ctx.ctx.beginPath()
        this.ctx.dot(...this.pos.toArray())
        this.drawn++
      }
      // }
    }
  }
}
