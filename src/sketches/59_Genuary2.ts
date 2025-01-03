import type Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

const tendrilToLines = (tendril: Point[]): Line[] => {
  const lines: Line[] = []
  for (let i = 0; i < tendril.length - 1; i++) {
    lines.push([tendril[i], tendril[i + 1]])
  }
  return lines
}

export default class Genuary1 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { disableRandomize: true, initialValue: 3, min: 0, max: 100, step: 0.1 })
    this.vs.debugColors = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    // Prompt: Layers upon layers upon layers
  }

  draw(increment: number): void {
    //
  }
}
