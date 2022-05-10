import Point from '../Point'
import { Sketch } from '../Sketch'
import { perlin2 } from '../utils/noise'
import { degToRad, normalizeRadian, randFloat, randFloatRange, randInt, randIntRange, wrap } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class KaleidoCurve extends Sketch {
  // static generateGCode = false

  init() {
    this.vs.speedUp = new Range({ initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.stopAfter = new Range({ initialValue: 20, min: 1, max: 420, step: 1, disableRandomize: true })
    this.vs.maxRadius = new Range({
      initialValue: this.ch * 0.45,
      min: 1,
      max: this.ch * 0.5,
      step: 0.1,
      disableRandomize: true,
    })
    this.vs.angleOffset = new Range({ initialValue: 0, min: 0, max: 90, step: 1, disableRandomize: true })

    this.vs.perlinDivX = new Range({ initialValue: 75, min: 1, max: 100, step: 1 })
    this.vs.perlinDivY = new Range({ initialValue: 75, min: 1, max: 100, step: 1 })
    this.vs.perlinOffsetX = new Range({ initialValue: 0, min: -100, max: 100, step: 1 })
    this.vs.perlinOffsetY = new Range({ initialValue: 0, min: -100, max: 100, step: 1 })

    this.vs.seed = new Range({ initialValue: 2222, min: 1000, max: 5000, step: 1 })
    this.vs.segments = new Range({ initialValue: 8, min: 2, max: 24, step: 2 })
    this.vs.maxHeightDiff = new Range({ initialValue: 120, min: 0, max: this.vs.maxRadius.value, step: 1 })
    this.vs.curveRange = new Range({ initialValue: 0.5, min: 0, max: 5, step: 0.005 })
    this.vs.maxCurveStrength = new Range({ initialValue: 50, min: 0, max: 90, step: 1 })
  }

  increment = 0

  initDraw(): void {
    this.vs.maxHeightDiff.max = this.vs.maxRadius.value
    if (this.vs.maxHeightDiff.value > this.vs.maxRadius.value)
      this.vs.maxHeightDiff.setValue(this.vs.maxRadius.value, true)

    seedRandom(this.vs.seed.value)
    this.increment = 0
  }

  draw(increment: number): void {
    if (this.increment > this.vs.stopAfter.value) return
    const segAngle = degToRad(360 / this.vs.segments.value)
    for (let i = 0; i < this.vs.speedUp.value; i++) {
      this.increment++
      if (this.increment > this.vs.stopAfter.value) break

      const length1 = randFloatRange(this.vs.maxRadius.value)
      const length2 = wrap(length1 + randFloat(this.vs.maxHeightDiff.value / 2), this.vs.maxRadius.value, 0)

      const lengthPerlin = perlin2(
        (length1 + this.vs.perlinOffsetX.value) / this.vs.perlinDivX.value,
        (length2 + this.vs.perlinOffsetY.value) / this.vs.perlinDivY.value
      )
      const curveAngle = lengthPerlin * this.vs.curveRange.value * segAngle * 2 + segAngle / 2
      const curveLength = randFloatRange(this.vs.maxCurveStrength.value)

      if (length1 === length2) continue

      for (let a = 0; a < this.vs.segments.value; a++) {
        const angle = segAngle * a + degToRad(this.vs.angleOffset.value)
        this.ctx.beginPath()
        this.ctx.moveTo(
          this.cx + Math.cos(angle) * (a % 2 ? length1 : length2),
          this.cy + Math.sin(angle) * (a % 2 ? length1 : length2)
        )
        this.ctx.quadraticCurveTo(
          this.cx + Math.cos(angle + curveAngle) * curveLength,
          this.cy + Math.sin(angle + curveAngle) * curveLength,
          this.cx + Math.cos(angle + segAngle) * (a % 2 ? length2 : length1),
          this.cy + Math.sin(angle + segAngle) * (a % 2 ? length2 : length1)
        )
        this.ctx.stroke()
        this.ctx.closePath()
      }
    }
  }
}
