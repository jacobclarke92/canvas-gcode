import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot, debugText } from '../utils/debugUtils'
import {
  arcsOverlap,
  circleOverlapsCircles,
  getCircleCircleIntersectionPoints,
  getTangentsToCircle,
  isInBounds,
  lineIntersectsWithAny,
  pointInCircle,
  smallestSignedAngleDiff,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class CircleInterference extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('seed', {
      initialValue: 2735, //1754, // 1620, // 1728, // 2586, // 2286, //1193,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('sources', {
      initialValue: 2,
      min: 1,
      max: 5,
      step: 1,
      disableRandomize: true,
    })

    this.addVar('waves', {
      initialValue: 20,
      min: 2,
      max: 500,
      step: 1,
    })

    this.addVar('waveDist', {
      initialValue: 4.2,
      min: 0.1,
      max: 12,
      step: 0.1,
    })

    this.addVar('wavesApartX', {
      initialValue: 20,
      min: 1,
      max: 200,
      step: 1,
    })

    this.addVar('wavesApartY', {
      initialValue: 0,
      min: 0,
      max: 200,
      step: 1,
    })

    this.vs.showCircles = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })

    this.vs.showDebug = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const { sources, waves, waveDist, wavesApartX, wavesApartY } = this.vars

    const distXBetweenSources = waveDist * wavesApartX
    const distYBetweenSources = waveDist * wavesApartY
    const startX =
      wavesApartX === 0 ? this.cw / 2 : this.cw / 2 - (distXBetweenSources * (sources - 1)) / 2
    const startY =
      wavesApartY === 0 ? this.ch / 2 : this.ch / 2 - (distYBetweenSources * (sources - 1)) / 2

    const circleSets: [pt: Point, radius: number][][] = []

    for (let i = 0; i < sources; i++) {
      circleSets[i] = []
      const pt = new Point(
        wavesApartX === 0 ? startX : startX + i * distXBetweenSources,
        wavesApartY === 0 ? startY : startY + i * distYBetweenSources
      )
      for (let j = i; j < waves; j++) {
        const r = waveDist * j
        if (!!this.vs.showCircles.value) this.ctx.strokeCircle(pt, r)
        circleSets[i].push([pt, r])
      }
    }

    for (let i = 1; i < circleSets.length; i++) {
      const circleSet1 = circleSets[i - 1]
      const circleSet2 = circleSets[i]

      for (let c = 0; c < circleSet1.length - 1; c++) {
        const [pt1, r1] = circleSet1[c]
        for (let d = 0; d < circleSet2.length - 1; d++) {
          const [pt2, r2] = circleSet2[d]
          const pts = getCircleCircleIntersectionPoints([pt1, r1], [pt2, r2])
          for (const pt of pts) debugDot(this.ctx, pt, 'red')
        }
      }
    }

    // const pt1 = new Point(100, 100)
    // const radius1 = 50
    // const pt2 = new Point(150, 120)
    // const radius2 = 50

    // this.ctx.strokeCircle(pt1, radius1)
    // this.ctx.strokeCircle(pt2, radius2)

    // const pts = getCircleCircleIntersectionPoints([pt1, radius1], [pt2, radius2])
    // for (const pt of pts) debugDot(this.ctx, pt, 'red')
  }

  draw(increment: number): void {
    //
  }
}
