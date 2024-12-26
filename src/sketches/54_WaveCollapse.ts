import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugArrow, debugDot, debugText } from '../utils/debugUtils'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Side = 'top' | 'right' | 'bottom' | 'left'

interface Cell {
  x: number
  y: number
  drawn: boolean
  drawnTop: boolean
  drawnRight: boolean
  drawnBottom: boolean
  drawnLeft: boolean
  connectTop: CellIO | false
  connectRight: CellIO | false
  connectBottom: CellIO | false
  connectLeft: CellIO | false
}

interface CellIO {
  spread: number
  ports: number
}

const randCellIO = (): CellIO => ({
  spread: randFloatRange(0.8, 0.4),
  ports: randIntRange(1, 8),
})

const createCell = (
  x: number,
  y: number,
  limits?: {
    connectTop?: CellIO | false
    connectRight?: CellIO | false
    connectBottom?: CellIO | false
    connectLeft?: CellIO | false
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
    if (connectTop === undefined) connectTop = !!randIntRange(1) ? randCellIO() : false
    if (connectRight === undefined) connectRight = !!randIntRange(1) ? randCellIO() : false
    if (connectBottom === undefined) connectBottom = !!randIntRange(1) ? randCellIO() : false
    if (connectLeft === undefined) connectLeft = !!randIntRange(1) ? randCellIO() : false
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
  if (panic >= 100) {
    console.log('PANIC', x, y, connectTop, connectRight, connectBottom, connectLeft)
    // connectTop = false
    // connectRight = false
    // connectBottom = false
    // connectLeft = false
  }

  return {
    x,
    y,
    connectTop,
    connectRight,
    connectBottom,
    connectLeft,
    drawn: false,
    drawnTop: false,
    drawnRight: false,
    drawnBottom: false,
    drawnLeft: false,
  }
}

const isDeadEnd = (cell: Cell): boolean =>
  [cell.connectTop, cell.connectRight, cell.connectBottom, cell.connectLeft].filter(Boolean)
    .length === 1

const getCellAscii = (cell: Cell): string => {
  const { connectTop: t, connectRight: r, connectBottom: b, connectLeft: l } = cell

  if (t && r && b && l) return '╋' // All directions

  // Three connections
  if (t && r && b) return '┣' // Missing left
  if (t && r && l) return '┻' // Missing bottom
  if (t && b && l) return '┫' // Missing right
  if (r && b && l) return '┳' // Missing top

  // Two connections
  if (t && b) return '┃' // Vertical
  if (r && l) return '━' // Horizontal
  if (t && r) return '┗' // Up + right
  if (t && l) return '┛' // Up + left
  if (b && r) return '┏' // Down + right
  if (b && l) return '┓' // Down + left

  // One or no connections
  if (l) return '⇥' // Left
  if (r) return '⇤' // Right
  if (t) return '⇩' // Up
  if (b) return '⇧' // Down

  return ' ' // Invalid state
}

const isCellCompletelyDrawn = (cell: Cell): boolean =>
  (cell.connectTop ? cell.drawnTop : true) &&
  (cell.connectRight ? cell.drawnRight : true) &&
  (cell.connectBottom ? cell.drawnBottom : true) &&
  (cell.connectLeft ? cell.drawnLeft : true)

export default class WaveCollapse extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 5, min: 0, max: 50, step: 0.2 })
    this.addVar('gridSize', { initialValue: 20, min: 2, max: 128, step: 1 })

    this.vs.displayGrid = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.vs.showDebug = new BooleanRange({ disableRandomize: true, initialValue: true })
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
      this.ctx.closePath()
      // Finish drawing debug grid

      const x = Math.floor(this.cols / 2)
      const y = Math.floor(this.rows / 2)
      const startingCell = createCell(x, y)
      console.log(x, y, 'starting cell', getCellAscii(startingCell))
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

  getOrphanedCells = ({ excludeDrawn }: { excludeDrawn: boolean } = { excludeDrawn: false }) => {
    const orphans: Cell[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y]?.[x]
        if (!cell) continue
        if (excludeDrawn && cell.drawn) continue
        if (!cell.connectTop && !cell.connectRight && !cell.connectBottom && !cell.connectLeft)
          orphans.push(cell)
      }
    }
    return orphans
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

  findEndpoint = (
    { excludeDrawn }: { excludeDrawn: boolean } = { excludeDrawn: false }
  ): Cell | null => {
    const endpoints: Cell[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y]?.[x]
        if (!cell) continue
        if (excludeDrawn && cell.drawn) continue
        if (isDeadEnd(cell)) endpoints.push(cell)
      }
    }
    if (!endpoints.length) {
      console.log('no endpoints found')
      return null // this.cells[0][0]
    }
    return endpoints[randIntRange(endpoints.length - 1)]
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

  logState = () => {
    for (let y = 0; y < this.rows; y++) {
      let rowStr = ''

      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y]?.[x]
        const pad = this.lastPlacedCell && cell === this.lastPlacedCell ? '*' : ' '
        rowStr += cell ? pad + getCellAscii(cell) + pad : '   '
      }
      console.log(rowStr)
    }
  }

  getCellPoint = (cell: Cell): Point => {
    const { gutter, gridSize } = this.vars
    return new Point(
      this.offsetX + gutter + cell.x * gridSize,
      this.offsetY + gutter + cell.y * gridSize
    )
  }

  getCellCenter = (cell: Cell, topLeftPt: Point = this.getCellPoint(cell)): Point =>
    topLeftPt.clone().add(this.vars.gridSize / 2, this.vars.gridSize / 2)

  getCellIO = (cell: Cell, side: Side): Point[] => {
    const { x, y } = cell
    const { gridSize } = this.vars
    const pt = this.getCellPoint(cell)
    const centerPt = this.getCellCenter(cell, pt)

    const { ports, spread } = cell[
      side === 'top'
        ? 'connectTop'
        : side === 'right'
        ? 'connectRight'
        : side === 'bottom'
        ? 'connectBottom'
        : 'connectLeft'
    ] as CellIO

    const edgeGutter = ((1 - spread) / 2) * gridSize
    const increment = (gridSize * spread) / (ports - 1)
    const points: Point[] = []
    let connectPt: Point
    switch (side) {
      case 'top':
        connectPt = pt.clone().add(edgeGutter, 1)
        for (let n = 0; n < ports; n++) {
          points.push(connectPt)
          connectPt = connectPt.add(increment)
        }
        break
      case 'right':
        connectPt = pt.clone().add(gridSize - 1, edgeGutter)
        for (let n = 0; n < ports; n++) {
          points.push(connectPt)
          connectPt = connectPt.add(0, increment)
        }
        break
      case 'bottom':
        connectPt = pt.clone().add(edgeGutter, gridSize - 1)
        for (let n = 0; n < ports; n++) {
          points.push(connectPt)
          connectPt = connectPt.add(increment, 0)
        }
        break
      case 'left':
        connectPt = pt.clone().add(1, edgeGutter)
        for (let n = 0; n < ports; n++) {
          points.push(connectPt)
          connectPt = connectPt.add(0, increment)
        }
        break
    }

    return points
  }

  isCellPartOfPair = (cell: Cell) => {
    const { x, y } = cell
    if (!isDeadEnd(cell)) return false
    const neighbors = this.getNeighboringCells([x, y])
    return (
      (cell.connectTop && isDeadEnd(neighbors.top)) ||
      (cell.connectRight && isDeadEnd(neighbors.right)) ||
      (cell.connectBottom && isDeadEnd(neighbors.bottom)) ||
      (cell.connectLeft && isDeadEnd(neighbors.left))
    )
  }

  drawCell = (cell: Cell) => {
    const { x, y } = cell
    const { gridSize } = this.vars

    const pt = this.getCellPoint(cell)
    const centerPt = this.getCellCenter(cell, pt)

    if (this.vs.showDebug.value) {
      if (!cell.drawnTop && !cell.drawnRight && !cell.drawnBottom && !cell.drawnLeft) {
        console.log('drawing symbol', x, y, centerPt.x, centerPt.y, getCellAscii(cell))
        debugText(this.ctx, getCellAscii(cell), centerPt, {
          fill: 'black',
          stroke: 'black',
          size: 2,
        })
      }
    }

    if (!cell.connectTop && !cell.connectRight && !cell.connectBottom && !cell.connectLeft) {
      console.log('drawing orphan cell', x, y)
      const circles = 4
      for (let i = 0; i < circles; i++) {
        this.ctx.beginPath()
        this.ctx.strokeCircle(centerPt, (gridSize / 2 / circles) * i)
        this.ctx.stroke()
        this.ctx.closePath()
      }

      cell.drawn = true

      this.drawingCell = this.findEndpoint({ excludeDrawn: true })

      return
    }

    if (this.isCellPartOfPair(cell)) {
      console.log('drawing pair', x, y)
      const neighbors = this.getNeighboringCells([x, y])
      const neighbor = Object.values(neighbors).find(isDeadEnd)
      if (!neighbor) return console.log('no neighbor found for pair')
      const neighborCenter = this.getCellCenter(neighbor)

      // make an infinity orbit shape around the center of the pair
      const orbitRadius = gridSize / 3
      const angle = centerPt.angleTo(neighborCenter)
      this.ctx.strokeCircle(centerPt, orbitRadius)
      this.ctx.strokeCircle(neighborCenter, orbitRadius)
      const offsetL = new Point(
        Math.cos(angle - Math.PI / 2) * orbitRadius,
        Math.sin(angle - Math.PI / 2) * orbitRadius
      )
      const offsetR = new Point(
        Math.cos(angle + Math.PI / 2) * orbitRadius,
        Math.sin(angle + Math.PI / 2) * orbitRadius
      )
      this.ctx.moveTo(centerPt.x + offsetL.x, centerPt.y + offsetL.y)
      this.ctx.lineTo(neighborCenter.x + offsetL.x, neighborCenter.y + offsetL.y)
      this.ctx.moveTo(centerPt.x + offsetR.x, centerPt.y + offsetR.y)
      this.ctx.lineTo(neighborCenter.x + offsetR.x, neighborCenter.y + offsetR.y)
      this.ctx.stroke()
      this.ctx.closePath()

      neighbor.drawn = true
      cell.drawn = true
      this.drawingCell = this.findEndpoint({ excludeDrawn: true })
      return
    }

    console.log('drawing cell', x, y)

    const neighbors = this.getNeighboringCells([x, y])
    const possibleNextCells: Cell[] = []

    if (cell.connectTop && !cell.drawnTop) {
      if (neighbors.top) {
        possibleNextCells.push(neighbors.top)
        if (!neighbors.top.drawnBottom)
          if (this.vs.showDebug.value)
            debugArrow(
              this.ctx,
              centerPt.clone().subtract(0, gridSize / 4),
              this.getCellCenter(neighbors.top).add(0, gridSize / 4)
            )
      }
      const { ports, spread } = cell.connectTop
      const edgeGutter = ((1 - spread) / 2) * gridSize
      const increment = (gridSize * spread) / (ports - 1)
      let connectPt = pt.clone().add(edgeGutter, 1)
      for (let n = 0; n < ports; n++) {
        debugDot(this.ctx, connectPt, 'red')
        connectPt = connectPt.add(increment)
      }
      cell.drawnTop = true
      cell.drawn = isCellCompletelyDrawn(cell)
      this.drawingCell = neighbors.top
      return
    }

    if (cell.connectRight && !cell.drawnRight) {
      if (neighbors.right) {
        possibleNextCells.push(neighbors.right)
        if (!neighbors.right.drawnLeft)
          if (this.vs.showDebug.value)
            debugArrow(
              this.ctx,
              centerPt.clone().add(gridSize / 4, 0),
              this.getCellCenter(neighbors.right).subtract(gridSize / 4, 0)
            )
      }
      const { ports, spread } = cell.connectRight
      const edgeGutter = ((1 - spread) / 2) * gridSize
      const increment = (gridSize * spread) / (ports - 1)
      let connectPt = pt.clone().add(gridSize - 1, edgeGutter)
      for (let n = 0; n < ports; n++) {
        debugDot(this.ctx, connectPt, 'magenta')
        connectPt = connectPt.add(0, increment)
      }
      cell.drawnRight = true
      cell.drawn = isCellCompletelyDrawn(cell)
      this.drawingCell = neighbors.right
      return
    }

    if (cell.connectBottom && !cell.drawnBottom) {
      if (neighbors.bottom) {
        possibleNextCells.push(neighbors.bottom)
        if (!neighbors.bottom.drawnTop)
          if (this.vs.showDebug.value)
            debugArrow(
              this.ctx,
              centerPt.clone().add(0, gridSize / 4),
              this.getCellCenter(neighbors.bottom).subtract(0, gridSize / 4)
            )
      }
      const { ports, spread } = cell.connectBottom
      const edgeGutter = ((1 - spread) / 2) * gridSize
      const increment = (gridSize * spread) / (ports - 1)
      let connectPt = pt.clone().add(edgeGutter, gridSize - 1)
      for (let n = 0; n < ports; n++) {
        debugDot(this.ctx, connectPt, 'blue')
        connectPt = connectPt.add(increment, 0)
      }
      cell.drawnBottom = true
      cell.drawn = isCellCompletelyDrawn(cell)
      this.drawingCell = neighbors.bottom
      return
    }

    if (cell.connectLeft && !cell.drawnLeft) {
      if (neighbors.left) {
        possibleNextCells.push(neighbors.left)
        if (!neighbors.left.drawnRight)
          if (this.vs.showDebug.value)
            debugArrow(
              this.ctx,
              centerPt.clone().subtract(gridSize / 4, 0),
              this.getCellCenter(neighbors.left).add(gridSize / 4, 0)
            )
      }
      const { ports, spread } = cell.connectLeft
      const edgeGutter = ((1 - spread) / 2) * gridSize
      const increment = (gridSize * spread) / (ports - 1)
      let connectPt = pt.clone().add(1, edgeGutter)
      for (let n = 0; n < ports; n++) {
        debugDot(this.ctx, connectPt, 'aqua')
        connectPt = connectPt.add(0, increment)
      }
      cell.drawnLeft = true
      cell.drawn = isCellCompletelyDrawn(cell)
      this.drawingCell = neighbors.left
      return
    }

    cell.drawn = true

    // if (!possibleNextCells.length) {
    this.drawingCell = this.findEndpoint({ excludeDrawn: true })
    if (!this.drawingCell) this.drawingCell = this.findUndrawnCell()

    // } else {
    //   this.drawingCell = possibleNextCells[0]
    // }
    // this.drawingCell = this.findEndpoint
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    if (this.mode === 'draw' && increment % 100 !== 0) return
    if (this.done) return

    if (this.mode === 'plan') {
      if (!this.nextCellQueue.length) {
        this.addRandomBlankSpaceToQueue()
        if (!this.nextCellQueue.length) {
          console.log('no blank spaces left')
          this.mode = 'draw'
          this.lastPlacedCell = null
          return
        }
        return
      }

      console.log(JSON.stringify(this.nextCellQueue))
      const queuedCell = this.nextCellQueue.shift()
      if (!queuedCell) return

      const [x, y] = queuedCell

      if (this.cells[y]?.[x]) return console.log('cell already exists for some reason')

      const neighbors = this.getNeighboringCells(queuedCell)
      if (!Object.keys(neighbors).length) return console.log('no neighbors for some reason')

      console.log(x, y, neighbors)
      const newCell = createCell(x, y, {
        connectTop: neighbors.top?.connectBottom,
        connectRight: neighbors.right?.connectLeft,
        connectBottom: neighbors.bottom?.connectTop,
        connectLeft: neighbors.left?.connectRight,
        preventOverflow: { cols: this.cols - 1, rows: this.rows - 1 },
      })
      console.log('new cell', getCellAscii(newCell), newCell)

      this.registerCell(newCell)

      this.logState()

      this.addSurroundingBlankSpacesToQueue(newCell)
    }

    if (this.mode === 'draw') {
      if (!this.drawingCell) {
        console.log('drawing')
        this.logState()
        let orphans = this.getOrphanedCells({ excludeDrawn: true })
        while (orphans.length > 0) {
          this.drawingCell = orphans[randIntRange(orphans.length - 1)]
          this.drawCell(this.drawingCell)
          orphans = this.getOrphanedCells({ excludeDrawn: true })
        }

        this.drawingCell = this.findEndpoint({ excludeDrawn: true })
        if (!this.drawingCell) this.drawingCell = this.cells[0][0]
      }

      if (!this.drawingCell) {
        console.log('no drawing cell')
        this.done = true
        return
      }

      this.drawCell(this.drawingCell)

      if (!this.drawingCell) {
        this.done = true
      }
    }
  }
}
