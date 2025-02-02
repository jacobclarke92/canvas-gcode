import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { getCircleCircleIntersectionPoints } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
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
      initialValue: 3,
      min: 1,
      max: 6,
      step: 1,
      disableRandomize: true,
    })

    this.addVar('waves', {
      initialValue: 60,
      min: 2,
      max: 500,
      step: 1,
    })

    this.addVar('waveDist', {
      initialValue: 1.5,
      min: 0.1,
      max: 12,
      step: 0.1,
    })

    this.addVar('wavesApartX', {
      initialValue: 40,
      min: 1,
      max: 200,
      step: 1,
    })

    this.addVar('wavesApartY', {
      initialValue: 0.0000001,
      min: -200,
      max: 200,
      step: 1,
    })

    this.vs.showCircles = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })

    this.vs.showDebug = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
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

    const circleSets: { pt: Point; radius: number }[][] = []

    for (let i = 0; i < sources; i++) {
      circleSets[i] = []
      const pt = new Point(
        wavesApartX === 0 ? startX : startX + i * distXBetweenSources,
        wavesApartY === 0 ? startY : startY + i * distYBetweenSources
      )
      for (let j = 0; j < waves; j++) {
        const radius = waveDist * (j + 1)
        // if (!!this.vs.showCircles.value) this.ctx.strokeCircle(pt, r)
        circleSets[i].push({ pt, radius })
      }
    }

    const arcSets: { pt: Point; radius: number; startPt: Point; endPt: Point; rev: boolean }[] = []

    for (let sourceIdx = 1; sourceIdx < sources; sourceIdx++) {
      const prevCircleSet = circleSets[sourceIdx - 1]
      const circleSet = circleSets[sourceIdx]
      const nextCircleSet = circleSets[sourceIdx + 1]

      for (let c = 0; c < waves; c++) {
        const { pt: prevPt, radius: prevR } = prevCircleSet[c]
        const { pt: pt, radius: r } = circleSet[waves - 1 - c]

        const prevInterPts = getCircleCircleIntersectionPoints([prevPt, prevR], [pt, r])
        let nextInterPts: typeof prevInterPts = []
        let nextR = 0
        let nextPt: Point = new Point(0, 0)
        if (nextCircleSet) {
          // const { pt: nextPt, radius: nextR } = nextCircleSet[c]
          nextR = nextCircleSet[c].radius
          nextPt = nextCircleSet[c].pt

          nextInterPts = getCircleCircleIntersectionPoints([pt, r], [nextPt, nextR])
        }
        if (prevInterPts.length) {
          if (this.vs.showDebug.value) for (const pt of prevInterPts) debugDot(this.ctx, pt, 'red')
          if (sourceIdx === 1) {
            arcSets.push({
              pt: prevPt,
              radius: r,
              startPt: prevInterPts[0],
              endPt: prevInterPts[1],
              rev: true,
            })
          }
          if (nextCircleSet && nextInterPts.length) {
            // debugLine(this.ctx, prevInterPts[0], nextInterPts[0], 'red')
            // debugLine(this.ctx, prevInterPts[1], nextInterPts[1], 'red')
            arcSets.push({
              pt: pt,
              radius: nextR,
              startPt: prevInterPts[0],
              endPt: nextInterPts[0],
              rev: prevInterPts[0].x > nextInterPts[0].x,
            })
            arcSets.push({
              pt: pt,
              radius: nextR,
              startPt: prevInterPts[1],
              endPt: nextInterPts[1],
              rev: prevInterPts[0].x < nextInterPts[0].x,
            })
          } else {
            arcSets.push({
              pt: pt,
              radius: prevR,
              startPt: prevInterPts[0],
              endPt: prevInterPts[1],
              rev: false,
            })
          }
        }

        // for (let d = 0; d < circleSet.length - 1; d++) {
        //   const [pt2, r] = circleSet[d]
        //   const pts = getCircleCircleIntersectionPoints([prevPt, prevR], [pt2, r])
        //   for (const pt of pts) debugDot(this.ctx, pt, 'red')
        // }
      }
    }

    for (const { pt, radius, startPt, endPt, rev } of arcSets) {
      // this.ctx.beginPath()
      // this.ctx.moveTo(startPt.x, startPt.y)
      // this.ctx.lineTo(endPt.x, endPt.y)
      // this.ctx.stroke()
      this.ctx.beginPath()
      this.ctx.arc(pt.x, pt.y, radius, pt.angleTo(startPt), pt.angleTo(endPt), rev)
      this.ctx.stroke()
      // this.ctx.strokeCircle(pt, radius)
      // this.ctx.strokeLine(startPt, endPt)
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
