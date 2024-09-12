import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, penUp } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class Bulge extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('speedUp', {
      initialValue: 50,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('seed', {
      initialValue: 1000,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('outerGap', {
      initialValue: 12,
      min: 0,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('cols', {
      initialValue: 90,
      min: 1,
      max: 200,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('rows', {
      initialValue: 90,
      min: 1,
      max: 200,
      step: 1,
      disableRandomize: true,
    })
    this.vs.square = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.addVar('bulgeX', {
      initialValue: this.cw / 2,
      min: 0,
      max: this.cw,
      step: 0.1,
    })
    this.addVar('bulgeY', {
      initialValue: this.ch / 2,
      min: 0,
      max: this.ch,
      step: 0.1,
    })
    this.addVar('bulgeSize', {
      initialValue: 80,
      min: 0,
      max: this.ch / 2,
      step: 1,
    })
    this.addVar('distribution', {
      initialValue: -0.3,
      min: -1,
      max: 1,
      step: 0.0001,
    })
    this.addVar('distributionScale', {
      initialValue: 1.5,
      min: 0,
      max: 5,
      step: 0.0001,
    })
    this.addVar('maxHeight', {
      initialValue: 6,
      min: 0,
      max: 100,
      step: 0.1,
    })
    this.vs.hideOutsideSquares = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
  }

  private drawCount = 0
  private maxDrawCount = 0
  private boxSize = 1
  private startX = 0
  private effectiveHeight: number
  private bulgePt: Point

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    const isSquare = !!this.vs.square.value
    const { cols: _cols, rows, outerGap, bulgeX, bulgeY } = this.vars
    const cols = isSquare ? rows : _cols

    this.effectiveHeight = this.ch - outerGap * 2
    this.boxSize = this.effectiveHeight / rows
    this.drawCount = 0
    this.maxDrawCount = rows * cols
    this.startX = this.cw / 2 - (this.boxSize * cols) / 2

    this.bulgePt = new Point(bulgeX, bulgeY)
    debugDot(this.ctx, this.bulgePt)
  }

  draw(increment: number): void {
    if (this.drawCount >= this.maxDrawCount) {
      penUp(this)
      return
    }
    const isSquare = !!this.vs.square.value
    const hideOutsideSquares = !!this.vs.hideOutsideSquares.value
    const {
      speedUp,
      cols: _cols,
      rows,
      outerGap,
      bulgeSize,
      maxHeight,
      distribution,
      distributionScale,
    } = this.vars
    const cols = isSquare ? rows : _cols

    for (let i = 0; i < speedUp; i++) {
      const realCount = this.drawCount + i
      if (realCount >= this.maxDrawCount) break

      const x = realCount % cols
      const y = Math.floor(realCount / cols)

      if (x % 2 === 0 || y % 2) continue

      const xPos = this.startX + x * this.boxSize
      const yPos = outerGap + y * this.boxSize

      const insideBulge =
        this.bulgePt.distanceTo(new Point(xPos + this.boxSize / 2, yPos + this.boxSize / 2)) <=
        bulgeSize
      if (hideOutsideSquares && !insideBulge) continue

      const squarePts = [
        new Point(xPos, yPos),
        new Point(xPos + this.boxSize, yPos),
        new Point(xPos + this.boxSize, yPos + this.boxSize),
        new Point(xPos, yPos + this.boxSize),
      ]
      this.ctx.beginPath()
      this.ctx.strokePath(squarePts)
      this.ctx.closePath()
      this.ctx.stroke()

      if (insideBulge) {
        // const height = maxHeight // randFloatRange(maxHeight)
        const elevatedSquarePts = squarePts.map((pt) => {
          const dist = this.bulgePt.distanceTo(pt)
          const height =
            Math.sin((dist / bulgeSize + distribution) * Math.PI * 2 * distributionScale) *
            maxHeight
          return pt.clone().moveAlongAngle(this.bulgePt.angleTo(pt), height)
        })
        console.log(elevatedSquarePts)

        this.ctx.beginPath()
        this.ctx.strokePath(elevatedSquarePts)
        this.ctx.closePath()
        this.ctx.stroke()

        this.ctx.beginPath()
        this.ctx.strokeLine(squarePts[0], elevatedSquarePts[0])
        this.ctx.strokeLine(squarePts[1], elevatedSquarePts[1])
        this.ctx.strokeLine(squarePts[2], elevatedSquarePts[2])
        this.ctx.strokeLine(squarePts[3], elevatedSquarePts[3])
      }
    }
    this.drawCount += this.vs.speedUp.value
  }
}
