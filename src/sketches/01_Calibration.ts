import { Sketch } from '../Sketch'
import type { Vector } from '../types'
import { randFloat, randInt, randIntRange, wrap } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import Range from './tools/Range'

export default class Calibration extends Sketch {
  pos: Vector
  static generateGCode = true
  static enableCutouts = false

  init() {
    //
  }

  initDraw() {
    //
    initPen(this)
    plotBounds(this)

    //

    penUp(this)
  }

  draw(increment: number) {
    //
  }
}
