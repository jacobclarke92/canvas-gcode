import Point from '../Point'
import { Sketch } from '../Sketch'
import { randIntRange } from '../utils/numberUtils'
import { stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

const colors = {
  yellow: 'rgba(233,195,15,0.5)',
  blue: 'rgba(120,185,185,0.5)',
  // green: 'rgba(160,178,95,0.5)',
  // pink: 'rgba(247,150,120,0.5)',
  purple: 'rgba(168,111,120,0.5)',
  orange: 'rgba(215,125,50,0.5)',
}

export default class Watercolour extends Sketch {
  static disableOverclock = true

  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { initialValue: 5, min: 0.1, max: 20, step: 0.1 })
    this.addVar('lineThickness', { initialValue: 20, min: 1, max: 100, step: 1 })
    this.addVar('spacingAmount', { initialValue: 10, min: 0.1, max: 50, step: 0.1 })
    this.addVar('spacingCompound', { initialValue: 1, min: 0.01, max: 2, step: 0.01 })
    this.addVar('indexOffset', { initialValue: 1, min: 1, max: 100, step: 1 })
  }

  initDraw(): void {
    const { seed, gutter, lineThickness, spacingAmount, spacingCompound, indexOffset } = this.vars
    seedRandom(seed)

    this.ctx.ctx.clearRect(0, 0, this.cw, this.ch)
    this.ctx.ctx.fillStyle = 'rgba(255,255,255,1)'
    this.ctx.ctx.fillRect(0, 0, this.cw, this.ch)

    this.ctx.ctx.globalCompositeOperation = 'multiply' // AKA add / linear-dodge

    const count = Object.keys(colors).length
    /*
    this.ctx.ctx.lineWidth = 20 / this.ctx.virtualScale
    for (let x = 0; x < count; x++) {
      this.ctx.strokeStyle = Object.values(colors)[x]
      this.ctx.strokeLine(new Point(10 + 10 * x, 5), new Point(10 + 10 * x, 65))
    }
    for (let y = 0; y < count; y++) {
      this.ctx.strokeStyle = Object.values(colors)[y]
      this.ctx.strokeLine(new Point(5, 10 + 10 * y), new Point(65, 10 + 10 * y))
    }
    */

    this.ctx.ctx.lineWidth = lineThickness / this.ctx.virtualScale
    /*
    for (let c = 0; c < count; c++) {
      this.ctx.strokeStyle = Object.values(colors)[c]
      const pt = new Point(
        randIntRange(this.cw * 0.8, this.cw * 0.2),
        randIntRange(this.ch * 0.8, this.ch * 0.2)
      )
      const spokes = 16
      for (let i = 0; i < spokes; i++) {
        const angle = (i / spokes) * Math.PI
        this.ctx.strokeLine(
          pt.clone().moveAlongAngle(angle + Math.PI, 100),
          pt.clone().moveAlongAngle(angle, 100)
        )
      }
    }
    */
    for (let c = 0; c < count; c++) {
      let x = gutter
      this.ctx.strokeStyle = Object.values(colors)[c]
      const spacing = Math.pow(c + indexOffset, spacingCompound) * spacingAmount
      let panik = 0
      while (x < this.cw - gutter && panik < 1000) {
        this.ctx.strokeLine(new Point(x, gutter), new Point(x, this.ch - gutter))
        x += spacing
        panik++
      }
      stopAndWigglePen(this)
    }
  }

  draw(increment: number): void {
    //
  }
}
