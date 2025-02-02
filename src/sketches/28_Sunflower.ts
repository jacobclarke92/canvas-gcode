import { deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class Sunflower extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.useCircle = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.speedUp = new Range({ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.seed = new Range({ name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 }, this) // prettier-ignore
    this.vs.rings = new Range({ name: 'rings', initialValue: 16, min: 3, max: 80, step: 1 }, this) // prettier-ignore
    this.vs.complexityReduction = new Range({ name: 'complexityReduction', initialValue: 4, min: 0, max: 12, step: 0.05 }, this) // prettier-ignore
    this.vs.drawSize = new Range({ name: 'drawSize', initialValue: 0.75, min: 0.05, max: 30, step: 0.01 }, this) // prettier-ignore
    this.vs.noiseSizeInfluence = new Range({ name: 'noiseSizeInfluence', initialValue: 1, min: 0, max: 5, step: 0.01 }, this) // prettier-ignore
    this.vs.noiseAngleInfluence = new Range({ name: 'noiseAngleInfluence', initialValue: 0, min: 0, max: 1, step: 0.01 }, this) // prettier-ignore

    this.vs.perlinDiv = new Range({ name: 'perlinDiv', initialValue: 25, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.offsetX = new Range({ name: 'offsetX', initialValue: 0, min: -100, max: 100, step: 1 }, this) // prettier-ignore
    this.vs.offsetY = new Range({ name: 'offsetY', initialValue: 0, min: -100, max: 100, step: 1 }, this) // prettier-ignore

    this.vs.outerGap = new Range({ initialValue: 12, min: 0, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore

    // BACK IN A BIT
    // setInterval(() => {
    //   this.reset()
    //   Object.values(this.vs).forEach((v) => v.randomize())
    //   this.initDraw()
    // }, 5000)
  }

  private drawCount = 0
  private effectiveWidth: number
  private effectiveHeight: number

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)

    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    this.drawCount = 0
  }

  draw(increment: number): void {
    const {
      rings,
      noiseSizeInfluence,
      noiseAngleInfluence,
      complexityReduction,
      drawSize,
      perlinDiv,
      offsetX,
      offsetY,
    } = this.vars

    if (this.drawCount >= rings) return

    const ringSpacing = this.effectiveHeight / 2 / rings

    // for (let i = 0; i < speedUp; i++) {
    const radius = (this.drawCount + 1) * ringSpacing

    const ringPts = Math.max(4, Math.ceil(this.drawCount * complexityReduction))

    for (let t = 0; t < ringPts; t++) {
      const baseAngle = (t / ringPts) * deg360
      const basePt = new Point(
        this.cx + Math.cos(baseAngle) * radius,
        this.cy + Math.sin(baseAngle) * radius
      )

      const angleMod =
        perlin2((basePt.x + offsetX) / perlinDiv, (basePt.y + offsetY) / perlinDiv) *
        noiseAngleInfluence

      const pt = new Point(
        this.cx + Math.cos(baseAngle + angleMod) * radius,
        this.cy + Math.sin(baseAngle + angleMod) * radius
      )

      const radiusMod =
        perlin2((pt.x + offsetX) / perlinDiv, (pt.y + offsetY) / perlinDiv) * noiseSizeInfluence

      // debugDot(this.ctx, pt)
      this.ctx.beginPath()
      if (this.vs.useCircle.value) {
        this.ctx.strokeCircle(pt.x, pt.y, Math.abs(drawSize + radiusMod))
      } else {
        this.ctx.moveTo(
          pt.x + (Math.cos(baseAngle) * drawSize) / 2,
          pt.y + (Math.sin(baseAngle) * drawSize) / 2
        )
        this.ctx.lineTo(
          pt.x + (Math.cos(baseAngle) * -drawSize) / 2,
          pt.y + (Math.sin(baseAngle) * -drawSize) / 2
        )
        this.ctx.stroke()
      }
      this.ctx.endPath()
    }
    this.drawCount++

    // debugDot(this.ctx, this.cw / 2, this.ch / 2)
    // }
  }
}
