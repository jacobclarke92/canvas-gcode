import { EndType, JoinType } from 'js-angusj-clipper/web'

import type GCanvas from '../GCanvas'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import {
  cyclePointsToStartWith,
  getBottommostPoint,
  getLeftmostPoint,
  getMidPt,
  getRightmostPoint,
} from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { generateSpline, generateSplineWithEnds } from '../utils/splineUtils'

const getRingPts = (pos: Point, width: number, height: number, pts: number) => {
  const ringPts = []
  for (let i = 0; i < pts; i++) {
    const angle = (i / pts) * Math.PI * 2
    const x = pos.x + (Math.cos(angle) * width) / 2
    const y = pos.y + (Math.sin(angle) * height) / 2
    ringPts.push(new Point(x, y))
  }
  return ringPts
}

export default class WiggleShapeWrap extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore
    this.addVar('offsetX', {
      name: 'offsetX',
      initialValue: 1,
      min: -100,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('offsetY', {
      name: 'offsetY',
      initialValue: 1,
      min: -100,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('structures', {
      name: 'structures',
      initialValue: 3,
      min: 1,
      max: 10,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('structureSpacing', {
      name: 'structureSpacing',
      initialValue: 80,
      min: 2,
      max: 100,
      step: 0.5,
    })
    this.addVar('ringWidth', { name: 'ringWidth', initialValue: 50, min: 1, max: 200, step: 1 })
    this.addVar('ringHeight', { name: 'ringHeight', initialValue: 20, min: 1, max: 200, step: 1 })
    this.addVar('numJoins', { name: 'numJoins', initialValue: 10, min: 0, max: 200, step: 1 })
    this.addVar('numRings', { name: 'numRings', initialValue: 12, min: 5, max: 200, step: 1 })
    this.addVar('ringSpacing', {
      name: 'ringSpacing',
      initialValue: 5,
      min: 0.1,
      max: 16,
      step: 0.1,
    })
    this.addVar('sizeOscAmount', {
      name: 'sizeOscAmount',
      initialValue: 0,
      min: 0,
      max: 1,
      step: 0.01,
    })
    this.addVar('sizeOscFreq', {
      name: 'sizeOscFreq',
      initialValue: 0,
      min: 0,
      max: 16,
      step: 0.01,
    })
    this.addVar('ringQuality', {
      name: 'ringQuality',
      initialValue: 100,
      min: 3,
      max: 250,
      step: 1,
    })
    this.addVar('deformDist', {
      name: 'deformDist',
      initialValue: 2,
      min: 0.01,
      max: 50,
      step: 0.01,
    })
    this.addVar('perlinDiv', {
      initialValue: 25,
      min: 1,
      max: 200,
      step: 0.1,
      disableRandomize: true,
    })
    this.addVar('perlinOffsetX', { initialValue: 0, min: 0, max: 250, step: 1 })
    this.addVar('perlinOffsetY', { initialValue: 0, min: 0, max: 250, step: 1 })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    const {
      offsetX,
      offsetY,
      structures,
      structureSpacing,
      numRings,
      numJoins,
      ringQuality,
      ringWidth,
      ringHeight,
      sizeOscAmount,
      sizeOscFreq,
      ringSpacing,
      deformDist,
      perlinDiv,
      perlinOffsetX,
      perlinOffsetY,
    } = this.vars

    const structureSpacingWidth = structureSpacing * (structures - 1)
    for (let n = 0; n < structures; n++) {
      const spacingHeight = ringSpacing * numRings
      const rings: Point[][] = []
      for (let i = 0; i < numRings; i++) {
        const percent = i / numRings
        const modified = Math.sin(percent * Math.PI)
        const ringPts = getRingPts(
          this.cp
            .clone()
            .add(
              -structureSpacingWidth / 2 + structureSpacing * n,
              -spacingHeight / 2 + ringSpacing * i
            ),
          ringWidth +
            Math.cos(percent * sizeOscFreq * Math.PI) * sizeOscAmount * ringWidth +
            modified * 20,
          ringHeight +
            Math.sin(percent * sizeOscFreq * Math.PI) * sizeOscAmount * ringHeight +
            modified * 10,
          ringQuality
        ).map((pt) => {
          const angle = perlin2(
            (pt.x + perlinOffsetX) / perlinDiv,
            (pt.y + perlinOffsetY) / perlinDiv
          )
          console.log(angle)
          return pt.moveAlongAngle(angle, deformDist).add(offsetX, offsetY)
        })
        ringPts.push(ringPts[0])
        rings.push(ringPts)
        this.ctx.strokePath(ringPts)
      }
      for (let i = 0; i < numJoins; i++) {
        const pts = rings.map((ring) => {
          const index = Math.floor(ring.length * (i / numJoins))
          return ring[index]
        })
        this.ctx.strokePath(pts)
      }
    }
  }

  draw(): void {
    //
  }
}
