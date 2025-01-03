import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { random, seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

interface Stem {
  position: Point
  angle: number
  length: number
  thickness: number
  children: Stem[]
  parent?: Stem
  drawn: boolean
}

export default class Genuary1 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { disableRandomize: true, initialValue: 3, min: 0, max: 100, step: 0.1 })

    this.addVar('initBranchThickness', { initialValue: 10, min: 2, max: 50, step: 0.1 })
    this.addVar('initBranchLength', { initialValue: 35, min: 5, max: 50, step: 0.1 })
    this.addVar('branchLengthFalloff', { initialValue: 0.6, min: 0.4, max: 0.995, step: 0.005 })
    this.addVar('branchThicknessFalloff', { initialValue: 0.75, min: 0.4, max: 0.995, step: 0.005 })
    this.addVar('splitProbability', { initialValue: 1, min: 0, max: 1, step: 0.005 })
    this.addVar('pruneProbability', { initialValue: 0.5, min: 0, max: 1, step: 0.05 })
    this.addVar('splitAngleRange', { initialValue: 1.1, min: 0, max: Math.PI / 2, step: Math.PI / 256 }) // prettier-ignore
    this.addVar('splitAngleBranchLevelMulti', { initialValue: 0.1, min: -1, max: 1, step: 0.05 })
    this.addVar('splitAngleMinPercent', { initialValue: 1, min: 0, max: 1, step: 0.05 })
    this.addVar('chaosFactor', { initialValue: 0, min: 0, max: 2, step: 0.01 })
    this.addVar('maxBranchLevels', { initialValue: 3, min: 1, max: 24, step: 1, disableRandomize: true }) // prettier-ignore

    this.vs.debugColors = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  private done = false
  private mode: 'plan' | 'draw' = 'plan'
  private branchLevel = 0
  private drawnCurrentStems = 0
  private currentStems: Stem[] = []
  private nextStems: Stem[] = []
  private startingStem: Stem
  private drawCurrentStem: Stem

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    // Prompt: Layers upon layers upon layers

    this.done = false
    this.mode = 'plan'
    this.branchLevel = 0
    this.drawnCurrentStems = 0
    this.currentStems = []
    this.nextStems = []

    const { initBranchLength, initBranchThickness, branchLengthFalloff, branchThicknessFalloff } =
      this.vars
    const length = initBranchLength / branchLengthFalloff
    const angle = -Math.PI / 2
    const startPt = new Point(this.cx, this.ch - 10)
    const position = this.drawBranch(startPt, angle, length, initBranchThickness)
    this.currentStems.push({
      position,
      angle,
      length,
      thickness: initBranchThickness,
      children: [],
      drawn: false,
    })
    this.startingStem = this.currentStems[0]
    this.ctx.strokeCircle(startPt.x, startPt.y, initBranchThickness / branchThicknessFalloff / 2)
  }

  drawBranch(position: Point, angle: number, length: number, thickness: number): Point {
    this.ctx.beginPath()
    this.ctx.moveTo(position.x, position.y)
    const endPoint = position
      .clone()
      .add(new Point(Math.cos(angle) * length, Math.sin(angle) * length))
    this.ctx.lineTo(endPoint.x, endPoint.y)
    this.ctx.stroke()
    this.ctx.closePath()
    this.ctx.strokeCircle(endPoint.x, endPoint.y, thickness / 2)
    return endPoint
  }

  drawLeftBranch(stem: Stem): void {
    const { branchThicknessFalloff } = this.vars
    this.ctx.beginPath()
    this.ctx.moveTo(
      stem.position.x +
        Math.cos(stem.angle + Math.PI) * stem.length +
        (Math.cos(stem.angle - Math.PI / 2) * (stem.thickness / 2)) / branchThicknessFalloff,
      stem.position.y +
        Math.sin(stem.angle + Math.PI) * stem.length +
        (Math.sin(stem.angle - Math.PI / 2) * (stem.thickness / 2)) / branchThicknessFalloff
    )
    this.ctx.lineTo(
      stem.position.x + Math.cos(stem.angle - Math.PI / 2) * (stem.thickness / 2),
      stem.position.y + Math.sin(stem.angle - Math.PI / 2) * (stem.thickness / 2)
    )
    this.ctx.stroke()
    stem.drawn = true
  }

  draw(increment: number): void {
    const {
      branchLengthFalloff,
      branchThicknessFalloff,
      splitProbability,
      splitAngleRange,
      splitAngleBranchLevelMulti,
      splitAngleMinPercent,
      pruneProbability,
      chaosFactor,
      maxBranchLevels,
    } = this.vars

    if (this.done) {
      penUp(this)
      return
    }

    if (this.branchLevel > maxBranchLevels && this.mode !== 'draw') {
      this.mode = 'draw'
      this.drawCurrentStem = this.startingStem
      this.drawLeftBranch(this.drawCurrentStem)
      return
    }

    if (this.mode === 'plan') {
      if (this.drawnCurrentStems >= this.currentStems.length) {
        // time to calculate new stems
        this.currentStems = [...this.nextStems]
        this.nextStems = []
        this.branchLevel++
        this.drawnCurrentStems = 0
      } else {
        // draw current stems
        const stem = this.currentStems[this.drawnCurrentStems]
        const thickness = stem.thickness * branchThicknessFalloff

        const doSplit = random() <= splitProbability
        if (!doSplit) {
          // draw branch
          const angle = stem.angle + randFloat((Math.PI * chaosFactor) / 10)
          const length = stem.length * branchLengthFalloff * (1 + randFloat(chaosFactor / 8))
          const endPoint = this.drawBranch(stem.position, angle, length, thickness)
          if (this.branchLevel !== this.vs.maxBranchLevels.value && random() > pruneProbability) {
            this.nextStems.push({
              position: endPoint,
              angle,
              length,
              thickness,
              children: [],
              parent: stem,
              drawn: false,
            })
            stem.children.push(this.nextStems[this.nextStems.length - 1])
          }
        } else {
          const splitInto = 2
          const adjustedSplitAngleRange =
            splitAngleRange * (1 + (splitAngleBranchLevelMulti * this.branchLevel) / 4)
          const splitAngleSpan =
            adjustedSplitAngleRange * splitAngleMinPercent +
            randFloatRange(adjustedSplitAngleRange * (1 - splitAngleMinPercent)) +
            (randFloat(chaosFactor) * Math.PI) / 8

          const splitSlice = (splitAngleSpan * 2) / splitInto

          for (let s = 0; s < splitInto; s++) {
            const length = stem.length * branchLengthFalloff * (1 + randFloat(chaosFactor / 8))
            const angle =
              stem.angle -
              splitAngleSpan / 2 +
              splitSlice * s +
              randFloat((Math.PI * chaosFactor) / 10)
            const endPoint = this.drawBranch(stem.position, angle, length, thickness)
            this.nextStems.push({
              position: endPoint,
              angle,
              length,
              thickness,
              parent: stem,
              children: [],
              drawn: false,
            })
            stem.children.push(this.nextStems[this.nextStems.length - 1])
          }
        }

        this.drawnCurrentStems++
      }
    }
    if (this.mode === 'draw') {
      const undrawnChild = this.drawCurrentStem.children.find((child) => !child.drawn)
      if (undrawnChild) {
        this.drawCurrentStem = undrawnChild
        this.drawLeftBranch(this.drawCurrentStem)
      }
    }
  }
}
