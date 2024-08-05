import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class OpticalCollective extends Sketch {
  static generateGCode = false

  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 200,
      step: 1,
    })
    this.addVar('cellSize', {
      initialValue: 28, //12,
      min: 5,
      max: 200,
      step: 1,
    })
    this.addVar('joinerRatio', {
      initialValue: 0.15,
      min: 0.01,
      max: 0.5,
      step: 0.001,
    })
    this.addVar('joinerBluntness', {
      initialValue: 0.2,
      min: 0.001,
      max: 0.51,
      step: 0.001,
    })

    this.addVar('lineTightness', {
      initialValue: 0.5,
      min: 0.1,
      max: 3,
      step: 0.01,
    })

    this.vs.ignoreEdges = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })

    this.vs.flatFill = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
  }

  // circleColors = ['#89c8ff', '#bdffbf']
  // circleColors = ['#0571ec', '#7eeb0a']
  circleColors = ['#6c07f1', '#f20282']
  // circleColors = ['#3277b7', '#318c33']
  // circleColors = ['#f6570d', '#fdd808']
  // circleColors = ['#999999', '#cccccc']
  joinerColors = ['#ffffff', '#222222']
  pattern = [1, 1, 0, 1, 0, 0, 1, 0]

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const { cellSize, gutter, joinerRatio, joinerBluntness, lineTightness } = this.vars
    const ignoreEdges = !!this.vs.ignoreEdges.value
    const flatFill = !!this.vs.flatFill.value

    const canvasW = this.cw - gutter * 2
    const canvasH = this.ch - gutter * 2

    const hCells = Math.floor(canvasW / cellSize)
    const vCells = Math.floor(canvasH / cellSize)

    const offsetX = gutter + (canvasW - hCells * cellSize) / 2
    const offsetY = gutter + (canvasH - vCells * cellSize) / 2

    for (let ix = 0; ix < hCells; ix++) {
      for (let iy = 0; iy < vCells; iy++) {
        const blockColorIndex = ix % 2 === iy % 2 ? 0 : 1

        // const patternIndex = (ix + iy) % this.pattern.length
        // const joinerColorIndex = this.pattern[patternIndex]

        const x = offsetX + ix * cellSize
        const y = offsetY + iy * cellSize

        const joinerSize = cellSize * joinerRatio * 2

        this.ctx.beginPath()
        this.ctx.rect(x, y, cellSize, cellSize)

        // TL
        if (!ignoreEdges || (ix > 0 && iy > 0)) {
          this.ctx.moveTo(x, y)
          this.ctx.lineTo(x + joinerSize, y)
          this.ctx.lineTo(x + joinerSize * 0.5, y + joinerSize * joinerBluntness)
          this.ctx.lineTo(x, y)
          this.ctx.lineTo(x, y + joinerSize)
          this.ctx.lineTo(x + joinerSize * joinerBluntness, y + joinerSize * 0.5)
          this.ctx.lineTo(x, y)
        }

        // TR
        if (!ignoreEdges || (iy > 0 && ix < hCells - 1)) {
          this.ctx.moveTo(x + cellSize, y)
          this.ctx.lineTo(x + cellSize - joinerSize, y)
          this.ctx.lineTo(x + cellSize - joinerSize * 0.5, y + joinerSize * joinerBluntness)
          this.ctx.lineTo(x + cellSize, y)
          this.ctx.lineTo(x + cellSize, y + joinerSize)
          this.ctx.lineTo(x + cellSize - joinerSize * joinerBluntness, y + joinerSize * 0.5)
          this.ctx.lineTo(x + cellSize, y)
        }

        // BR
        if (!ignoreEdges || (ix < hCells - 1 && iy < vCells - 1)) {
          this.ctx.moveTo(x + cellSize, y + cellSize)
          this.ctx.lineTo(x + cellSize, y + cellSize - joinerSize)
          this.ctx.lineTo(
            x + cellSize - joinerSize * joinerBluntness,
            y + cellSize - joinerSize * 0.5
          )
          this.ctx.lineTo(x + cellSize, y + cellSize)
          this.ctx.lineTo(x + cellSize - joinerSize, y + cellSize)
          this.ctx.lineTo(
            x + cellSize - joinerSize * 0.5,
            y + cellSize - joinerSize * joinerBluntness
          )
          this.ctx.lineTo(x + cellSize, y + cellSize)
        }

        // BL
        if (!ignoreEdges || (ix > 0 && iy < vCells - 1)) {
          this.ctx.moveTo(x, y + cellSize)
          this.ctx.lineTo(x + joinerSize, y + cellSize)
          this.ctx.lineTo(x + joinerSize * 0.5, y + cellSize - joinerSize * joinerBluntness)
          this.ctx.lineTo(x, y + cellSize)
          this.ctx.lineTo(x, y + cellSize - joinerSize)
          this.ctx.lineTo(x + joinerSize * joinerBluntness, y + cellSize - joinerSize * 0.5)
          this.ctx.lineTo(x, y + cellSize)
        }

        this.ctx.clipCurrentPath({
          clipType: clipperLib.ClipType.Difference,
          pathDivisions: 24,
        })
        if (flatFill) {
          this.ctx.fillStyle = this.circleColors[blockColorIndex]
          this.ctx.fill()
        } else {
          this.ctx.strokeStyle = this.circleColors[blockColorIndex]
          for (let i = 0; i < cellSize / 2 / lineTightness; i++) {
            this.ctx.strokeOffsetPath(-lineTightness, {
              joinType: clipperLib.JoinType.Round,
              endType: clipperLib.EndType.ClosedPolygon,
              precision: 10,
            })
          }
        }

        this.ctx.closePath()
      }
    }

    for (let ix = 0; ix < hCells; ix++) {
      for (let iy = 0; iy < vCells; iy++) {
        const patternIndex = (ix + iy) % this.pattern.length
        const colorIndex = this.pattern[patternIndex]

        if (colorIndex === 0 || ix >= hCells - 1 || iy >= vCells - 1) continue

        const joinerSize = cellSize * joinerRatio * 2

        const x = offsetX + ix * cellSize + cellSize
        const y = offsetY + iy * cellSize + cellSize

        this.ctx.fillStyle = this.joinerColors[colorIndex]
        this.ctx.strokeStyle = this.joinerColors[colorIndex]
        this.ctx.beginPath()
        this.ctx.moveTo(x, y)
        this.ctx.lineTo(x - joinerSize * joinerBluntness, y - joinerSize * 0.5)
        this.ctx.lineTo(x, y - joinerSize)
        this.ctx.lineTo(x + joinerSize * joinerBluntness, y - joinerSize * 0.5)
        this.ctx.lineTo(x, y)
        if (flatFill) this.ctx.fill()
        else {
          this.ctx.stroke()
          for (let i = 0; i < joinerSize * 0.5; i++) this.ctx.strokeOffsetPath(-lineTightness)
        }
        this.ctx.closePath()

        this.ctx.beginPath()
        this.ctx.moveTo(x, y)
        this.ctx.lineTo(x - joinerSize * joinerBluntness, y + joinerSize * 0.5)
        this.ctx.lineTo(x, y + joinerSize)
        this.ctx.lineTo(x + joinerSize * joinerBluntness, y + joinerSize * 0.5)
        this.ctx.lineTo(x, y)
        if (flatFill) this.ctx.fill()
        else {
          this.ctx.stroke()
          for (let i = 0; i < joinerSize * 0.5; i++) this.ctx.strokeOffsetPath(-lineTightness)
        }
        this.ctx.closePath()

        this.ctx.beginPath()
        this.ctx.moveTo(x, y)
        this.ctx.lineTo(x + joinerSize * 0.5, y - joinerSize * joinerBluntness)
        this.ctx.lineTo(x + joinerSize, y)
        this.ctx.lineTo(x + joinerSize * 0.5, y + joinerSize * joinerBluntness)
        this.ctx.lineTo(x, y)
        if (flatFill) this.ctx.fill()
        else {
          this.ctx.stroke()
          for (let i = 0; i < joinerSize * 0.5; i++) this.ctx.strokeOffsetPath(-lineTightness)
        }
        this.ctx.closePath()

        this.ctx.beginPath()
        this.ctx.moveTo(x, y)
        this.ctx.lineTo(x - joinerSize * 0.5, y - joinerSize * joinerBluntness)
        this.ctx.lineTo(x - joinerSize, y)
        this.ctx.lineTo(x - joinerSize * 0.5, y + joinerSize * joinerBluntness)
        this.ctx.lineTo(x, y)
        if (flatFill) this.ctx.fill()
        else {
          this.ctx.stroke()
          for (let i = 0; i < joinerSize * 0.5; i++) this.ctx.strokeOffsetPath(-lineTightness)
        }
        this.ctx.closePath()
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
