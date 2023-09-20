import { Sketch } from '../Sketch'
import { randIntRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pos = [number, number]

export default class PaleAle extends Sketch {
  static generateGCode = false

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', { initialValue: 3190, min: 1000, max: 10000, step: 1, disableRandomize: true })
    this.addVar('stopAfter', { initialValue: 128, min: 5, max: 2000, step: 1, disableRandomize: true })
    this.vs.drawGrid = new BooleanRange({ disableRandomize: true, initialValue: true })

    this.addVar('gridSize', { initialValue: 4, min: 1, max: 20, step: 1 })
  }

  stopDrawing = false
  increment = 0
  rows = 0
  cols = 0
  prevPos: Pos = [0, 0]
  pos: Pos = [0, 0]

  usedPositions: boolean[][] = []

  initDraw(): void {
    seedRandom(this.vars.randSeed)

    this.stopDrawing = false
    this.increment = 0
    this.usedPositions = []

    const { gridSize } = this.vars
    this.cols = Math.floor(this.cw / gridSize)
    this.rows = Math.floor(this.ch / gridSize)

    // Dark bg pls
    this.ctx._background = '#111111'
    this.ctx._fillStyle = '#111111'
    this.ctx._strokeStyle = '#ffffff'
    this.ctx.ctx.fillStyle = '#111111'
    this.ctx.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    if (this.vs.drawGrid.value) {
      // Start drawing debug grid
      this.ctx.strokeStyle = '#222222'
      this.ctx.beginPath()
      for (let i = 0; i < this.cols; i++) {
        const x = i * gridSize
        this.ctx.moveTo(x, 0)
        this.ctx.lineTo(x, gridSize * this.rows)
        this.ctx.stroke()
      }
      for (let i = 0; i < this.rows; i++) {
        const y = i * gridSize
        this.ctx.moveTo(0, y)
        this.ctx.lineTo(gridSize * this.cols, y)
        this.ctx.stroke()
      }
      this.ctx.closePath()
      // Finish drawing debug grid
    }

    this.prevPos[0] = randIntRange(this.cols)
    this.prevPos[1] = randIntRange(this.rows)
    this.pos = this.getNextCardinalPos(this.prevPos) as Pos

    // this.ctx.path = new Path()

    this.ctx.beginPath()
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.moveTo(this.prevPos[0] * gridSize, this.prevPos[1] * gridSize)
    this.ctx.lineTo(this.pos[0] * gridSize, this.pos[1] * gridSize)
    this.ctx.stroke()
    this.ctx.closePath()
  }

  getNextCardinalPos(fromPos: Pos, counter = 0): Pos | false {
    if (counter > 16) {
      console.log('panic', counter)
      return false
    }
    const { gridSize } = this.vars
    const dir = randIntRange(3, 0) * (Math.PI * 2)
    const nextX = fromPos[0] + Math.round(Math.cos(dir))
    const nextY = fromPos[1] + Math.round(Math.sin(dir))
    if (nextX < 0 || nextY < 0 || nextX > this.cols * gridSize || nextY > this.rows * gridSize) {
      return this.getNextCardinalPos(fromPos, counter + 1)
    }
    return [nextX, nextY]
  }

  isOutOfBounds(pos: Pos): boolean {
    const { gridSize } = this.vars
    return pos[0] < 0 || pos[1] < 0 || pos[0] > this.cols * gridSize || pos[1] > this.rows * gridSize
  }

  isUsed(pos: Pos): boolean {
    if (!this.usedPositions[pos[0]]) return false
    return !!this.usedPositions[pos[0]][pos[1]]
  }

  getNextPos(prevPos: Pos, pos: Pos, counter = 0): [null | Pos, Pos] | false {
    if (counter > 12) {
      console.log('panic pls', counter)
      return false
    }
    const dir = Math.atan2(pos[1] - prevPos[1], pos[0] - prevPos[0])
    const turn = randIntRange(1, -1)

    // if turning left or right
    if (!!turn) {
      const nextIntermediatePos: Pos = [
        this.pos[0] + Math.round(Math.cos(dir)),
        this.pos[1] + Math.round(Math.sin(dir)),
      ]
      if (this.isUsed(nextIntermediatePos)) return this.getNextPos(prevPos, pos, counter + 1)
      const nextDir = dir + turn * (Math.PI / 2)

      const nextPos: Pos = [
        nextIntermediatePos[0] + Math.round(Math.cos(nextDir)),
        nextIntermediatePos[1] + Math.round(Math.sin(nextDir)),
      ]
      if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, counter + 1)
      return [nextIntermediatePos, nextPos]
    } else {
      // going straight ahead
      const nextPos: Pos = [pos[0] + Math.round(Math.cos(dir)), pos[1] + Math.round(Math.sin(dir))]
      if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, counter + 1)
      return [null, nextPos]
    }
  }

  draw(increment: number): void {
    if (this.stopDrawing) return
    this.increment++

    if (this.increment > this.vars.stopAfter) return

    const { gridSize } = this.vars

    const nextPositions = this.getNextPos(this.prevPos, this.pos)

    // got nowhere to go, pick a new random starting point that isn't used and go from there
    if (nextPositions === false) {
      const nextPrevPos: Pos = [randIntRange(this.cols), randIntRange(this.rows)]
      if (this.isUsed(nextPrevPos)) return

      const nextPos = this.getNextCardinalPos(nextPrevPos)
      if (nextPos === false) return

      this.usedPositions[nextPos[0]] = this.usedPositions[nextPos[0]] || []
      this.usedPositions[nextPos[0]][nextPos[1]] = true

      this.prevPos = nextPrevPos
      this.pos = nextPos

      return
    }

    const [intermediatePos, nextPos] = nextPositions

    const nextNextPositions = this.getNextPos(intermediatePos || this.pos, nextPos)
    if (nextNextPositions === false) {
      // gonna hit a dead end so forgettaboutit
      return
    }

    this.ctx.moveTo(this.pos[0] * gridSize, this.pos[1] * gridSize)
    if (intermediatePos) {
      this.ctx.quadraticCurveTo(
        intermediatePos[0] * gridSize,
        intermediatePos[1] * gridSize,
        nextPos[0] * gridSize,
        nextPos[1] * gridSize
      )
      this.usedPositions[intermediatePos[0]] = this.usedPositions[intermediatePos[0]] || []
      this.usedPositions[intermediatePos[0]][intermediatePos[1]] = true
      this.usedPositions[nextPos[0]] = this.usedPositions[nextPos[0]] || []
      this.usedPositions[nextPos[0]][nextPos[1]] = true
    } else {
      this.ctx.lineTo(nextPos[0] * gridSize, nextPos[1] * gridSize)
      this.usedPositions[nextPos[0]] = this.usedPositions[nextPos[0]] || []
      this.usedPositions[nextPos[0]][nextPos[1]] = true
    }
    this.ctx.stroke()

    debugger

    this.prevPos = intermediatePos || this.pos
    this.pos = nextPos
  }
}
