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
  ],
  
} as const
type TetrisPieceMatrix = (typeof tetrisPieceRotations)[keyof typeof tetrisPieceRotations][number]

const getPieceWidth = (matrix: TetrisPieceMatrix, cols = 4) => {
  let w = 0
  for (let i = 0; i < matrix.length; i++) {
    const x = (i % cols) + 1
    if (matrix[i]) {
      if (x === cols + 1) return cols
      if (x > w) w = x
    }
  }
  return w
}

const getPieceHeight = (matrix: TetrisPieceMatrix, cols = 4) => {
  let h = 0
  for (let i = 0; i < matrix.length; i++) {
    const y = Math.floor(i / cols) + 1
    if (matrix[i] && y > h) h = y
  }
  return h
}

const getBoardRowPlacementRange = (board: (1 | 0)[], cols: number, x: number) => {
  const rows = Math.floor(board.length / cols)
  let minRow = 0
  let maxRow = rows - 4
  for (let y = 0; y < rows; y++) {
    let rowIsFull = true
    for (let i = 0; i < 4; i++) {
      if (board[y * cols + x + i] === 0) rowIsFull = false
    }
    if (rowIsFull) minRow = y
    else break
  }
  for (let y = rows - 4; y >= 0; y--) {
    let rowIsEmpty = true
    for (let i = 0; i < 4; i++) {
      if (board[y * cols + x + i] === 1) rowIsEmpty = false
    }
    if (rowIsEmpty) maxRow = y
  }
  return { minRow, maxRow }
}

const logMatrix = (matrix: TetrisPieceMatrix, cols = 4) => {
  console.log(matrix.map((v, i) => (i % cols === 0 ? '\n' : '') + (v ? '██' : '░░')).join(''))
}

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
      initialValue: 36,
      min: 4,
      max: 128,
      step: 1,
    })
    this.addVar('numBlocks', {
      initialValue: 164,
      min: 0,
      max: 500,
      step: 1,
    })
    this.addVar('repositionAttempts', {
      initialValue: 1200,
      min: 0,
      max: 15000,
      step: 1,
    })
    this.vs.drawGrid = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.cutoutShapes = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.addVar('driftFromRow', {
      initialValue: 12,
      min: 0,
      max: 128,
      step: 1,
    })
    this.addVar('positionDriftRange', {
      initialValue: 8,
      min: 0,
      max: 25,
      step: 0.01,
    })
    this.addVar('rotationDriftRange', {
      initialValue: Math.PI / 4,
      min: 0,
      max: Math.PI,
      step: 0.001,
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

    const { gutter, blocksWide, numBlocks } = this.vars

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

    // this.drawTetrisPiece('O', 0, 0, 0)
    // this.drawTetrisPiece('O', 2, 0, 0)
    // this.drawTetrisPiece('I', 4, 0, 1)
    // this.drawTetrisPiece('I', 0, 2, 0)
    // this.drawTetrisPiece('I', 0, 3, 0)
    // this.drawTetrisPiece('T', 5, 0, 0)
    // this.drawTetrisPiece('T', 7, 0, 2)
    // this.drawTetrisPiece('T', 5, 1, 3)
    // this.drawTetrisPiece('T', 6, 2, 1)
    // this.drawTetrisPiece('J', 9, 0, 0)
    // this.drawTetrisPiece('J', 9, 1, 1)
    // this.drawTetrisPiece('J', 8, 2, 3)
    // this.drawTetrisPiece('J', 6, 4, 2)
    // this.drawTetrisPiece('L', 13, 0, 0)
    // this.drawTetrisPiece('L', 4, 4, 1)
    // this.drawTetrisPiece('L', 12, 0, 3)
    // this.drawTetrisPiece('L', 7, 5, 2)
    // this.drawTetrisPiece('S', 15, 0, 0)
    // this.drawTetrisPiece('S', 14, 1, 1)
    // this.drawTetrisPiece('Z', 16, 1, 1)
    // this.drawTetrisPiece('Z', 2, 4, 0)

    this.ctx.ctx?.canvas.addEventListener('click', () => {
      this.placeRandomTetrisPiece()
    })
    let panik = 0
    for (let i = 0; i < numBlocks; i++) {
      const placed = this.placeRandomTetrisPiece()
      if (placed) panik = 0
      if (!placed) {
        panik++
        if (panik < 100) i--
        else {
          console.log('panik')
          break
        }
      }
    }
  }

  /** assumes valid placement, also populates board values */
  drawTetrisPiece(type: TetrisPiece, col: number, row: number, rotation = 0): void {
    if (type === 'O') rotation = 0
    else if (['I', 'S', 'Z'].includes(type)) rotation = rotation % 2
    else rotation = rotation % 4

    const matrix = tetrisPieceRotations[type][rotation]
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i]) {
        this.board[(row + Math.floor(i / 4)) * this.vars.blocksWide + col + (i % 4)] = 1
        // debugDot(
        //   this.ctx,
        //   (col + (i % 4)) * this.cellSize,
        //   (row + Math.floor(i / 4)) * this.cellSize
        // )
      }
    }

    const { driftFromRow, positionDriftRange, rotationDriftRange, blocksWide } = this.vars
    let driftX = 0
    let driftY = 0
    let wonk = randFloat(0.01)
    if (row >= driftFromRow) {
      const scalePercent = (row - driftFromRow) / (blocksWide - driftFromRow)
      console.log(row, scalePercent)
      driftX = randFloat(positionDriftRange * scalePercent)
      driftY = Math.abs(driftX / 2)
      wonk = randFloat(rotationDriftRange * scalePercent)
    }

    this.ctx.scale(this.cellSize)
    this.ctx.ctx.lineWidth /= this.cellSize
    const translateX = col + driftX / this.cellSize
    const translateY = row + driftY / this.cellSize
    this.ctx.translate(translateX, translateY)
    this.ctx.scale(1 / 1.05)
    this.ctx.rotate(wonk)
    this.ctx.beginPath()
    this.drawMatrix(matrix)
    this.ctx.closePath()
    this.ctx.stroke({ cutout: !!this.vs.cutoutShapes.value })
    this.ctx.rotate(-wonk)
    this.ctx.scale(1.05)
    this.ctx.translate(-translateX, -translateY)
    this.ctx.ctx.lineWidth *= this.cellSize
    this.ctx.scale(1 / this.cellSize)
  }

  drawMatrix(matrix: TetrisPieceMatrix, w = 4, h = 4): void {
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

  placeRandomTetrisPiece() {
    const { gutter, blocksWide, repositionAttempts } = this.vars

    // bonus 'I' pieces because I'm benevolent
    const type = [...tetrisPieces, 'I' as const][randIntRange(tetrisPieces.length - 1 + 1)]

    const placementAttempts: {
      x: number
      y: number
      rotation: number
      bits: number[]
      coverage: number
      minRow: number
      maxRow: number
    }[] = []

    // const usableWidth = this.ch - gutter * 2
    // const blocksTall = Math.floor(usableWidth / this.cellSize)
    // const emptyCoords: [x: number, y: number][] = []
    // const emptyXCoords: number[] = []
    // for (let i = 0; i < blocksWide * blocksTall; i++) {
    //   if (this.board[i] === 0) {
    //     const x = i % blocksWide
    //     if (!emptyXCoords.includes(x)) emptyXCoords.push(x)
    //     // emptyCoords.push([i % blocksWide, Math.floor(i / blocksTall)])
    //   }
    // }

    for (let i = 0; i < repositionAttempts; i++) {
      const rotation =
        type === 'O' ? 0 : ['I', 'S', 'Z'].includes(type) ? randIntRange(1) : randIntRange(3)

      const matrix = tetrisPieceRotations[type][rotation]
      const pieceWidth = getPieceWidth(matrix)
      const pieceHeight = getPieceHeight(matrix)

      // hmmm turns out full random is better than trying to fit things into empty places...
      const x = randIntRange(blocksWide - pieceWidth)
      // const x = emptyXCoords[randIntRange(emptyXCoords.length - 1)]
      let { minRow, maxRow } = getBoardRowPlacementRange(this.board, blocksWide, x)
      minRow = Math.max(0, minRow - 1)
      const y = randIntRange(maxRow, minRow)
      // const emptyYCoords = emptyCoords
      //   .filter(([ex, ey]) => ex === x /* && ey >= minRow && ey <= maxRow*/)
      //   .map(([x, y]) => y)
      // const y = emptyYCoords[randIntRange(emptyYCoords.length - 1)]
      const bits: number[] = []
      let badPlacement = false
      pieceLoop: for (let py = 0; py < pieceHeight; py++) {
        for (let px = 0; px < pieceWidth; px++) {
          const pieceVal = matrix[py * 4 + px]
          const boardVal = this.board[(y + py) * blocksWide + x + px]

          // detect overlap with existing pieces
          if (pieceVal && boardVal) {
            badPlacement = true
            // console.clear()
            break pieceLoop
          }

          // count empty spaces being potentially covered to penalize
          const holeBits: (1 | 0)[] = []
          if (y > 0) holeBits.push(this.board[(y - 1) * blocksWide + x + px])
          for (let p = 0; p < py + 1; p++) {
            holeBits.push((matrix[p * 4 + px] ^ this.board[(y + p) * blocksWide + x + px]) as 1 | 0)
          }
          let overhangs = 0
          if (holeBits.length > 1) {
            for (let h = 1; h < holeBits.length; h++) {
              const prevHoleVal = holeBits[h - 1]
              const currentHoleVal = holeBits[h]
              if (prevHoleVal === 0 && currentHoleVal === 1) overhangs++
            }
          }

          const goodRowPlacementPercent =
            1 + (maxRow + pieceHeight - (y - minRow)) / (maxRow + pieceHeight - minRow)
          bits.push(
            -overhangs * 10 +
              (pieceVal ^ boardVal) *
                (py === 0 ? (pieceVal ? 1.5 : 0.05) : 1) *
                (py === 1 ? (pieceVal ? 1.3 : 0.1) : 1) *
                (!pieceVal ? 1 : goodRowPlacementPercent * 6)
          )
        }
      }
      if (badPlacement) continue
      const coverage = bits.reduce((a, b) => a + b, 0)
      if (coverage < 5) continue
      placementAttempts.push({
        x,
        y,
        coverage,
        bits,
        rotation,
        minRow,
        maxRow,
      })
    }
    if (!placementAttempts.length) return false
    const sortedPlacementAttempts = [...placementAttempts].sort((a, b) => b.coverage - a.coverage)

    const { x, y, rotation, coverage, bits, minRow, maxRow } = sortedPlacementAttempts[0]

    const matrix = tetrisPieceRotations[type][rotation]
    logMatrix(matrix)
    console.log({ type, rotation, coverage, bits, minRow, maxRow })
    console.log('lowest:', sortedPlacementAttempts[sortedPlacementAttempts.length - 1].coverage)
    this.drawTetrisPiece(type, x, y, rotation)
    return true
  }

  draw(increment: number): void {
    //
  }
}
