import { Sketch } from '../Sketch'
import { degToRad, randFloat, randFloatRange, wrap } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Kaleido extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({
      initialValue: 1,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.stopAfter = new Range({
      initialValue: 20,
      min: 1,
      max: 420,
      step: 1,
      disableRandomize: true,
    })
    this.vs.maxRadius = new Range({
      initialValue: this.ch * 0.45,
      min: 1,
      max: this.ch * 0.5,
      step: 0.1,
      disableRandomize: true,
    })
    this.vs.angleOffset = new Range({
      initialValue: 0,
      min: 0,
      max: 90,
      step: 1,
      disableRandomize: true,
    })

    this.vs.seed = new Range({
      initialValue: 2222,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.vs.segments = new Range({ initialValue: 8, min: 2, max: 24, step: 2 })
    this.vs.maxHeightDiff = new Range({
      initialValue: 52,
      min: 0,
      max: this.vs.maxRadius.value * 2,
      step: 1,
    })
  }

  increment = 0

  initDraw(): void {
    this.vs.maxHeightDiff.max = this.vs.maxRadius.value
    if (this.vs.maxHeightDiff.value > this.vs.maxRadius.value * 2) {
      this.vs.maxHeightDiff.setValue(this.vs.maxRadius.value * 2, true)
    }
    seedRandom(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
    this.increment = 0
  }

  draw(increment: number): void {
    if (this.increment > this.vs.stopAfter.value) {
      penUp(this)
      return
    }
    const segAngle = degToRad(360 / this.vs.segments.value)
    for (let i = 0; i < this.vs.speedUp.value; i++) {
      this.increment++
      if (this.increment > this.vs.stopAfter.value) break

      const length1 = randFloatRange(this.vs.maxRadius.value)
      const length2 = wrap(
        length1 + randFloat(this.vs.maxHeightDiff.value / 2),
        this.vs.maxRadius.value,
        0
      )

      if (length1 === length2) continue

      for (let a = 0; a < this.vs.segments.value; a++) {
        const angle = segAngle * a + degToRad(this.vs.angleOffset.value)
        this.ctx.beginPath()
        this.ctx.moveTo(
          this.cx + Math.cos(angle) * (a % 2 ? length1 : length2),
          this.cy + Math.sin(angle) * (a % 2 ? length1 : length2)
        )
        this.ctx.lineTo(
          this.cx + Math.cos(angle + segAngle) * (a % 2 ? length2 : length1),
          this.cy + Math.sin(angle + segAngle) * (a % 2 ? length2 : length1)
        )
        this.ctx.stroke()
        this.ctx.endPath()
      }
    }
  }
}
