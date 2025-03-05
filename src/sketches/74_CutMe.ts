import * as clipperLib from 'js-angusj-clipper/web'

import { deg360 } from '../constants/angles'
import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type SubPath from '../SubPath'
import type { Bounds } from '../utils/geomUtils'
import { boundsOverlapAny } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class CutMe extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore
    this.addVar('dist', { name: 'dist', initialValue: 80, min: 0, max: 200, step: 0.5 })
    this.addVar('initialRadius', { name: 'dist', initialValue: 38, min: 0, max: 100, step: 0.5 })
    this.addVar('radiusIncrement', {
      name: 'radiusIncrement',
      initialValue: 2,
      min: -10,
      max: 10,
      step: 0.1,
    })
    this.addVar('radiusSteps', {
      name: 'radiusIncrement',
      initialValue: 16,
      min: 0,
      max: 200,
      step: 1,
    })
    this.addVar('size', { name: 'dist', initialValue: 142, min: 5, max: 200, step: 0.5 })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)

    const { dist, initialRadius, radiusSteps, radiusIncrement, size } = this.vars

    const paths: SubPath[][] = []

    let radius = initialRadius
    for (let i = 0; i < radiusSteps; i++) {
      this.ctx.beginPath()
      this.ctx.rectCentered(this.cp, size, size)
      this.ctx.circle(this.cp.clone().moveAlongAngle(-Math.PI * 0.25, dist), radius)
      this.ctx.circle(this.cp.clone().moveAlongAngle(Math.PI * 0.25, dist), radius)
      this.ctx.circle(this.cp.clone().moveAlongAngle(-Math.PI * 0.75, dist), radius)
      this.ctx.circle(this.cp.clone().moveAlongAngle(Math.PI * 0.75, dist), radius)

      const { intersected } = this.ctx.clipCurrentPath({
        clipType: clipperLib.ClipType.Difference,
        pathDivisions: 128,
      })

      paths.push(this.ctx.currentPath.subPaths)

      radius += radiusIncrement
      if (radius < 0) break
    }

    for (const path of paths) {
      for (const subpath of path) {
        const actions = subpath.actions
        this.ctx.beginPath()
        for (const action of actions) {
          switch (action.type) {
            case 'MOVE_TO':
              this.ctx.moveTo(action.args[0], action.args[1])
              break
            case 'LINE_TO':
              this.ctx.lineTo(action.args[0], action.args[1])
              break
          }
        }
        this.ctx.closePath()
        this.ctx.stroke()
      }
    }
  }

  draw(): void {
    //
  }
}
