import Point from '../Point'
import { Sketch } from '../Sketch'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import Range from './tools/Range'

interface Stem {
  position: Point
  angle: number
  length: number
}

export default class Tree extends Sketch {
  // static generateGCode = false

  init() {
    // this.vs.speedUp = new Range({ initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.seed = new Range({ initialValue: 2222, min: 1000, max: 5000, step: 1 })
    this.vs.initBranchLength = new Range({ initialValue: 8, min: 5, max: 10, step: 0.1 })
    this.vs.branchLengthFalloff = new Range({ initialValue: 0.83, min: 0.4, max: 0.9, step: 0.005 })
    this.vs.splitProbability = new Range({ initialValue: 0.6, min: 0, max: 1, step: 0.005 })
    this.vs.pruneProbability = new Range({ initialValue: 0.95, min: 0, max: 1, step: 0.05 })
    this.vs.bloomProbability = new Range({ initialValue: 0.6, min: 0, max: 1, step: 0.05 })
    this.vs.bloomSize = new Range({ initialValue: 0.3, min: 0.2, max: 1.2, step: 0.1 })
    this.vs.splitAngleRange = new Range({ initialValue: 0.44, min: 0, max: Math.PI / 2, step: Math.PI / 256 })
    this.vs.splitAngleBranchLevelMulti = new Range({ initialValue: 0.1, min: -1, max: 1, step: 0.05 })
    this.vs.splitAngleMinPercent = new Range({ initialValue: 0.5, min: 0, max: 1, step: 0.05 })
    this.vs.chaosFactor = new Range({ initialValue: 0.85, min: 0, max: 2, step: 0.01 })
    this.vs.splitCount = new Range({ initialValue: 2, min: 2, max: 5, step: 1, disableRandomize: true })
    this.vs.maxBranchLevels = new Range({ initialValue: 14, min: 1, max: 24, step: 1, disableRandomize: true })
  }

  private branchLevel: number = 0
  private drawnCurrentStems: number = 0
  private currentStems: Stem[] = []
  private nextStems: Stem[] = []

  initDraw(): void {
    seedRandom(this.vs.seed.value)

    this.branchLevel = 0
    this.drawnCurrentStems = 0
    this.currentStems = []
    this.nextStems = []

    const branchLengthFalloff = this.vs.branchLengthFalloff.value
    const initBranchLength = this.vs.initBranchLength.value

    const length = initBranchLength / branchLengthFalloff
    const angle = -Math.PI / 2
    const position = this.drawBranch(new Point(this.cx, this.ch - 10), angle, length)
    this.currentStems.push({ position, angle, length })
  }

  draw(increment: number): void {
    if (this.branchLevel > this.vs.maxBranchLevels.value) return
    if (this.drawnCurrentStems >= this.currentStems.length) {
      // time to calculate new stems
      this.currentStems = [...this.nextStems]
      this.nextStems = []
      this.branchLevel++
      this.drawnCurrentStems = 0
    } else {
      // draw current stems
      const stem = this.currentStems[this.drawnCurrentStems]

      const branchLengthFalloff = this.vs.branchLengthFalloff.value
      const splitProbability = this.branchLevel < 3 ? 1 : this.vs.splitProbability.value
      const splitAngleRange = this.vs.splitAngleRange.value
      const splitAngleBranchLevelMulti = this.vs.splitAngleBranchLevelMulti.value
      const splitAngleMinPercent = this.vs.splitAngleMinPercent.value
      const pruneProbability = this.vs.pruneProbability.value
      const bloomProbability = this.vs.bloomProbability.value
      const chaosFactor = this.vs.chaosFactor.value

      const doSplit = random() <= splitProbability

      if (!doSplit) {
        // draw branch
        const angle = stem.angle + randFloat((Math.PI * chaosFactor) / 10)
        const length = stem.length * branchLengthFalloff * (1 + randFloat(chaosFactor / 8))
        const endPoint = this.drawBranch(stem.position, angle, length)
        if (this.branchLevel !== this.vs.maxBranchLevels.value && random() > pruneProbability) {
          this.nextStems.push({
            position: endPoint,
            angle,
            length,
          })
        } else if (random() < bloomProbability) {
          this.drawBloom(endPoint, angle)
        }
      } else {
        const splitInto = this.vs.splitCount.value
        const adjustedSplitAngleRange = splitAngleRange * (1 + (splitAngleBranchLevelMulti * this.branchLevel) / 4)
        const splitAngleSpan =
          adjustedSplitAngleRange * splitAngleMinPercent +
          randFloatRange(adjustedSplitAngleRange * (1 - splitAngleMinPercent)) +
          (randFloat(chaosFactor) * Math.PI) / 8

        const splitSlice = (splitAngleSpan * 2) / splitInto

        for (let s = 0; s < splitInto; s++) {
          const length = stem.length * branchLengthFalloff * (1 + randFloat(chaosFactor / 8))
          const angle = stem.angle - splitAngleSpan / 2 + splitSlice * s + randFloat((Math.PI * chaosFactor) / 10)
          const endPoint = this.drawBranch(stem.position, angle, length)
          this.nextStems.push({
            position: endPoint,
            angle,
            length,
          })
        }
      }

      this.drawnCurrentStems++
    }
  }

  drawBranch(position: Point, angle: number, length: number): Point {
    this.ctx.beginPath()
    this.ctx.moveTo(position.x, position.y)
    const endPoint = position.clone().add(new Point(Math.cos(angle) * length, Math.sin(angle) * length))
    this.ctx.lineTo(endPoint.x, endPoint.y)
    this.ctx.stroke()
    this.ctx.closePath()
    return endPoint
  }

  drawBloom(position: Point, angle: number): void {
    const bloomSize = this.vs.bloomSize.value
    this.ctx.beginPath()
    // const offsetAngle = (60 / 360) * Math.PI
    // this.ctx.moveTo(position.x, position.y)
    // this.ctx.lineTo(position.x + Math.cos(angle - offsetAngle) * bloomSize, position.y + Math.sin(angle - offsetAngle) * bloomSize)
    // this.ctx.lineTo(position.x + Math.cos(angle + offsetAngle) * bloomSize, position.y + Math.sin(angle + offsetAngle) * bloomSize)
    // this.ctx.lineTo(position.x, position.y)
    this.ctx.circle(position.x + Math.cos(angle) * bloomSize, position.y + Math.sin(angle) * bloomSize, bloomSize)
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
