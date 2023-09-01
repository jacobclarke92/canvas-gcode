import Point from '../Point'
import { Sketch } from '../Sketch'
import { perlin2 } from '../utils/noise'
import { degToRad, normalizeRadian, randFloat, randFloatRange, randInt, randIntRange, wrap } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class CutoutTest extends Sketch {
  // static generateGCode = false
  static enableCutouts = true

  init() {
    //
  }

  increment = 0

  initDraw(): void {
    this.ctx.strokeRect(25, 25, 25, 25)
    let bounds = this.ctx.path?.getBounds()
    console.log('bounds', bounds)
    this.ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top, {
      debug: true,
    })
    console.log('points', this.ctx.path?.getPoints())
    console.log('closed', this.ctx.path?.current.isClosed())

    this.ctx.save()
    this.ctx.translate(20, 20)
    this.ctx.strokeRect(0, 0, 15, 15, { cutout: true })
    this.ctx.restore()

    this.ctx.save()
    this.ctx.translate(25, 25)
    this.ctx.rotate(degToRad(5))
    this.ctx.strokeRect(0, 0, 25, 25, { cutout: true })
    this.ctx.restore()
    bounds = this.ctx.path?.getBounds()
    console.log('bounds', bounds)
    console.log('points', this.ctx.path?.getPoints())
    console.log('closed', this.ctx.path?.current.isClosed())

    this.ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top, {
      debug: true,
    })

    this.ctx.beginPath()
    this.ctx.moveTo(30 + 40, 25)
    this.ctx.lineTo(35 + 40, 20)
    this.ctx.lineTo(40 + 40, 25)
    this.ctx.lineTo(40 + 40, 40)
    this.ctx.lineTo(30 + 40, 40)
    this.ctx.lineTo(30 + 40, 25)
    this.ctx.stroke({ cutout: true })
    this.ctx.closePath()
    bounds = this.ctx.path?.getBounds()
    console.log('bounds', bounds)
    this.ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top, {
      debug: true,
    })
    console.log('points', this.ctx.path?.getPoints())
    console.log('closed', this.ctx.path?.current.isClosed())
  }

  draw(increment: number): void {
    //
  }
}
