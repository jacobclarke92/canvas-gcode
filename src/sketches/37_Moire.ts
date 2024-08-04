import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getPointsWhereLineIntersectsCircle } from '../utils/geomUtils'
import { perlin2 } from '../utils/noise'
import { initPen, plotBounds, stopAndWigglePen } from '../utils/penUtils'
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
      min: -Math.PI / 8,
      max: Math.PI / 8,
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
      min: -Math.PI / 24,
      max: Math.PI / 24,
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

      let angle = initialAngle + l * angleStep + Math.PI / 2
      const layerLineSpacing = lineSpacing + l * scaleStep
      const offsetX = l * xStep
      const offsetY = l * yStep
      for (let x = 1; x < lines; x++) {
        const theta =
          perlin2((x + noiseOffset) / noiseDiv, (0 + noiseOffset) / noiseDiv) * Math.PI * 2

        let testPts: Line = [
          new Point(
            offsetX + x * (layerLineSpacing + theta) + Math.cos(angle) * this.cw * 2,
            offsetY + Math.sin(angle) * this.cw * 2
          ),
          new Point(
            offsetX + x * (layerLineSpacing + theta) + Math.cos(angle + Math.PI) * this.cw * 2,
            offsetY + Math.sin(angle + Math.PI) * this.cw * 2
          ),
        ]
        if (x % 2) testPts = testPts.reverse() as Line
        const pts = getPointsWhereLineIntersectsCircle(
          testPts,
          new Point(this.cw / 2, this.ch / 2),
          circleRadius
        )

        if (pts.length !== 2) continue

        this.ctx.beginPath()
        this.ctx.moveTo(pts[0].x, pts[0].y)
        this.ctx.lineTo(pts[1].x, pts[1].y)
        this.ctx.stroke()
        this.ctx.closePath()
      }
      angle -= Math.PI / 2
      for (let y = 1; y < lines; y++) {
        const theta =
          perlin2((0 + noiseOffset) / noiseDiv, (y + noiseOffset) / noiseDiv) * Math.PI * 2
        let testPts: Line = [
          new Point(
            offsetX + Math.cos(angle) * this.cw * 2,
            offsetY + y * (layerLineSpacing + theta) + Math.sin(angle) * this.cw * 2
          ),
          new Point(
            offsetX + Math.cos(angle + Math.PI) * this.cw * 2,
            offsetY + y * (layerLineSpacing + theta) + Math.sin(angle + Math.PI) * this.cw * 2
          ),
        ]
        if (y % 2) testPts = testPts.reverse() as Line
        const pts = getPointsWhereLineIntersectsCircle(
          testPts,
          new Point(this.cw / 2, this.ch / 2),
          circleRadius
        )

        if (pts.length !== 2) continue

        this.ctx.beginPath()
        this.ctx.moveTo(pts[0].x, pts[0].y)
        this.ctx.lineTo(pts[1].x, pts[1].y)
        this.ctx.stroke()
        this.ctx.closePath()
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
