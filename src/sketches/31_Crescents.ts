import * as clipperLib from 'js-angusj-clipper/web'

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

export default class Crescents extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore
    this.addVar('atLeast', {
      initialValue: 700,
      min: 1,
      max: 5000,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('maxRadius', {
      initialValue: 7,
      min: 0.5,
      max: 100,
      step: 0.5,
      disableRandomize: true,
    })
    this.addVar('minRadius', {
      initialValue: 2.5,
      min: 2,
      max: 100,
      step: 0.05,
      disableRandomize: true,
    })
  }

  private crescents: { bounds: Bounds; subPaths: SubPath[] }[] = []
  private redrawnCount = 0
  private reordered = false

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    this.crescents = []
    this.redrawnCount = 0
    this.reordered = false
  }

  draw(): void {
    if (this.crescents.length >= this.vs.atLeast.value) {
      if (!this.reordered) {
        this.crescents = this.crescents.sort((a, b) => {
          // dist from 0,0
          const distA = Math.round(Math.sqrt(a.bounds[0] ** 2 + a.bounds[1] ** 2) / 10)
          const distB = Math.round(Math.sqrt(b.bounds[0] ** 2 + b.bounds[1] ** 2) / 10)
          if (distA === distB) return a.bounds[3] * b.bounds[0] - b.bounds[3] * a.bounds[0]
          return distA - distB
        })
        this.reordered = true
        this.ctx.reset()
        initPen(this)
        plotBounds(this)
        return
      } else {
        if (this.redrawnCount < this.crescents.length) {
          const subPaths = this.crescents[this.redrawnCount].subPaths
          if (!subPaths.length) {
            this.redrawnCount++
            return
          }
          const actions = this.crescents[this.redrawnCount].subPaths[0].actions
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
          this.ctx.stroke()
          this.ctx.closePath()
          this.redrawnCount++
        } else {
          penUp(this)
          return
        }
      }
      return
    }

    const { minRadius, maxRadius } = this.vars

    this.ctx.beginPath()

    const pt1 = new Point(
      randIntRange(this.cw - maxRadius, maxRadius),
      randIntRange(this.ch - maxRadius, maxRadius)
    )

    const rad1 = randIntRange(maxRadius, minRadius)
    this.ctx.circle(pt1, rad1)
    const ang = randFloatRange(0, Math.PI * 2)
    const rad2 = Math.abs(rad1 + randIntRange(maxRadius, minRadius) - (maxRadius - minRadius) / 3)
    const pt2 = pt1.clone().moveAlongAngle(ang, rad1)
    this.ctx.circle(pt2, rad2)

    let intersected = false
    try {
      const res = this.ctx.clipCurrentPath({
        clipType: clipperLib.ClipType.Difference,
        pathDivisions: 32,
      })
      intersected = res.intersected
    } catch (e) {
      return
    }
    if (!intersected) {
      return
    }

    const { left, top, bottom, right } = this.ctx.path.getBounds()
    const bounds = [top, right, bottom, left] as Bounds
    if (
      this.crescents.length > 0 &&
      boundsOverlapAny(bounds, ...this.crescents.map(({ bounds }) => bounds))
    ) {
      return
    }
    this.crescents.push({ bounds, subPaths: this.ctx.path.subPaths })
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
