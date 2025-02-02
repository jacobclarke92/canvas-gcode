import { deg90, deg180, deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class ApartmentBlocks extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('buildingWidth', {
      initialValue: 35,
      min: this.ch * 0.05,
      max: this.ch * 0.25,
      step: 0.1,
    })
    this.addVar('buildingGutter', { initialValue: 5, min: 0.1, max: 10, step: 0.1 })
    this.addVar('doubleDist', { initialValue: 0.325, min: 0.1, max: 0.5, step: 0.025 })
    this.addVar('sagPercent', { initialValue: 0.35, min: 0, max: 2.5, step: 0.01 })
  }

  lBuildingHeight: number
  rBuildingHeight: number
  drawnCat = false

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    this.drawnCat = false

    // Draw buildings
    this.drawBuilding({ facing: 'l' })
    this.drawBuilding({ facing: 'r' })

    this.drawClothesline({ upper: 0.95, lower: 0.6 })
    this.drawClothesline({ upper: 0.4, lower: 0.25 })

    const { buildingWidth } = this.vars
    this.drawCloud({
      x: randFloatRange(this.cw - buildingWidth * 2, buildingWidth),
      y: randFloatRange(this.ch / 4, 20),
    })
    this.drawCloud({
      x: randFloatRange(this.cw - buildingWidth * 2, buildingWidth),
      y: randFloatRange(this.ch / 4, 20),
    })
  }

  drawBuilding({ facing }: { facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter, doubleDist } = this.vars

    const buildingHeight = randFloatRange(0, (this.ch / 2) * 0.8) + this.ch / 2
    const buildingTop = this.ch - buildingHeight

    if (facing === 'l') this.lBuildingHeight = buildingHeight
    else this.rBuildingHeight = buildingHeight

    const lrSign = facing === 'l' ? 1 : -1

    // Building outline
    this.ctx.beginPath()
    this.ctx.moveTo(facing === 'l' ? 0 : this.cw, buildingTop)
    this.ctx.lineToRelative(lrSign * buildingWidth, 0)
    this.ctx.lineToRelative(0, buildingHeight)

    // double line
    this.ctx.moveTo(facing === 'l' ? 0 : this.cw, buildingTop + doubleDist)
    this.ctx.lineToRelative(lrSign * (buildingWidth - doubleDist), 0)
    this.ctx.lineToRelative(0, buildingHeight - doubleDist)

    // Building roof
    this.ctx.moveTo(facing === 'l' ? buildingWidth : this.cw - buildingWidth, buildingTop)
    this.ctx.lineToRelative(lrSign * buildingGutter, 0)
    this.ctx.lineToRelative(0, -buildingGutter)
    this.ctx.lineToRelative(lrSign * -(buildingWidth + buildingGutter), 0)

    // double line
    this.ctx.moveTo(
      facing === 'l' ? buildingWidth : this.cw - buildingWidth,
      buildingTop + doubleDist
    )
    this.ctx.lineToRelative(lrSign * (buildingGutter + doubleDist), 0)
    this.ctx.lineToRelative(0, -(buildingGutter + doubleDist * 2))
    this.ctx.lineToRelative(lrSign * -(buildingWidth + buildingGutter + doubleDist), 0)
    this.ctx.stroke()

    // Roof railing
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
    this.drawBalcony({ y: buildingTop + 80, facing })
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
      this.ctx.moveTo(x, y + segS)
      this.ctx.lineToRelative(s, 0)
      this.ctx.moveTo(x + s, y + segS + sil)
      this.ctx.lineToRelative(-s, 0)
      this.ctx.stroke()
    } else {
      this.ctx.moveTo(x, y + segS)
      this.ctx.lineToRelative(segS, 0)
      this.ctx.lineToRelative(0, -segS)
      this.ctx.moveTo(x + segS + sil, y)
      this.ctx.lineToRelative(0, segS)
      this.ctx.lineToRelative(segS, 0)
      this.ctx.moveTo(x + s, y + segS + sil)
      this.ctx.lineToRelative(-segS, 0)
      this.ctx.lineToRelative(0, segS)
      this.ctx.moveTo(x + segS, y + s)
      this.ctx.lineToRelative(0, -segS)
      this.ctx.lineToRelative(-segS, 0)
      this.ctx.stroke()
    }
  }

  drawBalcony({ y, facing }: { y: number; facing: 'l' | 'r' }): void {
    const { buildingWidth, buildingGutter } = this.vars

    const balconyWidth = randFloatRange(8, 20)
    const balconyHeight = randFloatRange(12, 18)
    const balconyFloorThickness = buildingGutter / 2
    const railingWidth = buildingGutter / 6

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
    const poleWidth = buildingGutter / 8
    const poles = Math.floor(w / (poleWidth * 2.5))
    const gap = (w - (poles + 1) * poleWidth) / (poles + 1)

    this.ctx.beginPath()
    for (let i = 0; i < poles; i++) {
      const poleX = x + gap + i * (poleWidth + gap)
      const height = h + Math.sin((i / poles) * 5) * waveH
      this.ctx.moveTo(poleX, y)
      this.ctx.lineToRelative(0, -height)
      this.ctx.lineToRelative(poleWidth, 0)
      this.ctx.lineToRelative(0, height)
    }
    this.ctx.stroke()
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

      /*
      if (
        !this.drawnCat &&
        i > pts.length * 0.4 &&
        i < pts.length * 0.6 &&
        randFloatRange(1) > 0.5
      ) {
        const paths = [
          'm12.46,35.74c-2.333,1-4.917.8333-4.917.8333-1.677.1458-3.115-4.01-2.485-4.733l3.318-5.1-1.75-3.417s5.008-1.415,7.883,2.09c.3444.42.7943.7429,1.279.9871.0298.015.0602.0302.0912.0456,2.593,1.289,5.546,1.571,8.385.9981,7.222-1.458,14.07-1.37,21.7,2.212,7.625,3.583,14.53-2.25,13.64-7.5-.793-4.647,3.562-7.583,6.75-5',
          'm16.05,48.82c.6006-2.206,8.491-3.648,8.491-3.648,0,0,3.228-1.201,1.426-4.504',
          'm18.3,33.24c-1.543,1.834-3.893,4.803-.44,9.158,0,0-6.756,2.853-6.006,8.033,0,0,.3624,2.476,2.402,2.402',
          'm23.5,50.03c-1.156,7.254,2.386,6.055,3.017,5.661,1.148-.7173,1.848-9.854,3.952-11.31,1.592-1.104,8.167-.3021,8.167-.3021',
          'm38.44,41.33c.0911,1.742.7529,3.402,1.734,4.845.6616.9727,1.803,2.32,1.453,2.985-4.479,8.5.6224,7.022,1.083,6.167,3.188-5.917,6.125-4.104,4.647-10.52,0,0,5.27-1.81,5.52-7.977',
          'm48.15,45.59s2.367,3.204,7.758,2.693c0,0-3.326,6.762,0,7.62,1.917.4941,4.722-11.16,4.722-11.16,0,0-1.839-.7937-3.951-4.182',
        ]
        // debugDot(this.ctx, pt.x, pt.y, '#f00')
        const translatePercent = 4.777 // note: 3.1 is the correct value for displaying on screen but 4.777 is correct for gcode *shrugs*
        for (const path of paths) {
          this.ctx.save()
          this.ctx.scale(0.2, 0.2)
          this.ctx.translate(
            pt.x * translatePercent + Math.cos(angle - a180) * 20 + Math.cos(angle - a90) * 36,
            pt.y * translatePercent + Math.sin(angle - a180) * 20 + Math.sin(angle - a90) * 36
          )
          this.ctx.rotate(angle)
          this.ctx.strokeSvgPath(path, {
            scale: 1,
            offset: new Point(0, 0),
          })
          this.ctx.restore()
        }
        this.drawnCat = true
        // continue
      }
      */

      if (type === 'party') {
        this.ctx.strokePolygon(pt.x, pt.y + 1, 3, 2, angle + deg90)
      } else {
        if (randFloatRange(1) > 0.5) continue

        const pegW = buildingGutter / 6
        const pegH = buildingGutter / 2

        this.ctx.moveTo(pt.x - pegW / 2, pt.y - pegH * 0.3)
        this.ctx.lineToRelativeAngle(angle, pegW)
        this.ctx.lineToRelativeAngle(angle + deg90, pegH)
        this.ctx.lineToRelativeAngle(angle + deg180, pegW)
        this.ctx.lineToRelativeAngle(angle - deg90, pegH)
        this.ctx.stroke()
      }
    }
  }

  drawCloud({ x, y }: { x: number; y: number }): void {
    const puffy = 0.75
    const cloudW = randFloatRange(10, 40)
    const cloudH = randFloatRange(cloudW * 0.75, cloudW * 0.25)
    const aOffset = randFloatRange(0, deg90)
    console.log(cloudW)

    // cloudW of 25 should have min around 10
    const numPts = Math.max(Math.floor(cloudW * 0.4), randIntRange(24, 10))
    const pts: Point[] = []

    for (let i = 0; i < numPts; i++) {
      const a = (i / numPts) * deg360 + aOffset
      pts.push(new Point(x + Math.cos(a) * cloudW, y + Math.sin(a) * cloudH))
    }

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i]
      const prevPt = pts[(i === 0 ? pts.length : i) - 1]
      const dist = pt.distanceTo(prevPt)
      const puffDist = dist * puffy
      const angle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x)
      this.ctx.moveTo(prevPt.x, prevPt.y)
      this.ctx.bezierCurveTo(
        prevPt.x + Math.cos(angle - deg90) * puffDist,
        prevPt.y + Math.sin(angle - deg90) * puffDist,
        pt.x + Math.cos(angle - deg90) * puffDist,
        pt.y + Math.sin(angle - deg90) * puffDist,
        pt.x,
        pt.y
      )
      this.ctx.stroke()
    }
  }

  draw(increment: number): void {
    //
  }
}
