import * as clipperLib from 'js-angusj-clipper/web'

import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randInt, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class WiggleGrid extends Sketch {
  // static generateGCode = false
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('speedUp',{ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('seed', { name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 })
    this.addVar('rings', { name: 'rings', initialValue: 160, min: 3, max: 200, step: 1 })
    this.addVar('complexityReduction',{ name: 'complexityReduction', initialValue: 5.6, min: 0, max: 12, step: 0.05 }) // prettier-ignore
    this.addVar('minCircleRes',{ name: 'minCircleRes', initialValue: 32, min: 3, max: 256, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('maxCircleRes',{ name: 'maxCircleRes', initialValue: 1000, min: 3, max: 1000, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('noiseRadiusInfluence',{ name: 'noiseRadiusInfluence', initialValue: 1, min: 0, max: 25, step: 0.01 }) // prettier-ignore
    this.addVar('noiseAngleInfluence',{ name: 'noiseAngleInfluence', initialValue: 0, min: 0, max: 2.5, step: 0.01 }) // prettier-ignore

    this.addVar('perlinDiv',{ name: 'perlinDiv', initialValue: 6, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('offsetX', { name: 'offsetX', initialValue: 0, min: -250, max: 250, step: 1 })
    this.addVar('offsetY', { name: 'offsetY', initialValue: 0, min: -250, max: 250, step: 1 })

    this.addVar('outerGap',{ initialValue: 6, min: -25, max: 25, step: 1, disableRandomize: true }) // prettier-ignore

    this.addVar('gridEdges', { name: 'gridEdges', initialValue: 4, min: 3, max: 96, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('pathDivisions', { initialValue: 96, min: 3, max: 1024, step: 1 })

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

  private done = false
  private drawCount = 0
  private effectiveWidth: number
  private effectiveHeight: number
  private firstRing: Point[] = []

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    this.drawCount = 0
    this.done = false
  }

  draw(increment: number): void {
    const {
      speedUp,
      rings,
      noiseRadiusInfluence,
      noiseAngleInfluence,
      complexityReduction,
      minCircleRes,
      maxCircleRes,
      perlinDiv,
      offsetX,
      offsetY,
      outerGap,
      gridEdges,
      pathDivisions,
    } = this.vars

    if (this.done) return

    for (let s = 0; s < speedUp; s++) {
      const ringSpacing = this.effectiveHeight / 2 / rings
      const baseRadius = (this.drawCount + 1) * ringSpacing

      this.ctx.strokeStyle = '#35bbca'
      if (this.drawCount >= rings) {
        stopAndWigglePen(this)

        this.ctx.strokeStyle = 'red' // '#D3dd18'

        const gridReduction = Math.sqrt(ringSpacing * ringSpacing * 2)
        let gridRadius = (this.ch - outerGap * 2) / 2
        gridRadius = Math.sqrt(gridRadius * gridRadius * 2)
        if (gridEdges === 3) gridRadius *= 1.5
        else gridRadius *= 1.2
        while (gridRadius > ringSpacing) {
          this.ctx.beginPath()

          const randRingOffset = gridEdges > 12 ? randIntRange(gridEdges, 0) : 0
          for (let i = 0; i < gridEdges + 1; i++) {
            const index = (i + randRingOffset) % gridEdges
            const angle = (index / gridEdges) * Math.PI * 2
            const x = this.cx + Math.cos(angle - Math.PI / 4) * gridRadius
            const y = this.cy + Math.sin(angle - Math.PI / 4) * gridRadius
            if (i === 0) this.ctx.moveTo(x, y)
            else this.ctx.lineTo(x, y)
          }
          for (let i = 0; i < this.firstRing.length + 1; i++) {
            const pt = this.firstRing[i % this.firstRing.length]
            if (i === 0) this.ctx.moveTo(pt.x, pt.y)
            else this.ctx.lineTo(pt.x, pt.y)
          }

          const { intersected } = this.ctx.clipCurrentPath({
            clipType: clipperLib.ClipType.Intersection,
            pathDivisions,
            subjectIsOpen: true,
            inputsAreOpen: false,
            clipFillType: clipperLib.PolyFillType.NonZero,
          })

          if (!intersected) this.ctx.stroke()
          else this.ctx.path = new Path()
          gridRadius -= gridReduction
        }

        penUp(this)
        this.done = true
        return
      }

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
      const randRingOffset = randIntRange(ring.length, 0)
      for (let i = 0; i < ring.length; i++) {
        const index = (i + randRingOffset) % ring.length
        const pt = ring[index]
        if (i === 0) this.ctx.moveTo(pt.x, pt.y)
        else this.ctx.lineTo(pt.x, pt.y)
        if (i === ring.length - 1) {
          this.ctx.lineTo(
            ring[randRingOffset % ring.length].x,
            ring[randRingOffset % ring.length].y
          )
        }
      }
      this.ctx.stroke()
      this.ctx.endPath()

      this.drawCount++
      if (this.drawCount === rings) {
        this.firstRing = ring
      }
    }
  }
}
