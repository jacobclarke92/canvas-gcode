import {
  deg1,
  deg2,
  deg2p5,
  deg5,
  deg10,
  deg30,
  deg90,
  deg180,
  deg270,
  deg360,
} from '../constants/angles'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randBool, randFloat, randInt } from '../utils/numberUtils'
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
    this.addVar('angleRange', { name: 'angleRange', initialValue:   deg30, min: 0, max: deg90, step: 0.01 }) // prettier-ignore
    this.addVar('baseSegments', { name: 'baseSegments', initialValue: 15, min: 1, max: 100, step: 1 }) // prettier-ignore
    this.addVar('segmentsVariation', { name: 'segmentsVariation', initialValue: 5, min: 0, max: 20, step: 1 }) // prettier-ignore
    this.addVar('segQuality', { name: 'segQuality', initialValue: 36, min: 3, max: 72, step: 1 }) // prettier-ignore
    this.addVar('bendRange', { name: 'bendRange', initialValue: deg2, min: 0, max: deg30, step: 0.01 }) // prettier-ignore
    this.addVar('baseStemLength', { name: 'baseStemLength', initialValue: 7, min: 2, max: 20, step: 0.2 }) // prettier-ignore
    this.addVar('stemLengthVariation', { name: 'stemLengthVariation', initialValue: 2.5, min: 0, max: 10, step: 0.2 }) // prettier-ignore
    this.addVar('spiralSize', { name: 'spiralSize', initialValue: 0.5, min: 0.1, max: 10, step: 0.05 }) // prettier-ignore
    this.addVar('spiralPow', { name: 'spiralPow', initialValue: 2, min: 1, max: 10, step: 0.01 }) // prettier-ignore
    this.addVar('baseSpiralForce', { name: 'baseSpiralForce', initialValue: deg1, min: 0, max: deg5, step: 0.001 }) // prettier-ignore
    this.addVar('spiralFoldForce', { name: 'spiralFoldForce', initialValue: deg30, min: deg1, max: deg90, step: deg1 }) // prettier-ignore
    this.addVar('spiralIterations', { name: 'spiralIterations', initialValue: 100, min: 10, max: 500, step: 1 }) // prettier-ignore
    this.addVar('wiggleOscSpeed', { name: 'wiggleOscSpeed', initialValue: deg5, min: deg1, max: deg30, step: deg1 }) // prettier-ignore
    this.addVar('wiggleOscSpeedVariation', { name: 'wiggleOscSpeedVariation', initialValue: deg2p5, min: 0, max: deg10, step: 0.001 }) // prettier-ignore
    this.addVar('wiggleWidth', { name: 'wiggleWidth', initialValue: 5, min: 0.5, max: 20, step: 0.1 }) // prettier-ignore
    this.vs.cutout = new BooleanRange({ name: 'cutout', initialValue: false })
  }

  prevAngles: number[] = []

  initDraw(): void {
    const { seed, numStems } = this.vars
    seedRandom(seed)
    seedNoise(seed)
    this.prevAngles = []

    for (let i = 0; i < numStems; i++) {
      this.drawPoppy()
      this.drawWiggleStem()
      this.drawStem()
    }
  }

  getLeafPts(pt: Point, initialAngle: number, size: number): [Point[], Point] {
    const { segQuality } = this.vars
    const midPt = pt.clone().moveAlongAngle(initialAngle, size)
    const pts: Point[] = [pt.clone()]
    const rotateAngle = initialAngle + deg90
    const angleStep = deg360 / segQuality
    for (let i = 0; i < segQuality; i++) {
      const angle = deg90 + i * angleStep
      const untransformedPt = new Point(Math.cos(angle) * (size * 4), Math.sin(angle) * size)
      pts.push(untransformedPt.clone().rotate(rotateAngle).add(midPt))
    }
    return [pts, midPt]
  }

  drawSpiral({
    initialPt,
    initialAngle,
    speed,
    reverse,
  }: {
    initialPt: Point
    initialAngle: number
    speed: number
    reverse?: boolean
  }) {
    const { spiralFoldForce, spiralIterations, baseSpiralForce, spiralPow } = this.vars
    const pt = initialPt.clone()
    let angle = initialAngle
    this.ctx.beginPath()
    this.ctx.moveTo(pt.x, pt.y)
    for (let i = 0; i < spiralIterations; i++) {
      const percent = i / (spiralIterations * 2)
      angle +=
        (baseSpiralForce + Math.pow(percent, spiralPow) * spiralFoldForce) * (reverse ? -1 : 1) //+ angle / 100
      pt.moveAlongAngle(angle, speed)
      this.ctx.lineTo(pt.x, pt.y)
    }
    this.ctx.stroke()
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
      spiralSize,
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

    const reverse = randBool()
    const args: Parameters<(typeof this)['drawSpiral']>[0] = {
      initialPt: pt,
      initialAngle: angle,
      speed: spiralSize,
      reverse,
    }
    this.drawSpiral(args)
    if (randBool()) {
      this.drawSpiral({
        ...args,
        reverse: !reverse,
      })
    }
  }

  drawPoppy() {
    const {
      gutter,
      bendRange,
      angleRange,
      baseStemLength,
      stemLengthVariation,
      baseSegments,
      segmentsVariation,
    } = this.vars
    const cutout = !!this.vs.cutout.value
    const pt = new Point(this.cw / 2, this.ch - gutter)
    const angleStep = randFloat(bendRange)
    let angle = deg270 + randFloat(angleRange)

    const numSegments = baseSegments + randInt(segmentsVariation)
    this.ctx.beginPath()
    this.ctx.moveTo(pt.x, pt.y)
    for (let i = 0; i < numSegments; i++) {
      const stemLength = baseStemLength + randFloat(stemLengthVariation)
      pt.moveAlongAngle(angle, stemLength)
      this.ctx.lineTo(pt.x, pt.y)
      angle += angleStep
    }
    this.ctx.stroke()
    pt.moveAlongAngle(angle, 1.5)
    this.ctx.strokeCircle(pt, 1.5, { cutout })
  }

  drawWiggleStem() {
    const {
      gutter,
      bendRange,
      angleRange,
      wiggleOscSpeed,
      wiggleOscSpeedVariation,
      wiggleWidth,
      baseSegments,
      segmentsVariation,
      spiralSize,
    } = this.vars
    const cutout = !!this.vs.cutout.value
    const pt = new Point(this.cw / 2, this.ch - gutter)
    let actualPt = pt.clone()
    const angleStep = randFloat(bendRange / baseSegments)
    let angle = deg270 + randFloat(angleRange)
    const numSegments = (baseSegments + randInt(segmentsVariation)) * baseSegments
    const oscSpeed = wiggleOscSpeed + randFloat(wiggleOscSpeedVariation)
    let oscVal = 0

    this.ctx.beginPath()
    this.ctx.moveTo(pt.x, pt.y)
    for (let i = 0; i < numSegments; i++) {
      pt.moveAlongAngle(angle, 0.5)
      actualPt = new Point(Math.sin(oscVal) * wiggleWidth, 0).rotate(-angle + deg90).add(pt)
      this.ctx.lineTo(actualPt.x, actualPt.y)
      angle += angleStep
      oscVal += oscSpeed
    }
    this.ctx.stroke()
    // if (true || randBool()) {
    //   this.drawSpiral({
    //     initialPt: actualPt,
    //     initialAngle: +Math.sin(angle + oscVal) - deg90,
    //     speed: spiralSize,
    //     reverse: randBool(),
    //   })
    // }

    actualPt.moveAlongAngle(angle, 1.5)
    this.ctx.strokeCircle(actualPt, 1.5, { cutout })
  }

  draw(): void {
    //
  }
}
