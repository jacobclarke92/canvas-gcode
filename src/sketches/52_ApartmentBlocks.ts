import type { Font, RenderOptions } from 'opentype.js'
import { parse as parseFontFile } from 'opentype.js'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class ApartmentBlocks extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 1234, min: 1000, max: 5000, step: 1 })
    this.addVar('buildingWidth', {
      initialValue: this.ch * 0.15,
      min: this.ch * 0.05,
      max: this.ch * 0.25,
      step: 0.1,
    })
    this.addVar('buildingGutter', { initialValue: 5, min: 0.1, max: 10, step: 0.1 })
    this.addVar('doubleDist', { initialValue: 0.325, min: 0.1, max: 0.5, step: 0.025 })
  }

  lBuildingHeight: number
  rBuildingHeight: number

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    // Draw buildings
    this.drawBuilding({ facing: 'l' })
    this.drawBuilding({ facing: 'r' })
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

  draw(increment: number): void {
    //
  }
}
