import { deg90 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

interface Cell {
  x: number
  y: number
  drawn: boolean
  connectTop: boolean
  connectRight: boolean
  connectBottom: boolean
  connectLeft: boolean
}

const createCell = (
  x: number,
  y: number,
  limits?: {
    connectTop?: boolean
    connectRight?: boolean
    connectBottom?: boolean
    connectLeft?: boolean
    preventOverflow?: { cols: number; rows: number }
  }
): Cell => {
  let { connectTop, connectRight, connectBottom, connectLeft } = limits ?? {}
  if (limits?.preventOverflow) {
    if (y === 0) connectTop = false
    if (x === 0) connectLeft = false
    if (y === limits.preventOverflow.rows) connectBottom = false
    if (x === limits.preventOverflow.cols) connectRight = false
  }
  const randomizeUnset = () => {
    if (connectTop === undefined) connectTop = !!randIntRange(1)
    if (connectRight === undefined) connectRight = !!randIntRange(1)
    if (connectBottom === undefined) connectBottom = !!randIntRange(1)
    if (connectLeft === undefined) connectLeft = !!randIntRange(1)
  }
  randomizeUnset()
  let panic = 0
  while (
    [connectTop, connectRight, connectBottom, connectLeft].filter(Boolean).length < 2 &&
    panic < 100
  ) {
    randomizeUnset()
    panic++
  }

  if (panic >= 100) console.log('PANIC', x, y, connectTop, connectRight, connectBottom, connectLeft)

  return { x, y, connectTop, connectRight, connectBottom, connectLeft, drawn: false }
}

const isDeadEnd = (cell: Cell): boolean =>
  [cell.connectTop, cell.connectRight, cell.connectBottom, cell.connectLeft].filter(Boolean)
    .length === 1

export default class WaveCollapseSimple extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 5, min: 0, max: 50, step: 0.2 })
    this.addVar('gridSize', { initialValue: 20, min: 2, max: 128, step: 1 })
    this.addVar('thickness', { initialValue: 0.5, min: 0.1, max: 1, step: 0.01 })

    this.vs.displayGrid = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  done = false
  mode: 'plan' | 'draw' = 'plan'

  cols = 0
  rows = 0
  offsetX = 0
  offsetY = 0

  placedCellCount = 0
  cells: Cell[][] = []
  lastPlacedCell: Cell | null = null
  drawingCell: Cell | null = null

  nextCellQueue: [number, number][] = []

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    const { points, gutter, gridSize } = this.vars
    this.cols = Math.floor((this.cw - gutter * 2) / gridSize)
    this.rows = Math.floor((this.ch - gutter * 2) / gridSize)

    this.done = false
    this.mode = 'plan'

    this.offsetX = (this.cw - (gutter * 2 + this.cols * gridSize)) / 2
    this.offsetY = (this.ch - (gutter * 2 + this.rows * gridSize)) / 2

    this.lastPlacedCell = null
    this.drawingCell = null
    this.placedCellCount = 0
    this.cells = []
    this.nextCellQueue = []

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
      this.ctx.endPath()
      // Finish drawing debug grid

      const x = Math.floor(this.cols / 2)
      const y = Math.floor(this.rows / 2)
      const startingCell = createCell(x, y)
      this.registerCell(startingCell)
      this.addSurroundingBlankSpacesToQueue(startingCell)
    }
  }

  registerCell = (cell: Cell) => {
    const { x, y } = cell
    if (!this.cells[y]) this.cells[y] = []
    this.cells[y][x] = cell
    this.placedCellCount++
    this.lastPlacedCell = cell
  }

  addSurroundingBlankSpacesToQueue = (cell: Cell) => {
    const { x, y } = cell
    if (cell.connectLeft && x > 0 && !this.cells[y]?.[x - 1]) this.nextCellQueue.push([x - 1, y])
    if (cell.connectRight && x < this.cols - 1 && !this.cells[y]?.[x + 1])
      this.nextCellQueue.push([x + 1, y])
    if (cell.connectTop && y > 0 && !this.cells[y - 1]?.[x]) this.nextCellQueue.push([x, y - 1])
    if (cell.connectBottom && y < this.rows - 1 && !this.cells[y + 1]?.[x])
      this.nextCellQueue.push([x, y + 1])
  }

  getNeighboringCells = ([x, y]: [number, number]) => {
    const neighbors: {
      top?: Cell
      right?: Cell
      bottom?: Cell
      left?: Cell
    } = {}
    if (x > 0) neighbors.left = this.cells[y]?.[x - 1]
    if (x < this.cols - 1) neighbors.right = this.cells[y]?.[x + 1]
    if (y > 0) neighbors.top = this.cells[y - 1]?.[x]
    if (y < this.rows - 1) neighbors.bottom = this.cells[y + 1]?.[x]
    return neighbors
  }

  findUndrawnCell = (): Cell | null => {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y]?.[x]
        if (!cell) continue
        if (!cell.drawn) return cell
      }
    }
    return null
  }

  addRandomBlankSpaceToQueue = () => {
    const blankSpaces: [number, number][] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.cells[y]?.[x]) blankSpaces.push([x, y])
      }
    }
    if (!blankSpaces.length) return
    this.nextCellQueue.push(blankSpaces[randIntRange(blankSpaces.length - 1)])
  }

  findEndpoint = (): Cell => {
    const endpoints: Cell[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y]?.[x]
        if (!cell) continue
        if (isDeadEnd(cell)) endpoints.push(cell)
      }
    }
    if (!endpoints.length) {
      console.log('no endpoints found')
      return this.cells[0][0]
    }
    return endpoints[randIntRange(endpoints.length - 1)]
  }

  getCellPoint = (cell: Cell): Point => {
    const { gutter, gridSize } = this.vars
    return new Point(
      this.offsetX + gutter + cell.x * gridSize,
      this.offsetY + gutter + cell.y * gridSize
    )
  }

  drawCell = (cell: Cell) => {
    const { gridSize, thickness } = this.vars
    const { connectTop: t, connectRight: r, connectBottom: b, connectLeft: l } = cell

    const pt = this.getCellPoint(cell)
    const centerPt = pt.clone().add(gridSize / 2, gridSize / 2)
    const gap = (gridSize * (1 - thickness)) / 2
    const gapAndThickness = gap + gridSize * thickness

    if (!t && !r && !b && !l) {
      this.ctx.beginPath()
      this.ctx.strokeCircle(pt.x + gridSize / 2, pt.y + gridSize / 2, (gridSize * thickness) / 2)
    }

    if ([t, r, b, l].filter(Boolean).length === 1) {
      let angle = 0
      if (t) angle = -deg90
      if (b) angle = deg90
      if (l) angle = Math.PI
      const gapAngle = Math.PI
      this.ctx.beginPath()
      this.ctx.arc(
        centerPt.x,
        centerPt.y,
        (gridSize * thickness) / 2,
        angle - gapAngle / 2,
        angle + gapAngle / 2,
        true
      )
      this.ctx.moveTo(
        centerPt.x + Math.cos(angle - deg90) * ((gridSize * thickness) / 2),
        centerPt.y + Math.sin(angle - deg90) * ((gridSize * thickness) / 2)
      )
      this.ctx.lineToRelativeAngle(angle, gridSize / 2)
      this.ctx.moveTo(
        centerPt.x + Math.cos(angle + deg90) * ((gridSize * thickness) / 2),
        centerPt.y + Math.sin(angle + deg90) * ((gridSize * thickness) / 2)
      )
      this.ctx.lineToRelativeAngle(angle, gridSize / 2)
      this.ctx.stroke()
    }

    if (t && l) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y + gap)
      this.ctx.quadraticCurveToRelative(gap, 0, gap, -gap)
      this.ctx.stroke()
      if (!b && !r) {
        this.ctx.beginPath()
        this.ctx.moveTo(pt.x, pt.y + gapAndThickness)
        this.ctx.quadraticCurveToRelative(gapAndThickness, 0, gapAndThickness, -gapAndThickness)
        this.ctx.stroke()
      }
    }

    if (t && r) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x + gapAndThickness, pt.y)
      this.ctx.quadraticCurveToRelative(0, gap, gap, gap)
      this.ctx.stroke()
      if (!b && !l) {
        this.ctx.beginPath()
        this.ctx.moveTo(pt.x + gap, pt.y)
        this.ctx.quadraticCurveToRelative(0, gapAndThickness, gapAndThickness, gapAndThickness)
        this.ctx.stroke()
      }
    }

    if (b && l) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x + gap, pt.y + gridSize)
      this.ctx.quadraticCurveToRelative(0, -gap, -gap, -gap)
      this.ctx.stroke()
      if (!t && !r) {
        this.ctx.beginPath()
        this.ctx.moveTo(pt.x, pt.y + gap)
        this.ctx.quadraticCurveToRelative(gapAndThickness, 0, gapAndThickness, gapAndThickness)
        this.ctx.stroke()
      }
    }

    if (b && r) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x + gridSize, pt.y + gapAndThickness)
      this.ctx.quadraticCurveToRelative(-gap, 0, -gap, gap)
      this.ctx.stroke()
      if (!t && !l) {
        this.ctx.beginPath()
        this.ctx.moveTo(pt.x + gap, pt.y + gridSize)
        this.ctx.quadraticCurveToRelative(0, -gapAndThickness, gapAndThickness, -gapAndThickness)
        this.ctx.stroke()
      }
    }

    if (l && r && !t) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y + gap)
      this.ctx.lineToRelative(gridSize, 0)
      this.ctx.stroke()
    }

    if (l && r && !b) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y + gapAndThickness)
      this.ctx.lineToRelative(gridSize, 0)
      this.ctx.stroke()
    }

    if (t && b && !r) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x + gapAndThickness, pt.y)
      this.ctx.lineToRelative(0, gridSize)
      this.ctx.stroke()
    }

    if (t && b && !l) {
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x + gap, pt.y)
      this.ctx.lineToRelative(0, gridSize)
      this.ctx.stroke()
    }

    cell.drawn = true
    this.drawingCell = this.findUndrawnCell()
    console.log('drawing cell', cell)
    console.log('next cell:', this.drawingCell)
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    // if (increment % 500 !== 0) return
    if (this.done) return

    for (let i = 0; i < this.vars.speedUp; i++) {
      if (this.done) return

      if (this.mode === 'plan') {
        if (!this.nextCellQueue.length) {
          this.addRandomBlankSpaceToQueue()
          if (!this.nextCellQueue.length) {
            console.log('no blank spaces left')
            this.mode = 'draw'
            this.lastPlacedCell = null
            this.drawingCell = this.cells[0][0]
            return
          }
          return
        }

        // console.log(JSON.stringify(this.nextCellQueue))
        const queuedCell = this.nextCellQueue.shift()
        if (!queuedCell) return

        const [x, y] = queuedCell

        if (this.cells[y]?.[x]) return console.log('cell already exists for some reason')

        const neighbors = this.getNeighboringCells(queuedCell)
        if (!Object.keys(neighbors).length) return console.log('no neighbors for some reason')

        const newCell = createCell(x, y, {
          connectTop: neighbors.top?.connectBottom,
          connectRight: neighbors.right?.connectLeft,
          connectBottom: neighbors.bottom?.connectTop,
          connectLeft: neighbors.left?.connectRight,
          preventOverflow: { cols: this.cols - 1, rows: this.rows - 1 },
        })

        this.registerCell(newCell)
        this.addSurroundingBlankSpacesToQueue(newCell)
      }

      if (this.mode === 'draw') {
        console.log('drawing')

        if (!this.drawingCell) {
          console.log('no drawing cell')
          this.done = true
          penUp(this)
          return
        }

        this.drawCell(this.drawingCell)
      }
    }
  }
}
