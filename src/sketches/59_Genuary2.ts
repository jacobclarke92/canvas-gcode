import * as clipperLib from 'js-angusj-clipper/web'

import { deg20, deg90, deg180 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import { getLineIntersectionPoint, lineIntersectsWithAny, linesIntersect } from '../utils/geomUtils'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { initPen, penUp } from '../utils/penUtils'
import { random, seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

interface Stem {
  position: Point
  angle: number
  length: number
  thickness: number
  children: Stem[]
  parent?: Stem
  depth: number
  leftLine?: Line
  rightLine?: Line
  drawnLeft?: boolean
  drawnRight?: boolean
}

const getAllStems = (baseStem: Stem, ignoreParent?: Stem): Stem[] => {
  const stems: Stem[] = []
  // const isChildOfIgnore = ignoreParent && ignoreParent.children.includes(baseStem)
  const stemSiblings = baseStem.parent ? baseStem.parent.children : []
  const isSibling = stemSiblings.includes(baseStem)
  if (baseStem !== ignoreParent /* && !isSibling*/) {
    stems.push(baseStem)
  }
  for (const stem of baseStem.children) stems.push(...getAllStems(stem, ignoreParent))
  return stems
}

const stemToInnerLine = (stem: Stem): Line => [
  stem.position,
  stem.position.clone().moveAlongAngle(stem.angle, stem.length),
]

const stemToOuterLines = (stem: Stem): Line[] => [
  [
    stem.position
      .clone()
      .moveAlongAngle(stem.angle - deg90, stem.thickness / 2)
      .moveAlongAngle(stem.angle + deg180, stem.length * 0.15),
    stem.position
      .clone()
      .moveAlongAngle(stem.angle - deg90, stem.thickness / 2)
      .moveAlongAngle(stem.angle + deg180, stem.length * 0.6),
  ],
  [
    stem.position
      .clone()
      .moveAlongAngle(stem.angle + deg90, stem.thickness / 2)
      .moveAlongAngle(stem.angle + deg180, stem.length * 0.15),
    stem.position
      .clone()
      .moveAlongAngle(stem.angle + deg90, stem.thickness / 2)
      .moveAlongAngle(stem.angle + deg180, stem.length * 0.6),
  ],
]

const stemsToOuterLines = (stems: Stem[]): Line[] => {
  const lines: Line[] = []
  for (const stem of stems) lines.push(...stemToOuterLines(stem))
  return lines
}

export default class Genuary2 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { disableRandomize: true, initialValue: 3, min: 0, max: 100, step: 0.1 })

    this.addVar('offsetY', { initialValue: -10, min: -120, max: 0, step: 0.1 })

    this.addVar('initBranchThickness', { initialValue: 10, min: 2, max: 50, step: 0.1 })
    this.addVar('initBranchLength', { initialValue: 35, min: 5, max: 50, step: 0.1 })
    this.addVar('branchLengthFalloff', { initialValue: 0.6, min: 0.4, max: 0.995, step: 0.005 })
    this.addVar('branchThicknessFalloff', { initialValue: 0.75, min: 0.4, max: 0.995, step: 0.005 })
    this.addVar('splitProbability', { initialValue: 0.75, min: 0, max: 1, step: 0.005 })
    this.addVar('pruneProbability', { initialValue: 0.5, min: 0, max: 1, step: 0.05 })
    this.addVar('splitAngleRange', { initialValue: 1.1, min: 0, max: deg90, step: Math.PI/256 }) // prettier-ignore
    this.addVar('splitAngleBranchLevelMulti', { initialValue: 0.1, min: -1, max: 1, step: 0.05 })
    this.addVar('splitAngleMinPercent', { initialValue: 1, min: 0, max: 1, step: 0.05 })
    this.addVar('chaosFactor', { initialValue: 0, min: 0, max: 2, step: 0.01 })
    this.addVar('maxBranchLevels', { initialValue: 3, min: 1, max: 15, step: 1, disableRandomize: true }) // prettier-ignore

    this.addVar('offsetRepeats', { initialValue: 5, min: 0, max: 100, step: 1 })
    this.addVar('offsetDist', { initialValue: 1, min: -25, max: 25, step: 0.05 })
    this.addVar('offsetFalloff', { initialValue: 0, min: -0.5, max: 0.5, step: 0.001 })

    this.vs.showDebug = new BooleanRange({ disableRandomize: true, initialValue: true })
    // window.addEventListener('keydown', (e) => {
    //   if (e.key === ' ') this.step(0)
    // })
  }

  private done = false
  private mode: 'plan' | 'draw' | 'finalDraw' | 'outline' = 'plan'
  private branchLevel = 0
  private scaffoldedCurrentStems = 0
  private currentStems: Stem[] = []
  private nextStems: Stem[] = []
  private startingStem: Stem
  private drawCurrentStem: Stem
  private outlinePts: Point[] = []
  private offsetRepeatCount = 0

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    // plotBounds(this)

    // Prompt: Layers upon layers upon layers

    this.done = false
    this.mode = 'plan'
    this.branchLevel = 0
    this.scaffoldedCurrentStems = 0
    this.currentStems = []
    this.nextStems = []
    this.outlinePts = []
    this.offsetRepeatCount = 0

    const {
      initBranchLength,
      initBranchThickness,
      branchLengthFalloff,
      branchThicknessFalloff,
      offsetY,
    } = this.vars
    const length = initBranchLength / branchLengthFalloff
    const angle = -deg90
    const startPt = new Point(this.cx, this.ch + offsetY)
    const position = this.drawBranchScaffold(startPt, angle, length, initBranchThickness)
    this.currentStems.push({
      position,
      angle,
      length,
      thickness: initBranchThickness,
      children: [],
      depth: 0,
    })
    this.startingStem = this.currentStems[0]
    this.ctx.strokeCircle(startPt.x, startPt.y, initBranchThickness / branchThicknessFalloff / 2, {
      debug: true,
      debugColor: this.vs.showDebug.value ? undefined : '#fff',
    })
  }

  drawBranchScaffold(position: Point, angle: number, length: number, thickness: number): Point {
    const showDebug = this.vs.showDebug.value
    this.ctx.beginPath()
    this.ctx.moveTo(position.x, position.y)
    const endPoint = position
      .clone()
      .add(new Point(Math.cos(angle) * length, Math.sin(angle) * length))
    this.ctx.lineTo(endPoint.x, endPoint.y)
    this.ctx.stroke({ debug: true, debugColor: showDebug ? undefined : '#fff' })
    this.ctx.strokeCircle(endPoint.x, endPoint.y, thickness / 2, {
      debug: true,
      debugColor: showDebug ? undefined : '#fff',
    })
    return endPoint
  }

  drawBranchLeftSide(stem: Stem, prevLeftLine?: Line): Point | null {
    const { branchThicknessFalloff } = this.vars

    let pt1 = new Point(
      stem.position.x +
        Math.cos(stem.angle + deg180) * stem.length +
        (Math.cos(stem.angle - deg90) * (stem.thickness / 2)) / branchThicknessFalloff,
      stem.position.y +
        Math.sin(stem.angle + deg180) * stem.length +
        (Math.sin(stem.angle - deg90) * (stem.thickness / 2)) / branchThicknessFalloff
    )
    const pt2 = new Point(
      stem.position.x + Math.cos(stem.angle - deg90) * (stem.thickness / 2),
      stem.position.y + Math.sin(stem.angle - deg90) * (stem.thickness / 2)
    )

    let intersected = false
    if (prevLeftLine && linesIntersect(prevLeftLine, [pt1, pt2])) {
      intersected = true
      pt1 = getLineIntersectionPoint(prevLeftLine, [pt1, pt2])
    }
    this.ctx.lineTo(...pt1.toArray())
    this.ctx.lineTo(...pt2.toArray())
    stem.leftLine = [pt1, pt2]

    return intersected ? pt1 : null
  }

  capOffStem(stem: Stem): void {
    this.ctx.lineTo(
      stem.position.x + Math.cos(stem.angle - deg90) * (stem.thickness / 2),
      stem.position.y + Math.sin(stem.angle - deg90) * (stem.thickness / 2)
    )
    this.ctx.lineTo(
      stem.position.x + Math.cos(stem.angle + deg90) * (stem.thickness / 2),
      stem.position.y + Math.sin(stem.angle + deg90) * (stem.thickness / 2)
    )
  }

  capOffStemBase(stem: Stem): void {
    const { branchThicknessFalloff } = this.vars
    this.ctx.moveTo(
      stem.position.x +
        Math.cos(stem.angle + deg180) * stem.length +
        Math.cos(stem.angle + deg90) * (stem.thickness / branchThicknessFalloff / 2),
      stem.position.y +
        Math.sin(stem.angle + deg180) * stem.length +
        Math.sin(stem.angle + deg90) * (stem.thickness / branchThicknessFalloff / 2)
    )
    this.ctx.lineTo(
      stem.position.x +
        Math.cos(stem.angle + deg180) * stem.length +
        Math.cos(stem.angle - deg90) * (stem.thickness / branchThicknessFalloff / 2),
      stem.position.y +
        Math.sin(stem.angle + deg180) * stem.length +
        Math.sin(stem.angle - deg90) * (stem.thickness / branchThicknessFalloff / 2)
    )
  }

  drawBranchRightSide(stem: Stem, prevRightLine?: Line): Point | null {
    const { branchThicknessFalloff } = this.vars

    let pt1 = new Point(
      stem.position.x + Math.cos(stem.angle + deg90) * (stem.thickness / 2),
      stem.position.y + Math.sin(stem.angle + deg90) * (stem.thickness / 2)
    )
    const pt2 = new Point(
      stem.position.x +
        Math.cos(stem.angle + deg180) * stem.length +
        (Math.cos(stem.angle + deg90) * (stem.thickness / 2)) / branchThicknessFalloff,
      stem.position.y +
        Math.sin(stem.angle + deg180) * stem.length +
        (Math.sin(stem.angle + deg90) * (stem.thickness / 2)) / branchThicknessFalloff
    )
    let intersected = false
    if (prevRightLine && linesIntersect(prevRightLine, [pt1, pt2])) {
      intersected = true
      pt1 = getLineIntersectionPoint(prevRightLine, [pt1, pt2])
    }
    this.ctx.lineTo(...pt1.toArray())
    this.ctx.lineTo(...pt2.toArray())
    stem.rightLine = [pt1, pt2]
    return intersected ? pt1 : null
  }

  step(increment: number): void {
    const {
      gutter,
      branchLengthFalloff,
      branchThicknessFalloff,
      splitProbability,
      splitAngleRange,
      splitAngleBranchLevelMulti,
      splitAngleMinPercent,
      pruneProbability,
      chaosFactor,
      maxBranchLevels,
      offsetRepeats,
      offsetDist,
      offsetFalloff,
    } = this.vars
    const showDebug = this.vs.showDebug.value

    if (this.done) {
      penUp(this)
      return
    }

    /**
     * Planning mode -- calculate stems
     */
    if (this.mode === 'plan') {
      if (this.branchLevel > maxBranchLevels) {
        this.mode = 'draw'
        this.ctx.beginPath()
        this.capOffStemBase(this.startingStem)
        this.drawCurrentStem = this.startingStem
        this.drawBranchLeftSide(this.drawCurrentStem)
        const otherStemLines = stemsToOuterLines(getAllStems(this.startingStem))
        for (const line of otherStemLines) {
          this.ctx.moveTo(...line[0].toArray())
          this.ctx.lineTo(...line[1].toArray())
        }
        return
      }

      if (this.scaffoldedCurrentStems >= this.currentStems.length) {
        // time to calculate new stems
        this.currentStems = [...this.nextStems]
        this.nextStems = []
        this.branchLevel++
        this.scaffoldedCurrentStems = 0
      } else {
        // draw current stems
        const stem = this.currentStems[this.scaffoldedCurrentStems]
        const thickness = stem.thickness * branchThicknessFalloff
        const otherStemLines = stemsToOuterLines(getAllStems(this.startingStem, stem))

        // for (const line of otherStemLines) {
        //   this.ctx.moveTo(...line[0].toArray())
        //   this.ctx.lineTo(...line[1].toArray())
        //   this.ctx.stroke({ debug: true, debugColor: showDebug ? undefined : '#fff' })
        // }

        const doSplit = random() <= splitProbability
        if (!doSplit) {
          // draw branch
          const angle = stem.angle + randFloat(chaosFactor * deg20)
          const length = stem.length * branchLengthFalloff * (1 + randFloat(chaosFactor / 8))
          const endPoint = this.drawBranchScaffold(stem.position, angle, length, thickness)
          const [stemLeftLine, stemRightLine] = stemToOuterLines(stem)
          let prune = false

          if (this.branchLevel >= this.vs.maxBranchLevels.value) prune = true
          if (random() <= pruneProbability) prune = true
          if (!prune) {
            if (
              lineIntersectsWithAny(stemLeftLine, ...otherStemLines) ||
              lineIntersectsWithAny(stemRightLine, ...otherStemLines)
            ) {
              prune = true
              debugDot(this.ctx, endPoint, 'red')
            }
          }
          if (!prune) {
            this.nextStems.push({
              position: endPoint,
              angle,
              length,
              thickness,
              parent: stem,
              children: [],
              depth: stem.depth + 1,
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
              stem.angle - splitAngleSpan / 2 + splitSlice * s + randFloat(chaosFactor * deg20)
            const endPoint = this.drawBranchScaffold(stem.position, angle, length, thickness)
            const [stemLeftLine, stemRightLine] = stemToOuterLines(stem)
            if (
              otherStemLines.length > 0 &&
              (lineIntersectsWithAny(stemLeftLine, ...otherStemLines) ||
                lineIntersectsWithAny(stemRightLine, ...otherStemLines))
            )
              continue
            this.nextStems.push({
              position: endPoint,
              angle,
              length,
              thickness,
              parent: stem,
              children: [],
              depth: stem.depth + 1,
            })
            stem.children.push(this.nextStems[this.nextStems.length - 1])
          }
        }

        this.scaffoldedCurrentStems++
      }
    }

    /**
     * First pass of drawing mode -- trace outline of branches, while also fixing parent lines if needed
     */
    if (this.mode === 'draw') {
      if (!this.drawCurrentStem) {
        this.ctx.stroke({ debug: true, debugColor: showDebug ? undefined : '#fff' })
        this.ctx.closePath()
        this.mode = 'finalDraw'
        this.drawCurrentStem = this.startingStem
        this.ctx.strokeStyle = '#000'
        this.ctx.beginPath()
        this.capOffStemBase(this.drawCurrentStem)
        return
      }

      if (!this.drawCurrentStem.children.length) {
        // reverse direction
        this.capOffStem(this.drawCurrentStem)
        this.drawBranchRightSide(this.drawCurrentStem)
        this.drawCurrentStem = this.drawCurrentStem.parent
      } else {
        const notStartedChild = this.drawCurrentStem.children.find((child) => !child.leftLine)
        const notStartedChildIndex = this.drawCurrentStem.children.indexOf(notStartedChild)
        if (notStartedChild) {
          const prevSiblingStem =
            notStartedChildIndex > 0
              ? this.drawCurrentStem.children[notStartedChildIndex - 1]
              : undefined
          const intersectionPt = this.drawBranchLeftSide(
            notStartedChild,
            prevSiblingStem?.rightLine || notStartedChild.parent?.leftLine
          )
          if (intersectionPt) {
            if (prevSiblingStem) prevSiblingStem.rightLine[1] = intersectionPt
            else if (notStartedChild.parent) notStartedChild.parent.leftLine[1] = intersectionPt
          }
          this.drawCurrentStem = notStartedChild
        } else {
          const lastChild =
            this.drawCurrentStem.children.length > 0
              ? this.drawCurrentStem.children[this.drawCurrentStem.children.length - 1]
              : undefined
          const intersectionPt = this.drawBranchRightSide(
            this.drawCurrentStem,
            lastChild?.rightLine
          )
          if (intersectionPt) lastChild.rightLine[1] = intersectionPt
          this.drawCurrentStem = this.drawCurrentStem.parent
        }
      }
    }

    /**
     * Final draw pass with clean lines
     */
    if (this.mode === 'finalDraw') {
      if (!this.drawCurrentStem) {
        this.ctx.closePath()
        this.outlinePts = this.ctx.currentPath.getPoints()
        this.ctx.stroke()
        this.mode = 'outline'
        return
      }

      if (!this.drawCurrentStem.children.length) {
        // reverse direction
        this.capOffStem(this.drawCurrentStem)
        this.ctx.lineTo(...this.drawCurrentStem.rightLine[0].toArray())
        this.ctx.lineTo(...this.drawCurrentStem.rightLine[1].toArray())
        this.drawCurrentStem.drawnRight = true
        this.drawCurrentStem = this.drawCurrentStem.parent
      } else {
        const notStartedChild = this.drawCurrentStem.children.find((child) => !child.drawnLeft)
        if (notStartedChild) {
          this.ctx.lineTo(...notStartedChild.leftLine[0].toArray())
          this.ctx.lineTo(...notStartedChild.leftLine[1].toArray())
          notStartedChild.drawnLeft = true
          this.drawCurrentStem = notStartedChild
        } else {
          const lastChild =
            this.drawCurrentStem.children.length > 0
              ? this.drawCurrentStem.children[this.drawCurrentStem.children.length - 1]
              : undefined
          this.ctx.lineTo(...lastChild.rightLine[0].toArray())
          this.ctx.lineTo(...lastChild.rightLine[1].toArray())
          lastChild.drawnRight = true
          this.drawCurrentStem = this.drawCurrentStem.parent
        }
      }
    }

    if (this.mode === 'outline') {
      // if (increment % 500 !== 0) return
      if (this.offsetRepeatCount >= offsetRepeats) {
        this.done = true
        return
      }
      if (this.offsetRepeatCount === 0) {
        this.outlinePts = this.ctx.currentPath.getPoints()
      }
      const offsetPaths = this.ctx
        .offsetPath(this.outlinePts, offsetDist * (1 + offsetFalloff * this.offsetRepeatCount))
        .sort((a, b) => a.length - b.length)
      this.outlinePts = offsetPaths[offsetPaths.length - 1]

      for (const offsetPath of offsetPaths) {
        this.ctx.beginPath()
        this.ctx.moveTo(offsetPath[0].x, offsetPath[0].y)
        for (let i = 1; i < offsetPath.length; i++) {
          this.ctx.lineTo(offsetPath[i].x, offsetPath[i].y)
        }
        this.ctx.rect(gutter, gutter, this.cw - gutter * 2, this.ch - gutter * 2)
        try {
          this.ctx.clipCurrentPath({
            clipType: clipperLib.ClipType.Intersection,
            pathDivisions: 96,
            subjectIsOpen: true,
            inputsAreOpen: false,
            clipFillType: clipperLib.PolyFillType.NonZero,
          })
        } catch (e) {
          return
        }
        this.ctx.stroke()
      }
      this.offsetRepeatCount++
    }
  }

  draw(increment: number): void {
    this.step(increment)
  }
}
