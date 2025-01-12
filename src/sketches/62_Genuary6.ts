import * as clipperLib from 'js-angusj-clipper/web'

import { deg15, deg20, deg90, deg180, deg360 } from '../constants/angles'
import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloat, randFloatRange, randIntRange } from '../utils/numberUtils'
import { lineToPoints } from '../utils/pathUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class Genuary6 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3541, min: 1000, max: 5000, step: 1 })
    this.addVar('buildingWidth', {
      initialValue: 35,
      min: this.ch * 0.05,
      max: this.ch * 0.25,
      step: 0.1,
    })
    this.addVar('buildingGutter', { initialValue: 5, min: 0.1, max: 10, step: 0.1 })
    this.addVar('doubleDist', { initialValue: 0.325, min: 0.1, max: 0.5, step: 0.025 })
    this.addVar('sagPercent', { initialValue: 0.35, min: 0, max: 2.5, step: 0.01 })
    this.addVar('horizonHeight', { initialValue: 0.92, min: 0.5, max: 1, step: 0.01 })
    this.addVar('sunSetAmount', { initialValue: 0.9, min: 0.1, max: 1.2, step: 0.01 })
    this.addVar('sunRadius', { initialValue: 10, min: 5, max: 20, step: 1 })
    this.addVar('sunRays', { initialValue: 36, min: 3, max: 256, step: 1 })
    this.addVar('sunRayDistFromSun', { initialValue: 5, min: 0, max: 20, step: 0.1 })
    this.addVar('sunRayLength', { initialValue: 85, min: 3, max: 200, step: 1 })
    this.addVar('godRayDensity', { initialValue: 0.75, min: 0.1, max: 5, step: 0.05 })

    this.vs.disableCutout = new BooleanRange({ initialValue: true, disableRandomize: true })
  }

  lBuildingHeight: number
  rBuildingHeight: number

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    this.ctx.driver.comment('Drawing horizon', true)
    this.drawHorizon()

    // Draw buildings
    this.ctx.driver.comment('Drawing left building', true)
    this.drawBuilding({ facing: 'l' })
    this.ctx.driver.comment('Drawing right building', true)
    this.drawBuilding({ facing: 'r' })

    this.ctx.driver.comment('Drawing upper clothesline', true)
    this.drawClothesline({ upper: 0.95, lower: 0.6 })
    this.ctx.driver.comment('Drawing lower clothesline', true)
    this.drawClothesline({ upper: 0.4, lower: 0.25 })
  }

  drawHorizon() {
    const {
      horizonHeight,
      sunSetAmount,
      sunRadius,
      sunRays,
      sunRayLength,
      sunRayDistFromSun,
      godRayDensity,
    } = this.vars

    // Draw sun
    this.ctx.driver.comment('Drawing sun', true)
    const sunPt = new Point(this.cw / 2, this.ch * sunSetAmount)
    this.ctx.strokeCircle(sunPt, sunRadius)

    // Draw sun rays
    this.ctx.driver.comment('Drawing sun rays', true)
    for (let s = 0; s < sunRays; s++) {
      const a = (s / sunRays) * deg360
      const pt = sunPt.clone().moveAlongAngle(a, sunRadius + sunRayDistFromSun)
      this.ctx.beginPath()
      this.ctx.moveTo(...pt.toArray())
      for (let l = 0; l < sunRayLength; l++) {
        const progress = l / sunRayLength
        const wiggle = Math.sin(l / 2) * progress
        pt.moveAlongAngle(a, 1)
        pt.moveAlongAngle(a + deg90, wiggle)
        if (pt.y < 2 || pt.y > this.ch - 2 || pt.x < 2 || pt.x > this.cw - 2) break
        this.ctx.lineTo(...pt.toArray())
      }
      this.ctx.stroke()
      this.ctx.endPath()
    }

    if (!this.vs.disableCutout.value) {
      this.ctx.clearRect(0, this.ch * horizonHeight, this.cw, this.ch * (1 - horizonHeight))
    }

    this.ctx.beginPath()
    this.ctx.moveTo(0, this.ch * horizonHeight)
    this.ctx.lineTo(this.cw, this.ch * horizonHeight)
    this.ctx.stroke()
    this.ctx.endPath()

    // draw clouds
    this.ctx.driver.comment('Drawing clouds', true)
    const clouds = 3
    this.ctx.beginPath()
    for (let c = 0; c < clouds; c++) {
      const pt = new Point(randIntRange(this.cw - 50, 50), randIntRange(this.ch / 2, 25))
      const blobs = randIntRange(36, 12)
      for (let i = 0; i < blobs; i++) {
        const rad = randIntRange(10, 2)
        pt.add(randIntRange(8, -8), randIntRange(4, -4))
        this.ctx.circle(pt, rad)
      }
    }

    // merge circles into a single union path
    const { intersected } = this.ctx.clipCurrentPath({
      clipType: clipperLib.ClipType.Union,
      pathDivisions: 32,
    })
    if (!intersected) return

    const subPaths = this.ctx.currentPath.subPaths
    for (const subPath of subPaths) {
      const cloudPts = subPath.getPoints()
      let furthestLeftPt: Point = null
      let furthestLeftAngle: number = null
      let furthestRightPt: Point = null
      let furthestRightAngle: number = null
      const sunLeftPt = sunPt.clone().moveAlongAngle(deg180, sunRadius)
      const sunRightPt = sunPt.clone().moveAlongAngle(0, sunRadius)
      for (const pt of cloudPts) {
        const leftAngleToPt = sunLeftPt.angleTo(pt)
        const rightAngleToPt = sunRightPt.angleTo(pt)
        if (furthestLeftAngle === null || leftAngleToPt < furthestLeftAngle) {
          furthestLeftAngle = leftAngleToPt
          furthestLeftPt = pt
        }
        if (furthestRightAngle === null || rightAngleToPt > furthestRightAngle) {
          furthestRightAngle = rightAngleToPt
          furthestRightPt = pt
        }
      }

      if (!furthestLeftPt || !furthestRightPt) continue

      // cut out shape where godrays will go
      if (!this.vs.disableCutout.value) {
        const cutOutShape = new Path([
          furthestLeftPt,
          furthestLeftPt.clone().moveAway(sunLeftPt, this.ch / 2),
          furthestRightPt.clone().moveAway(sunRightPt, this.ch / 2),
          furthestRightPt,
          furthestLeftPt,
        ])
        this.ctx.path(cutOutShape.getPoints())
        this.ctx.cutOutCurrentShape()
      }

      const linePts = [
        furthestLeftPt,
        ...lineToPoints(
          furthestLeftPt,
          furthestRightPt,
          furthestLeftPt.distanceTo(furthestRightPt) / godRayDensity
        ),
      ]
      this.ctx.beginPath()
      for (let i = 0; i < linePts.length; i++) {
        const pt = linePts[i]
        const relativeSunPt = sunPt
          .clone()
          .add(-sunRadius + (i / linePts.length) * sunRadius * 2, 0)
        const lineLength = Math.min(
          // hypotenuse to top of canvas
          Math.abs(pt.y / Math.sin(relativeSunPt.angleTo(pt))),
          // hypotenuse to left of canvas
          Math.abs(pt.x / Math.cos(relativeSunPt.angleTo(pt))),
          // hypotenuse to right of canvas
          Math.abs((this.cw - pt.x) / Math.cos(relativeSunPt.angleTo(pt)))
        )
        this.ctx.moveTo(...pt.toArray())
        this.ctx.lineToRelativeAngle(relativeSunPt.angleTo(pt), lineLength - 0.5)
      }
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.strokePath(cloudPts, { cutout: !this.vs.disableCutout.value })
    }
  }

  drawBuilding({ facing }: { facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter, doubleDist } = this.vars

    const buildingHeight = randFloatRange(0, (this.ch / 2) * 0.8) + this.ch / 2
    const buildingTop = this.ch - buildingHeight

    if (facing === 'l') this.lBuildingHeight = buildingHeight
    else this.rBuildingHeight = buildingHeight

    const lrSign = facing === 'l' ? 1 : -1

    // clear horizon behind
    if (!this.vs.disableCutout.value) {
      this.ctx.clearRect(
        facing === 'l' ? 0 : this.cw - buildingWidth,
        buildingTop,
        buildingWidth,
        buildingHeight
      )
      this.ctx.clearRect(
        facing === 'l' ? 0 : this.cw - (buildingWidth + buildingGutter),
        buildingTop - buildingGutter,
        buildingWidth + buildingGutter,
        buildingGutter
      )
    }

    // Building outline
    this.ctx.beginPath()
    this.ctx.moveTo(facing === 'l' ? 0 : this.cw, buildingTop)
    this.ctx.lineToRelative(lrSign * buildingWidth, 0)
    this.ctx.lineToRelative(0, buildingHeight)
    this.ctx.stroke()
    this.ctx.endPath()

    // double line
    this.ctx.beginPath()
    this.ctx.moveTo(facing === 'l' ? 0 : this.cw, buildingTop + doubleDist)
    this.ctx.lineToRelative(lrSign * (buildingWidth - doubleDist), 0)
    this.ctx.lineToRelative(0, buildingHeight - doubleDist)
    this.ctx.stroke()
    this.ctx.endPath()

    // Building roof
    this.ctx.beginPath()
    this.ctx.moveTo(facing === 'l' ? buildingWidth : this.cw - buildingWidth, buildingTop)
    this.ctx.lineToRelative(lrSign * buildingGutter, 0)
    this.ctx.lineToRelative(0, -buildingGutter)
    this.ctx.lineToRelative(lrSign * -(buildingWidth + buildingGutter), 0)
    this.ctx.stroke()
    this.ctx.endPath()

    // double line
    this.ctx.beginPath()
    this.ctx.moveTo(
      facing === 'l' ? buildingWidth : this.cw - buildingWidth,
      buildingTop + doubleDist
    )
    this.ctx.lineToRelative(lrSign * (buildingGutter + doubleDist), 0)
    this.ctx.lineToRelative(0, -(buildingGutter + doubleDist * 2))
    this.ctx.lineToRelative(lrSign * -(buildingWidth + buildingGutter + doubleDist), 0)
    this.ctx.stroke()
    this.ctx.endPath()

    // Roof railing

    // return

    const roofRailingHeight = buildingGutter
    this.drawRailings({
      x: facing === 'l' ? 0 : this.cw - buildingWidth - buildingGutter,
      y: buildingTop - doubleDist - buildingGutter,
      w: buildingWidth + buildingGutter,
      h: roofRailingHeight,
      waveH: 2,
    })

    // Building windows
    this.drawWindows({
      y: buildingTop + buildingGutter,
      h: buildingHeight - buildingGutter * 2,
      facing,
    })

    // Building balconies
    let balconyY = randIntRange(50, 20)
    while (balconyY < buildingHeight - 10) {
      this.drawBalcony({ y: buildingTop + balconyY, facing })
      balconyY += randIntRange(50, 25)
    }
  }

  drawWindows({ y, h, facing }: { y: number; h: number; facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter } = this.vars
    let nextY = y
    while (nextY < y + h) {
      const windowSize = Math.min(randFloatRange(8, 15), buildingWidth - buildingGutter * 2)
      this.drawWindow({ s: windowSize, y: nextY, facing })
      nextY += windowSize + randFloatRange(5, 30)
    }
  }

  drawWindow({ s, y, facing }: { s: number; y: number; facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter, doubleDist } = this.vars
    const randOffsetX = randFloatRange(0, buildingGutter / 2)
    const x =
      facing === 'l'
        ? buildingWidth - buildingGutter - (s + randOffsetX)
        : this.cw - buildingWidth + (buildingGutter + randOffsetX)

    this.ctx.strokeRect(x, y, s, s)

    const sil = doubleDist * 2
    const segS = (s - sil) / 2
    if (s < 12) {
      this.ctx.beginPath()
      this.ctx.moveTo(x, y + segS)
      this.ctx.lineToRelative(s, 0)
      this.ctx.stroke()
      this.ctx.endPath()

      this.ctx.beginPath()
      this.ctx.moveTo(x + s, y + segS + sil)
      this.ctx.lineToRelative(-s, 0)
      this.ctx.stroke()
      this.ctx.endPath()
    } else {
      this.ctx.beginPath()
      this.ctx.moveTo(x, y + segS)
      this.ctx.lineToRelative(segS, 0)
      this.ctx.lineToRelative(0, -segS)
      this.ctx.stroke()
      this.ctx.endPath()

      this.ctx.beginPath()
      this.ctx.moveTo(x + segS + sil, y)
      this.ctx.lineToRelative(0, segS)
      this.ctx.lineToRelative(segS, 0)
      this.ctx.stroke()
      this.ctx.endPath()

      this.ctx.beginPath()
      this.ctx.moveTo(x + s, y + segS + sil)
      this.ctx.lineToRelative(-segS, 0)
      this.ctx.lineToRelative(0, segS)
      this.ctx.stroke()
      this.ctx.endPath()

      this.ctx.beginPath()
      this.ctx.moveTo(x + segS, y + s)
      this.ctx.lineToRelative(0, -segS)
      this.ctx.lineToRelative(-segS, 0)
      this.ctx.stroke()
      this.ctx.endPath()
    }
  }

  drawBalcony({ y, facing }: { y: number; facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter } = this.vars

    const balconyWidth = randFloatRange(8, 20)
    const balconyHeight = randFloatRange(12, 18)
    const balconyFloorThickness = buildingGutter / 2
    const railingWidth = buildingGutter / 6

    // clear horizon behind
    // 2991
    if (!this.vs.disableCutout.value) {
      this.ctx.clearRect(
        facing === 'l' ? buildingWidth : this.cw - (buildingWidth + balconyWidth),
        y - balconyHeight + balconyFloorThickness,
        balconyWidth,
        balconyHeight - balconyFloorThickness
      )
      this.ctx.clearRect(
        facing === 'l'
          ? buildingWidth + balconyWidth - railingWidth
          : this.cw - (buildingWidth + balconyWidth),
        y - balconyHeight,
        railingWidth,
        balconyHeight
      )
    }

    this.ctx.beginPath()
    this.ctx.moveTo(facing === 'l' ? buildingWidth : this.cw - buildingWidth, y)
    this.ctx.lineToRelative(facing === 'l' ? balconyWidth : -balconyWidth, 0)
    this.ctx.lineToRelative(0, -balconyHeight)
    this.ctx.lineToRelative(facing === 'l' ? -railingWidth : railingWidth, 0)
    this.ctx.lineToRelative(0, balconyHeight - balconyFloorThickness)
    this.ctx.lineToRelative(
      facing === 'l' ? -(balconyWidth - railingWidth) : balconyWidth - railingWidth,
      0
    )
    this.ctx.stroke()
    this.ctx.endPath()

    this.drawRailings({
      x: facing === 'l' ? buildingWidth : this.cw - buildingWidth - (balconyWidth - railingWidth),
      y: y - balconyFloorThickness,
      w: balconyWidth,
      h: balconyHeight - balconyFloorThickness * 2,
      waveH: 0,
    })
  }

  drawRailings({
    x,
    y,
    w,
    h,
    waveH,
  }: {
    x: number
    y: number
    w: number
    h: number
    waveH: number
  }): void {
    const { buildingGutter } = this.vars

    const umbrellaX = x + w / 4 + randFloatRange(w / 2)
    const umbrellaAngle = -deg90 + randFloat(deg20)
    const umbrellaHeight = 10
    this.ctx.beginPath()
    this.ctx.moveTo(umbrellaX, y)
    this.ctx.lineToRelativeAngle(umbrellaAngle, umbrellaHeight)
    const lastPt = this.ctx.currentPath.lastPoint() as Point
    this.ctx.stroke()
    this.ctx.beginPath()
    this.ctx.moveTo(...lastPt.toArray())
    this.ctx.lineToRelativeAngle(umbrellaAngle - deg90, umbrellaHeight / 2)
    this.ctx.arc(
      ...lastPt.toArray(),
      umbrellaHeight / 1.5,
      umbrellaAngle - deg90,
      umbrellaAngle + deg90,
      false
    )
    this.ctx.lineToRelativeAngle(umbrellaAngle - deg90, umbrellaHeight / 1.5)
    this.ctx.stroke({ cutout: !this.vs.disableCutout.value })

    const poleWidth = buildingGutter / 8
    const poles = Math.floor(w / (poleWidth * 2.5))
    const gap = (w - (poles + 1) * poleWidth) / (poles + 1)

    for (let i = 0; i < poles; i++) {
      const poleX = x + gap + i * (poleWidth + gap)
      const height = h + Math.sin((i / poles) * 5) * waveH
      this.ctx.beginPath()
      this.ctx.moveTo(poleX, y)
      this.ctx.lineToRelative(0, -height)
      this.ctx.lineToRelative(poleWidth, 0)
      this.ctx.lineToRelative(0, height)
      this.ctx.stroke({ cutout: !this.vs.disableCutout.value })
      this.ctx.endPath()
    }
  }

  drawClothesline({ upper, lower }: { upper: number; lower: number }): void {
    const type = randFloatRange(1) > 0.5 ? 'pegs' : 'party'

    const { buildingWidth, buildingGutter, sagPercent } = this.vars

    const leftPt = new Point(
      buildingWidth,
      this.ch - this.lBuildingHeight * randFloatRange(upper, lower)
    )
    const rightPt = new Point(
      this.cw - buildingWidth,
      this.ch - this.rBuildingHeight * randFloatRange(upper, lower)
    )
    const heightDiff = Math.abs(leftPt.y - rightPt.y)

    const sag = Math.max(5, (20 + heightDiff / 4) * sagPercent)

    const pts = getBezierPoints(
      leftPt,
      leftPt.clone().add(this.cw / 4, heightDiff / 2 + sag),
      rightPt.clone().add(-this.cw / 4, heightDiff / 2 + sag),
      rightPt,
      type === 'party' ? 32 : 20
    )
    for (let i = 1; i < pts.length; i++) {
      const pt = pts[i]
      const prevPt = pts[i - 1]
      const angle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x)

      if (type === 'party') {
        this.ctx.beginPath()
        this.ctx.polygon(pt.x, pt.y + 1, 3, 2, angle + deg90)
        this.ctx.stroke({ cutout: !this.vs.disableCutout.value })
        this.ctx.endPath()
      } else {
        if (randFloatRange(1) > 0.5) continue

        const pegW = buildingGutter / 6
        const pegH = buildingGutter / 2

        this.ctx.beginPath()
        this.ctx.moveTo(pt.x - pegW / 2, pt.y - pegH * 0.3)
        this.ctx.lineToRelativeAngle(angle, pegW)
        this.ctx.lineToRelativeAngle(angle + deg90, pegH)
        this.ctx.lineToRelativeAngle(angle + deg180, pegW)
        this.ctx.lineToRelativeAngle(angle - deg90, pegH)
        this.ctx.stroke({ cutout: !this.vs.disableCutout.value })
        this.ctx.endPath()
      }
    }

    this.ctx.beginPath()
    this.ctx.moveTo(leftPt.x, leftPt.y)
    this.ctx.bezierCurveTo(
      leftPt.x + this.cw / 4,
      leftPt.y + heightDiff / 2 + sag,
      rightPt.x - this.cw / 4,
      rightPt.y + heightDiff / 2 + sag,
      rightPt.x,
      rightPt.y
    )
    this.ctx.stroke()
    this.ctx.endPath()
  }

  draw(increment: number): void {
    //
  }
}
