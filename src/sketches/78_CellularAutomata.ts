import type GCanvas from '../GCanvas'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'

type Bit = 0 | 1

const createWolframRule = (ruleNumber: number): ((left: Bit, center: Bit, right: Bit) => Bit) => {
  if (ruleNumber < 0 || ruleNumber > 255 || !Number.isInteger(ruleNumber))
    throw new Error(`Rule number must be an integer between 0 and 255. ${ruleNumber} provided.`)

  return (left: Bit, center: Bit, right: Bit): Bit => {
    // Calculate the pattern index by combining the three cells into a binary number
    // left, center, right -> left * 4 + center * 2 + right * 1
    const patternIndex = (left << 2) | (center << 1) | right

    // Check if the bit at position patternIndex is set in the rule number
    // We use a bitwise AND operation to check if the bit is set
    // and return 1 if set, 0 if not
    const value = ((ruleNumber >> patternIndex) & 1) as Bit
    console.log(left, center, right, '->', value)
    return value
  }
}

export default class CellularAutomata extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('gridSize', { name: 'gridSize', initialValue: 1, min: 0.1, max: 25, step: 0.1 })
    this.addVar('rule', { name: 'rule', initialValue: 30, min: 0, max: 255, step: 1 })
  }

  state = new Int8Array()
  xCells = 0
  yCells = 0
  xOffset = 0
  yOffset = 0
  yIndex = 0
  applyRule = createWolframRule(0)

  initDraw(): void {
    seedRandom(this.vars.seed)
    seedNoise(this.vars.seed)
    const { gridSize, gutter, rule } = this.vars
    this.applyRule = createWolframRule(rule)
    this.yIndex = 0
    this.xCells = Math.floor((this.cw - gutter * 2) / gridSize)
    this.yCells = Math.floor((this.ch - gutter * 2) / gridSize)
    this.xOffset = (this.cw - this.xCells * gridSize) / 2
    this.yOffset = (this.ch - this.yCells * gridSize) / 2
    this.state = new Int8Array(this.xCells * this.yCells)
    const middleIndex = Math.floor(this.xCells / 2)
    this.state[middleIndex] = 1
    for (let y = 1; y < this.yCells; y++) {
      for (let x = 1; x < this.xCells - 1; x++) {
        this.state[y * this.xCells + x] = this.applyRule(
          this.state[(y - 1) * this.xCells + x - 1] as Bit,
          this.state[(y - 1) * this.xCells + x] as Bit,
          this.state[(y - 1) * this.xCells + x + 1] as Bit
        )
      }
    }
  }

  getCell(x: number, y: number): [Bit, Point] {
    const { gutter, gridSize } = this.vars
    return [
      this.state[y * this.xCells + x] as Bit,
      new Point(gutter + this.xOffset + x * gridSize, gutter + this.yOffset + y * gridSize),
    ]
  }

  drawCell(x: number, y: number): void {
    const { gutter, gridSize } = this.vars
    this.ctx.fillRect(
      gutter + this.xOffset + x * gridSize,
      gutter + this.yOffset + y * gridSize,
      gridSize * 0.2,
      gridSize * 0.2
    )
  }

  draw(): void {
    //
    const { gutter, gridSize } = this.vars
    if (this.yIndex >= this.yCells - 1) return

    for (let xIndex = 1; xIndex < this.xCells - 1; xIndex++) {
      const [b1, p1] = this.getCell(xIndex - 1, this.yIndex)
      const [b2, p2] = this.getCell(xIndex, this.yIndex)
      const [b3, p3] = this.getCell(xIndex + 1, this.yIndex)
      const [b4, p4] = this.getCell(xIndex - 1, this.yIndex + 1)
      const [b5, p5] = this.getCell(xIndex, this.yIndex + 1)
      const [b6, p6] = this.getCell(xIndex + 1, this.yIndex + 1)

      if (!b2) continue

      if (b3) this.ctx.strokeLine(p2, p3)
      if (b4) this.ctx.strokeLine(p2, p4)
      if (b6) this.ctx.strokeLine(p2, p6)
      // if (b5) this.ctx.strokeLine(p2, p5)
      if (b5 && !(b4 && b6)) this.ctx.strokeLine(p2, p5)

      // const [b3, p3] = this.getCell(xIndex - 1, this.yIndex)
      // const [b4, p4] = this.getCell(xIndex, this.yIndex)
      // const sum = b1 + b2 + b3 + b4
      // const pts = [b1 && p1, b2 && p2, b3 && p3, b4 && p4].filter(Boolean) as Point[]
      // if (sum === 4) {
      //   this.ctx.strokeRect(p1, gridSize, gridSize)
      // } else if (sum === 3) {
      //   if (!b4) {
      //     this.ctx.strokeTriangle(pts[0], pts[1], pts[2])
      //   } else {
      //     if (b1 && b2) this.ctx.strokeLine(p1, p2)
      //     if (b1 && b3) this.ctx.strokeLine(p1, p3)
      //     if (b2 && b3) this.ctx.strokeLine(p2, p3)
      //     if (b1 && b4) this.ctx.strokeLine(p1, p4)
      //   }
      // } else if (sum === 2) {
      //   if (!((b3 && b4) || (b2 && b4))) {
      //     this.ctx.strokeLine(pts[0], pts[1])
      //   }
      // }
    }

    this.yIndex++
  }
}
