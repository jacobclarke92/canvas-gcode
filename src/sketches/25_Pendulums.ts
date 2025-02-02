import Point from '../Point'
import { Sketch } from '../Sketch'
import { randFloat } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pos = [number, number]

const MAX_PENDULUMS = 10

export default class Pendulums extends Sketch {
  // static generateGCode = false

  stopDrawing = false
  increment = 0
  startPos: Point | null = null
  lastPos: Point | null = null
  angles: number[] = []

  init() {
    this.addVar('speedUp', {
      initialValue: 1,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('randSeed', {
      initialValue: 5321,
      min: 1000,
      max: 10000,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('stopAfter', {
      initialValue: 50000,
      min: 5,
      max: 100000,
      step: 1,
      disableRandomize: true,
    })
    this.vs.debugLines = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })

    this.addVar('closeShapeThresh', {
      initialValue: 90,
      min: 20,
      max: 500,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('pendulums', {
      initialValue: 3,
      min: 1,
      max: MAX_PENDULUMS,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('pendLengthStart', {
      initialValue: 30,
      min: 1,
      max: 50,
      step: 1,
    })
    this.addVar('pendLengthFalloff', {
      initialValue: 0.5,
      min: 0.01,
      max: 1.5,
      step: 0.01,
    })

    for (let i = 0; i < MAX_PENDULUMS; i++) {
      this.addVar(`pend${i}speed`, {
        initialValue: i === 0 ? 3.2 : 1,
        min: -25,
        max: 25,
        step: 0.05,
      })
      this.angles[i] = 0
    }
  }

  initDraw(): void {
    seedRandom(this.vars.randSeed)
    initPen(this)
    plotBounds(this)
    this.stopDrawing = false
    this.increment = 0
    this.startPos = null
    this.lastPos = null
    this.angles.fill(0, 0, this.vars.pendulums)
  }

  draw(increment: number): void {
    if (this.stopDrawing) return

    const { pendulums, pendLengthStart, pendLengthFalloff, closeShapeThresh } = this.vars

    // this.ctx.ctx?.clearRect(0, 0, this.cw, this.ch)

    for (let i = 0; i < this.vars.speedUp; i++) {
      this.increment++
      if (this.increment > this.vars.stopAfter) {
        this.stopDrawing = true
        penUp(this)
        break
      }

      const pos = new Point(this.cw / 2, this.ch / 2)
      let pendulumLength = pendLengthStart
      for (let i = 0; i < pendulums; i++) {
        this.angles[i] += this.vars[`pend${i}speed`] / 100
        if (this.vs.debugLines.value) this.ctx.beginPath()
        if (this.vs.debugLines.value) this.ctx.moveTo(pos.x, pos.y)
        pos.x += Math.cos(this.angles[i]) * pendulumLength
        pos.y += Math.sin(this.angles[i]) * pendulumLength
        if (this.vs.debugLines.value) this.ctx.lineTo(pos.x, pos.y)
        if (this.vs.debugLines.value) this.ctx.stroke()
        if (this.vs.debugLines.value) this.ctx.endPath()
        pendulumLength *= pendLengthFalloff
      }
      if (this.lastPos) {
        this.ctx.beginPath()
        this.ctx.moveTo(this.lastPos.x, this.lastPos.y)
        this.ctx.lineTo(pos.x, pos.y)
        this.ctx.stroke()
        this.ctx.endPath()

        if (
          this.increment > 100 &&
          pos.distanceTo(this.startPos) < pendLengthStart / closeShapeThresh
        ) {
          this.ctx.beginPath()
          this.ctx.moveTo(pos.x, pos.y)
          this.ctx.lineTo(this.startPos.x, this.startPos.y)
          this.ctx.stroke()
          this.ctx.endPath()

          console.log('STOPPED')
          this.stopDrawing = true
          break
        }
      } else {
        this.startPos = pos.clone()
      }

      this.lastPos = pos.clone()
    }
  }
}
