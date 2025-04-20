import { deg2, deg10, deg30, deg90, deg270, deg360 } from '../constants/angles'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randInt } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class Ferns extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('numStems', { name: 'baseStems', initialValue: 10, min: 1, max: 100, step: 1 }) // prettier-ignore
    this.addVar('minAngleDiff', { name: 'minAngleDiff', initialValue: deg10, min: 0, max: deg30, step: 0.01 }) // prettier-ignore
    this.addVar('angleRange', { name: 'angleRange', initialValue: deg30, min: 0, max: deg90, step: 0.01 }) // prettier-ignore
    this.addVar('baseSegments', { name: 'baseSegments', initialValue: 15, min: 1, max: 100, step: 1 }) // prettier-ignore
    this.addVar('segmentsVariation', { name: 'segmentsVariation', initialValue: 5, min: 0, max: 20, step: 1 }) // prettier-ignore
    this.addVar('bendRange', { name: 'bendRange', initialValue: deg2, min: 0, max: deg30, step: 0.01 }) // prettier-ignore
    this.addVar('baseStemLength', { name: 'baseStemLength', initialValue: 7, min: 2, max: 20, step: 0.2 }) // prettier-ignore
    this.addVar('stemLengthVariation', { name: 'stemLengthVariation', initialValue: 2.5, min: 0, max: 10, step: 0.2 }) // prettier-ignore
    this.vs.cutout = new BooleanRange({ name: 'cutout', initialValue: false })
  }

  prevAngles: number[] = []

  initDraw(): void {
    const { seed, numStems } = this.vars
    seedRandom(seed)
    seedNoise(seed)
    this.prevAngles = []
    for (let i = 0; i < numStems; i++) {
      this.drawStem()
    }
  }

  getLeafPts(pt: Point, initialAngle: number, size: number): [Point[], Point] {
    const midPt = pt.clone().moveAlongAngle(initialAngle, size)
    const pts: Point[] = [pt.clone()]
    const numPts = 36
    const rotateAngle = initialAngle + deg90
    const angleStep = deg360 / numPts
    for (let i = 0; i < numPts; i++) {
      const angle = deg90 + i * angleStep
      const untransformedPt = new Point(Math.cos(angle) * (size * 4), Math.sin(angle) * size)
      pts.push(untransformedPt.clone().rotate(rotateAngle).add(midPt))
    }
    return [pts, midPt]
  }

  drawStem() {
    const {
      gutter,
      bendRange,
      minAngleDiff,
      angleRange,
      baseStemLength,
      stemLengthVariation,
      baseSegments,
      segmentsVariation,
    } = this.vars
    const cutout = !!this.vs.cutout.value
    let pt = new Point(this.cw / 2, this.ch - gutter)
    let angle = deg270 + randFloat(angleRange)
    let panik = 0
    while (
      ++panik < 500 &&
      this.prevAngles.filter((a) => Math.abs(smallestSignedAngleDiff(a, angle)) < minAngleDiff)
        .length > 0
    )
      angle = deg270 + randFloat(angleRange)
    if (panik > 499) return
    this.prevAngles.push(angle)
    const angleStep = randFloat(bendRange)
    const numSegments = baseSegments + randInt(segmentsVariation)
    for (let i = 0; i < numSegments; i++) {
      const stemLength = baseStemLength + randFloat(stemLengthVariation)
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y)
      pt.moveAlongAngle(angle, stemLength)
      this.ctx.lineTo(pt.x, pt.y)
      this.ctx.stroke()

      const [leafPts, midPt] = this.getLeafPts(pt, angle, 1 + (i / 15) * 2)
      this.ctx.beginPath()
      // this.ctx.moveTo(pt.x, pt.y)
      this.ctx.strokePath([...leafPts, pt] as IntPoint[], { cutout })

      pt = midPt

      angle += angleStep
    }
  }

  draw(): void {
    //
  }
}
