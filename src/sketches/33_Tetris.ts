import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getClosestButNotSamePoint,
  getClosestPoint,
  getLineIntersectionPoints,
  getPointsWhereLineIntersectsCircle,
  lineIntersectsWithAny,
  pointInCircles,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import {
  angleDiff,
  degToRad,
  radToDeg,
  randFloat,
  randFloatRange,
  randIntRange,
  smallestAngleDiff,
} from '../utils/numberUtils'
import { lineToPoints, sameFloat } from '../utils/pathUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

const tetrisPieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const
type TetrisPiece = (typeof tetrisPieces)[number]

/**
 * making them lie down as much as possible and scoot to the top left
 * then rotate clockwise
 */
// prettier-ignore
const tetrisPieceRotations = {
  'O': [[
    1, 1, 0, 0, 
    1, 1, 0, 0, 
    0, 0, 0, 0, 
    0, 0, 0, 0, 
  ]],
  'I': [
    [
      1, 1, 1, 1, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 0, 0, 0, 
      1, 0, 0, 0, 
      1, 0, 0, 0, 
      1, 0, 0, 0, 
    ],
  ],
  'S': [
    [
      0, 1, 1, 0, 
      1, 1, 0, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 0, 0, 0, 
      1, 1, 0, 0, 
      0, 1, 0, 0, 
      0, 0, 0, 0, 
    ],
  ],
  'Z': [
    [
      1, 1, 0, 0, 
      0, 1, 1, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      0, 1, 0, 0, 
      1, 1, 0, 0, 
      1, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
  ],
  'L': [
    [
      1, 1, 1, 0, 
      1, 0, 0, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 1, 0, 0,
      0, 1, 0, 0,
      0, 1, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      0, 0, 1, 0, 
      1, 1, 1, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 0, 0, 0, 
      1, 0, 0, 0, 
      1, 1, 0, 0, 
      0, 0, 0, 0, 
    ],
  ],
  'J': [
    [
      1, 1, 1, 0, 
      0, 0, 1, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      0, 1, 0, 0, 
      0, 1, 0, 0, 
      1, 1, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 0, 0, 0, 
      1, 1, 1, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 1, 0, 0, 
      1, 0, 0, 0, 
      1, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
  ],
  'T': [
    [
      1, 1, 1, 0, 
      0, 1, 0, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      0, 1, 0, 0, 
      1, 1, 0, 0, 
      0, 1, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      0, 1, 0, 0, 
      1, 1, 1, 0, 
      0, 0, 0, 0, 
      0, 0, 0, 0, 
    ],
    [
      1, 0, 0, 0,
      1, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 0,
    ],
  ]
} as const
type TetrisPieceMatrix = (typeof tetrisPieceRotations)[keyof typeof tetrisPieceRotations][number]

export default class Tetris extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('seed', {
      initialValue: 3975,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 50,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('blocksWide', {
      initialValue: 16,
      min: 4,
      max: 128,
      step: 1,
    })
    this.vs.drawGrid = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
  }

  increment = 0
  board: (1 | 0)[] = []

  cellSize = 0

  initDraw(): void {
    console.log('init draw called')
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const { gutter, blocksWide } = this.vars

    this.increment = 0

    const width = this.cw - gutter * 2
    const usableWidth = this.ch - gutter * 2
    const usableHeight = this.ch - gutter * 2
    this.cellSize = usableHeight / blocksWide
    const blocksTall = Math.floor(usableWidth / this.cellSize)

    this.board = [...Array(blocksWide * blocksTall).fill(0)]

    this.ctx.translate((width - usableWidth) / 2 + gutter, gutter)

    if (this.vs.drawGrid.value) this.ctx.strokeRect(0, 0, usableWidth, usableHeight)
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    for (let i = 0; i < blocksWide; i++) {
      const x = i * this.cellSize
      if (this.vs.drawGrid.value) this.ctx.strokeLine(x, 0, x, usableHeight)
    }
    for (let i = 0; i < blocksTall; i++) {
      const y = i * this.cellSize
      if (this.vs.drawGrid.value) this.ctx.strokeLine(0, y, usableWidth, y)
    }
    this.ctx.strokeStyle = 'black'

    this.drawTetrisPiece('O', 0, 0, 0)
    this.drawTetrisPiece('O', 2, 0, 0)
    this.drawTetrisPiece('I', 4, 0, 1)
    this.drawTetrisPiece('I', 0, 2, 0)
    this.drawTetrisPiece('I', 0, 3, 0)
    this.drawTetrisPiece('T', 5, 0, 0)
    this.drawTetrisPiece('T', 7, 0, 2)
    this.drawTetrisPiece('T', 5, 1, 3)
    this.drawTetrisPiece('T', 6, 2, 1)
    this.drawTetrisPiece('J', 9, 0, 0)
    this.drawTetrisPiece('J', 9, 1, 1)
    this.drawTetrisPiece('J', 8, 2, 3)
    this.drawTetrisPiece('J', 6, 4, 2)
    this.drawTetrisPiece('L', 13, 0, 0)
    this.drawTetrisPiece('L', 4, 4, 1)
    this.drawTetrisPiece('L', 12, 0, 3)
    this.drawTetrisPiece('L', 7, 5, 2)
    this.drawTetrisPiece('S', 15, 0, 0)
    this.drawTetrisPiece('S', 14, 1, 1)
    this.drawTetrisPiece('Z', 16, 1, 1)
    this.drawTetrisPiece('Z', 2, 4, 0)

    // for (let i = 0; i < 20; i++) {
    //   const x = randIntRange(blocksWide - 3)
    //   const y = randIntRange(blocksTall - 3)
    //   const type = tetrisPieces[randIntRange(tetrisPieces.length - 1)]
    //   const rotation = randIntRange(3)
    //   this.drawTetrisPiece(type, x, y, rotation)
    // }
  }

  drawTetrisPiece(type: TetrisPiece, col: number, row: number, rotation = 0): void {
    if (type === 'O') rotation = 0
    else if (['I', 'S', 'Z'].includes(type)) rotation = rotation % 2
    else rotation = rotation % 4

    const matrix = tetrisPieceRotations[type][rotation]

    this.ctx.scale(this.cellSize)
    this.ctx.ctx.lineWidth /= this.cellSize
    this.ctx.translate(col, row)
    // this.ctx.scale(1 / 1.1)
    const rot = randFloat(0.1)
    this.ctx.rotate(rot)
    this.ctx.beginPath()
    this.drawMatrix(matrix)
    this.ctx.closePath()
    this.ctx.stroke({ cutout: false })
    this.ctx.rotate(-rot)
    // this.ctx.scale(1.1)
    this.ctx.translate(-col, -row)
    this.ctx.ctx.lineWidth *= this.cellSize
    this.ctx.scale(1 / this.cellSize)
  }

  drawMatrix(matrix: TetrisPieceMatrix, w = 4, h = 4): void {
    console.log(matrix.map((v, i) => (i % w === 0 ? '\n' : '') + (v ? '██' : '░░')).join(''))
    const cells = w * h
    let dir: 'u' | 'd' | 'l' | 'r' = 'r'
    let x = 0,
      y = 0,
      initialX = 0,
      initialY = 0

    for (let i = 0; i < cells; i++) {
      const v = matrix[i]
      if (!v) continue
      x = i % w
      y = Math.floor(i / w)
      initialX = x
      initialY = y
      this.ctx.moveTo(x, y)
      break
    }

    const getV = (x: number, y: number) => matrix[y * w + x]

    let complete = false
    while (!complete) {
      if (dir === 'r') x += 1
      else if (dir === 'd') y += 1
      else if (dir === 'l') x -= 1
      else if (dir === 'u') y -= 1
      this.ctx.lineTo(x, y)

      if (dir === 'r') {
        if (y > 0 && getV(x, y - 1) === 1) dir = 'u'
        if (x >= w || getV(x, y) === 0) dir = 'd'
      } else if (dir === 'd') {
        if (getV(x, y)) dir = 'r'
        else if (y >= h || (x > 0 && getV(x - 1, y) === 0)) dir = 'l'
      } else if (dir === 'l') {
        if (x === 0 && y > 0) dir = 'u'
        else if (x > 0 && getV(x - 1, y) === 1) dir = 'd'
        else if (x > 0 && y > 0 && getV(x - 1, y - 1) === 0) dir = 'u'
      } else if (dir === 'u') {
        if (y === 0 || getV(x, y - 1) === 0) dir = 'r'
        else if (x > 0 && y > 0 && getV(x - 1, y - 1) === 1) dir = 'l'
      }

      if (x === initialX && y === initialY) complete = true
    }
  }

  draw(increment: number): void {
    //
  }
}
