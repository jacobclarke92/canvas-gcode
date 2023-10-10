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

    this.ctx.strokeRect(30, 30, 25, 25, { cutout: true })
    this.ctx.strokeRect(35, 35, 25, 25, { cutout: true })
    this.ctx.strokeRect(40, 40, 25, 25, { cutout: true })

    this.ctx.beginPath()
    this.ctx.moveTo(30 + 28, 25 + 14)
    this.ctx.lineTo(35 + 28, 20 + 14)
    this.ctx.lineTo(40 + 28, 25 + 14)
    this.ctx.lineTo(40 + 28, 40 + 14)
    this.ctx.lineTo(30 + 28, 40 + 14)
    this.ctx.lineTo(30 + 28, 25 + 14)
    this.ctx.stroke({ cutout: true })
    this.ctx.closePath()
  }

  draw(increment: number): void {
    //
  }
}
