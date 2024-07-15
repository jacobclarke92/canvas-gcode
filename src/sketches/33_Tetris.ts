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
  board: boolean[][] = []

  /**
  
  █▓▒░

  making them lie down as much as possible and scoot to the top left
  then rotate clockwise
  
  O
  ██ ██ ░░ ░░
  ██ ██ ░░ ░░
  ░░ ░░ ░░ ░░
  ░░ ░░ ░░ ░░  

  I
  ██ ██ ██ ██  ██ ░░ ░░ ░░  
  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░  
  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░  
  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░  

  S
  ░░ ██ ██ ░░  ██ ░░ ░░ ░░  
  ██ ██ ░░ ░░  ██ ██ ░░ ░░  
  ░░ ░░ ░░ ░░  ░░ ██ ░░ ░░  
  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  

  Z
  ██ ██ ░░ ░░  ░░ ██ ░░ ░░  
  ░░ ██ ██ ░░  ██ ██ ░░ ░░
  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░  
  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  

  L
  ██ ██ ██ ░░  ██ ██ ░░ ░░  ░░ ░░ ██ ░░  ██ ░░ ░░ ░░
  ██ ░░ ░░ ░░  ░░ ██ ░░ ░░  ██ ██ ██ ░░  ██ ░░ ░░ ░░
  ░░ ░░ ░░ ░░  ░░ ██ ░░ ░░  ░░ ░░ ░░ ░░  ██ ██ ░░ ░░
  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░

  J
  ██ ██ ██ ░░  ░░ ██ ░░ ░░  ██ ░░ ░░ ░░  ██ ██ ░░ ░░
  ░░ ░░ ██ ░░  ░░ ██ ░░ ░░  ██ ██ ██ ░░  ██ ░░ ░░ ░░
  ░░ ░░ ░░ ░░  ██ ██ ░░ ░░  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░
  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░

  T
  ██ ██ ██ ░░  ░░ ██ ░░ ░░  ░░ ██ ░░ ░░  ██ ░░ ░░ ░░
  ░░ ██ ░░ ░░  ██ ██ ░░ ░░  ██ ██ ██ ░░  ██ ██ ░░ ░░
  ░░ ░░ ░░ ░░  ░░ ██ ░░ ░░  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░
  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░
  
  I don't think i am smart enough to do this


   */

  cellSize = 0

  initDraw(): void {
    console.log('init draw called')
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.increment = 0
    this.board = []

    const { gutter, blocksWide } = this.vars
    const width = this.cw - gutter * 2
    const usableWidth = this.ch - gutter * 2
    const usableHeight = this.ch - gutter * 2
    this.cellSize = usableHeight / blocksWide
    const blocksTall = Math.floor(usableWidth / this.cellSize)

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

    for (let i = 0; i < 20; i++) {
      const x = randIntRange(blocksWide - 3)
      const y = randIntRange(blocksTall - 3)
      const type = tetrisPieces[randIntRange(tetrisPieces.length - 1)]
      const rotation = randIntRange(3)
      this.drawTetrisPiece(type, x, y, rotation)
    }
  }

  drawTetrisPiece(type: TetrisPiece, col: number, row: number, rotation = 0): void {
    if (type === 'O') rotation = 0
    else if (['I', 'S', 'Z'].includes(type)) rotation = rotation % 2
    else rotation = rotation % 4

    this.ctx.scale(this.cellSize)
    this.ctx.ctx.lineWidth /= this.cellSize
    this.ctx.translate(col, row)
    // this.ctx.scale(1 / 1.1)
    const rot = randFloat(0.1)
    this.ctx.rotate(rot)
    this.ctx.beginPath()
    switch (type) {
      case 'O': {
        this.ctx.moveTo(0, 0)
        this.ctx.lineTo(2, 0)
        this.ctx.lineTo(2, 2)
        this.ctx.lineTo(0, 2)
        break
      }
      case 'I': {
        if (rotation === 0) {
          this.ctx.moveTo(0, 0)
          this.ctx.lineTo(4, 0)
          this.ctx.lineTo(4, 1)
          this.ctx.lineTo(0, 1)
        } else {
          this.ctx.moveTo(0, 0)
          this.ctx.lineTo(1, 0)
          this.ctx.lineTo(1, 4)
          this.ctx.lineTo(0, 4)
        }
        break
      }
      case 'T': {
        switch (rotation) {
          case 0: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(3, 0)
            this.ctx.lineTo(3, 1)
            this.ctx.lineTo(2, 1)
            this.ctx.lineTo(2, 2)
            this.ctx.lineTo(1, 2)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(0, 1)
            break
          }
          case 1: {
            this.ctx.moveTo(1, 0)
            this.ctx.lineTo(2, 0)
            this.ctx.lineTo(2, 3)
            this.ctx.lineTo(1, 3)
            this.ctx.lineTo(1, 2)
            this.ctx.lineTo(0, 2)
            this.ctx.lineTo(0, 1)
            this.ctx.lineTo(1, 1)
            break
          }
          case 2: {
            this.ctx.moveTo(1, 0)
            this.ctx.lineTo(2, 0)
            this.ctx.lineTo(2, 1)
            this.ctx.lineTo(3, 1)
            this.ctx.lineTo(3, 2)
            this.ctx.lineTo(0, 2)
            this.ctx.lineTo(0, 1)
            this.ctx.lineTo(1, 1)
            break
          }
          case 3: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(0, 3)
            this.ctx.lineTo(1, 3)
            this.ctx.lineTo(1, 2)
            this.ctx.lineTo(2, 2)
            this.ctx.lineTo(2, 1)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(1, 0)
            break
          }
        }
        break
      }
      case 'J': {
        switch (rotation) {
          case 0: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(3, 0)
            this.ctx.lineTo(3, 2)
            this.ctx.lineTo(2, 2)
            this.ctx.lineTo(2, 1)
            this.ctx.lineTo(0, 1)
            break
          }
          case 1: {
            this.ctx.moveTo(1, 0)
            this.ctx.lineTo(2, 0)
            this.ctx.lineTo(2, 3)
            this.ctx.lineTo(0, 3)
            this.ctx.lineTo(0, 2)
            this.ctx.lineTo(1, 2)
            break
          }
          case 2: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(1, 0)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(3, 1)
            this.ctx.lineTo(3, 2)
            this.ctx.lineTo(0, 2)
            break
          }
          case 3: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(2, 0)
            this.ctx.lineTo(2, 1)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(1, 3)
            this.ctx.lineTo(0, 3)
            break
          }
        }
        break
      }
      case 'L': {
        switch (rotation) {
          case 0: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(3, 0)
            this.ctx.lineTo(3, 1)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(1, 2)
            this.ctx.lineTo(0, 2)
            break
          }
          case 1: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(2, 0)
            this.ctx.lineTo(2, 3)
            this.ctx.lineTo(1, 3)
            this.ctx.lineTo(1, 1)
            this.ctx.lineTo(0, 1)
            break
          }
          case 2: {
            this.ctx.moveTo(2, 0)
            this.ctx.lineTo(3, 0)
            this.ctx.lineTo(3, 2)
            this.ctx.lineTo(0, 2)
            this.ctx.lineTo(0, 1)
            this.ctx.lineTo(2, 1)
            break
          }
          case 3: {
            this.ctx.moveTo(0, 0)
            this.ctx.lineTo(1, 0)
            this.ctx.lineTo(1, 2)
            this.ctx.lineTo(2, 2)
            this.ctx.lineTo(2, 3)
            this.ctx.lineTo(0, 3)
            this.ctx.lineTo(0, 2)
            break
          }
        }
        break
      }
      case 'S': {
        if (rotation === 0) {
          this.ctx.moveTo(1, 0)
          this.ctx.lineTo(3, 0)
          this.ctx.lineTo(3, 1)
          this.ctx.lineTo(2, 1)
          this.ctx.lineTo(2, 2)
          this.ctx.lineTo(0, 2)
          this.ctx.lineTo(0, 1)
          this.ctx.lineTo(1, 1)
        } else {
          this.ctx.moveTo(0, 0)
          this.ctx.lineTo(1, 0)
          this.ctx.lineTo(1, 1)
          this.ctx.lineTo(2, 1)
          this.ctx.lineTo(2, 3)
          this.ctx.lineTo(1, 3)
          this.ctx.lineTo(1, 2)
          this.ctx.lineTo(0, 2)
        }
        break
      }
      case 'Z': {
        if (rotation === 0) {
          this.ctx.moveTo(0, 0)
          this.ctx.lineTo(2, 0)
          this.ctx.lineTo(2, 1)
          this.ctx.lineTo(3, 1)
          this.ctx.lineTo(3, 2)
          this.ctx.lineTo(1, 2)
          this.ctx.lineTo(1, 1)
          this.ctx.lineTo(0, 1)
        } else {
          this.ctx.moveTo(1, 0)
          this.ctx.lineTo(2, 0)
          this.ctx.lineTo(2, 2)
          this.ctx.lineTo(1, 2)
          this.ctx.lineTo(1, 3)
          this.ctx.lineTo(0, 3)
          this.ctx.lineTo(0, 1)
          this.ctx.lineTo(1, 1)
        }
        break
      }
    }
    this.ctx.closePath()
    this.ctx.stroke({ cutout: true })
    this.ctx.rotate(-rot)
    // this.ctx.scale(1.1)
    this.ctx.translate(-col, -row)
    this.ctx.ctx.lineWidth *= this.cellSize
    this.ctx.scale(1 / this.cellSize)
  }

  draw(increment: number): void {
    //
  }
}
