import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

interface Cell {
  x: number
  y: number
  connectTop: boolean
  connectRight: boolean
  connectBottom: boolean
  connectLeft: boolean
}

const createCell = (x: number, y: number): Cell => ({
  x,
  y,
  connectTop: !!randIntRange(1),
  connectRight: !!randIntRange(1),
  connectBottom: !!randIntRange(1),
  connectLeft: !!randIntRange(1),
})

export default class WaveCollapse extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 5, min: 0, max: 50, step: 0.2 })
    this.addVar('gridSize', { initialValue: 32, min: 2, max: 128, step: 1 })

    this.vs.displayGrid = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  done = false
  cols = 0
  rows = 0
  offsetX = 0
  offsetY = 0

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    const { points, gutter, gridSize } = this.vars
    this.cols = Math.floor((this.cw - gutter * 2) / gridSize)
    this.rows = Math.floor((this.ch - gutter * 2) / gridSize)

    this.offsetX = (this.cw - (gutter * 2 + this.cols * gridSize)) / 2
    this.offsetY = (this.ch - (gutter * 2 + this.rows * gridSize)) / 2

    if (this.vs.displayGrid.value) {
      // Start drawing debug grid
      this.ctx.strokeStyle = '#222222'
      this.ctx.beginPath()
      for (let i = 0; i <= this.cols; i++) {
        const x = this.offsetX + gutter + i * gridSize
        this.ctx.moveTo(x, this.offsetY + gutter)
        this.ctx.lineTo(x, this.offsetY + gutter + gridSize * this.rows)
        this.ctx.stroke()
      }
      for (let i = 0; i <= this.rows; i++) {
        const y = this.offsetY + gutter + i * gridSize
        this.ctx.moveTo(this.offsetX + gutter, y)
        this.ctx.lineTo(this.offsetX + gutter + gridSize * this.cols, y)
        this.ctx.stroke()
      }
      this.ctx.closePath()
      // Finish drawing debug grid
    }
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    // if (increment % 500 !== 0) return
  }
}
