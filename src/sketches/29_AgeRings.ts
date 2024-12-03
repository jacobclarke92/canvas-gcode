import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class AgeRings extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.seed = new Range({ name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 }, this) // prettier-ignore
    this.vs.rings = new Range({ name: 'rings', initialValue: 24, min: 3, max: 120, step: 1 }, this) // prettier-ignore
    this.vs.complexityReduction = new Range({ name: 'complexityReduction', initialValue: 4, min: 0, max: 12, step: 0.05 }, this) // prettier-ignore
    this.vs.minCircleRes = new Range({ name: 'minCircleRes', initialValue: 8, min: 3, max: 256, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.maxCircleRes = new Range({ name: 'maxCircleRes', initialValue: 1000, min: 3, max: 1000, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.noiseRadiusInfluence = new Range({ name: 'noiseRadiusInfluence', initialValue: 1, min: 0, max: 25, step: 0.01 }, this) // prettier-ignore
    this.vs.noiseAngleInfluence = new Range({ name: 'noiseAngleInfluence', initialValue: 0, min: 0, max: 2.5, step: 0.01 }, this) // prettier-ignore

    this.vs.perlinDiv = new Range({ name: 'perlinDiv', initialValue: 25, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.offsetX = new Range({ name: 'offsetX', initialValue: 0, min: -100, max: 100, step: 1 }, this) // prettier-ignore
    this.vs.offsetY = new Range({ name: 'offsetY', initialValue: 0, min: -100, max: 100, step: 1 }, this) // prettier-ignore

    this.vs.outerGap = new Range({ initialValue: 12, min: -25, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore

    // BACK IN A BIT
    // setInterval(() => {
    //   this.reset()
    //   Object.values(this.vs).forEach((v) => v.randomize())
    //   this.initDraw()
    // }, 5000)

    // setInterval(() => {
    //   this.reset()
    //   this.vs.offsetX.setValue(this.vs.offsetX.value + 1)
    //   this.initDraw()
    // }, 1000 / 30)
  }

  private drawCount = 0
  private effectiveWidth: number
  private effectiveHeight: number

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    this.drawCount = 0
  }

  draw(increment: number): void {
    const {
      rings,
      noiseRadiusInfluence,
      noiseAngleInfluence,
      complexityReduction,
      minCircleRes,
      maxCircleRes,
      perlinDiv,
      offsetX,
      offsetY,
    } = this.vars

    if (this.drawCount >= rings) {
      penUp(this)
      return
    }

    const ringSpacing = this.effectiveHeight / 2 / rings

    const baseRadius = (this.drawCount + 1) * ringSpacing

    const ringPts = Math.min(
      maxCircleRes,
      Math.max(minCircleRes, Math.ceil(this.drawCount * complexityReduction))
    )

    const ring: Point[] = []
    for (let t = 0; t < ringPts; t++) {
      const baseAngle = (t / ringPts) * Math.PI * 2
      const basePt = new Point(
        this.cx + Math.cos(baseAngle) * baseRadius,
        this.cy + Math.sin(baseAngle) * baseRadius
      )

      const angleMod =
        perlin2((basePt.x + offsetX) / perlinDiv, (basePt.y + offsetY) / perlinDiv) *
        noiseAngleInfluence

      const radiusMod =
        perlin2((basePt.x + offsetX) / perlinDiv, (basePt.y + offsetY) / perlinDiv) *
        noiseRadiusInfluence

      const radius = Math.max(0, baseRadius + radiusMod)

      const pt = new Point(
        this.cx + Math.cos(baseAngle + angleMod) * radius,
        this.cy + Math.sin(baseAngle + angleMod) * radius
      )

      ring.push(pt)
    }

    this.ctx.beginPath()
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i]
      if (i === 0) this.ctx.moveTo(pt.x, pt.y)
      else this.ctx.lineTo(pt.x, pt.y)
      if (i === ring.length - 1) {
        this.ctx.lineTo(ring[0].x, ring[0].y)
      }
    }
    this.ctx.stroke()
    this.ctx.closePath()

    this.drawCount++
  }
}
