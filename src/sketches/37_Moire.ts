import { deg7p5, deg20, deg90, deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getPointsWhereLineIntersectsCircle } from '../utils/geomUtils'
import { perlin2 } from '../utils/noise'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class Moire extends Sketch {
  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('lines', {
      initialValue: 120,
      min: 10,
      max: 200,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('layers', {
      initialValue: 3,
      min: 1,
      max: 8,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('initialAngle', {
      initialValue: 0.0002006122008506,
      min: -deg20,
      max: deg20,
      step: 0.001,
    })
    this.addVar('angleStep', {
      initialValue: 0.0031003061004253,
      min: -Math.PI / 48,
      max: Math.PI / 48,
      step: 0.0001,
    })
    this.addVar('scaleStep', {
      initialValue: 0.0061003061004253,
      min: -deg7p5,
      max: deg7p5,
      step: 0.001,
    })
    this.addVar('xStep', {
      initialValue: -2.11,
      min: -20,
      max: 20,
      step: 0.01,
    })
    this.addVar('yStep', {
      initialValue: -2.82,
      min: -20,
      max: 20,
      step: 0.01,
    })
    this.addVar('noiseOffset', {
      initialValue: 69,
      min: -100,
      max: 100,
      step: 0.01,
    })
    this.addVar('noiseDiv', {
      initialValue: 2500,
      min: 1,
      max: 10000,
      step: 0.01,
    })
    this.addVar('circleRadius', {
      initialValue: 75,
      min: 1,
      max: 150,
      step: 0.5,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const {
      lines,
      layers,
      initialAngle,
      angleStep,
      scaleStep,
      xStep,
      yStep,
      noiseDiv,
      noiseOffset,
      circleRadius,
    } = this.vars

    // const drawArea = this.ch - gutter * 2
    const lineSpacing = this.cw / lines

    for (let l = 0; l < layers; l++) {
      if (l > 0) stopAndWigglePen(this)

      let angle = initialAngle + l * angleStep + deg90
      const layerLineSpacing = lineSpacing + l * scaleStep
      const offsetX = l * xStep
      const offsetY = l * yStep
      for (let x = 1; x < lines; x++) {
        const theta = perlin2((x + noiseOffset) / noiseDiv, (0 + noiseOffset) / noiseDiv) * deg360

        const pts = getPointsWhereLineIntersectsCircle(
          [
            new Point(
              offsetX + x * (layerLineSpacing + theta) + Math.cos(angle) * this.cw * 2,
              offsetY + Math.sin(angle) * this.cw * 2
            ),
            new Point(
              offsetX + x * (layerLineSpacing + theta) + Math.cos(angle + Math.PI) * this.cw * 2,
              offsetY + Math.sin(angle + Math.PI) * this.cw * 2
            ),
          ],
          new Point(this.cw / 2, this.ch / 2),
          circleRadius
        )

        if (pts.length !== 2) continue

        this.ctx.beginPath()

        this.ctx.moveTo(pts[x % 2].x, pts[x % 2].y)
        this.ctx.lineTo(pts[(x + 1) % 2].x, pts[(x + 1) % 2].y)
        this.ctx.stroke()
        this.ctx.endPath()
      }
      angle -= deg90
      for (let y = 1; y < lines; y++) {
        const theta = perlin2((0 + noiseOffset) / noiseDiv, (y + noiseOffset) / noiseDiv) * deg360

        const pts = getPointsWhereLineIntersectsCircle(
          [
            new Point(
              offsetX + Math.cos(angle) * this.cw * 2,
              offsetY + y * (layerLineSpacing + theta) + Math.sin(angle) * this.cw * 2
            ),
            new Point(
              offsetX + Math.cos(angle + Math.PI) * this.cw * 2,
              offsetY + y * (layerLineSpacing + theta) + Math.sin(angle + Math.PI) * this.cw * 2
            ),
          ],
          new Point(this.cw / 2, this.ch / 2),
          circleRadius
        )

        if (pts.length !== 2) continue

        this.ctx.beginPath()
        this.ctx.moveTo(pts[y % 2].x, pts[y % 2].y)
        this.ctx.lineTo(pts[(y + 1) % 2].x, pts[(y + 1) % 2].y)
        this.ctx.stroke()
        this.ctx.endPath()
      }
    }
    penUp(this)
  }

  draw(increment: number): void {
    //
  }
}
