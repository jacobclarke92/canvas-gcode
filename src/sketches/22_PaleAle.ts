import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { randIntRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
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

  getNextCardinalPos(fromPos: Pos, options: null | Pos[] = null): Pos | false {
    if (options && !options.length) return false

    if (!options) {
      options = shuffle([
        [fromPos[0] + 1, fromPos[1]],
        [fromPos[0] - 1, fromPos[1]],
        [fromPos[0], fromPos[1] + 1],
        [fromPos[0], fromPos[1] - 1],
      ])
    }
    const [nextX, nextY] = options.pop()
    if (nextX < 0 || nextY < 0 || nextX > this.cols || nextY > this.rows) {
      return this.getNextCardinalPos(fromPos, options)
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

  getNextPos(prevPos: Pos, pos: Pos, options: null | (-1 | 0 | 1)[] = null): [null | Pos, Pos] | false {
    if (options && !options.length) return false
    if (!options) {
      options = shuffle([-1, 0, 1])
    }

    const turn = options.pop()
    const dir = Math.atan2(pos[1] - prevPos[1], pos[0] - prevPos[0])

    const nextIntermediatePos: Pos = [this.pos[0] + Math.round(Math.cos(dir)), this.pos[1] + Math.round(Math.sin(dir))]

    // go straight
    if (turn === 0) {
      const nextPos = nextIntermediatePos
      if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, options)
      return [null, nextPos]
    }

    // if turning left or right
    if (this.isUsed(nextIntermediatePos)) return this.getNextPos(prevPos, pos, options)
    const nextDir = dir + turn * (Math.PI / 2)
    const nextPos: Pos = [
      nextIntermediatePos[0] + Math.round(Math.cos(nextDir)),
      nextIntermediatePos[1] + Math.round(Math.sin(nextDir)),
    ]
    if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, options)
    return [nextIntermediatePos, nextPos]
  }

  draw(increment: number): void {
    if (this.stopDrawing) return

    // if (increment % 1000 !== 0) return

    this.increment++
    if (this.increment > this.vars.stopAfter) return

    const { gridSize } = this.vars

    const nextPositions = this.getNextPos(this.prevPos, this.pos)

    if (nextPositions === false) {
      console.log("got nowhere to go, picking a new random starting point that isn't used and going from there")

      const nextPrevPos: Pos = [randIntRange(this.cols), randIntRange(this.rows)]
      if (this.isUsed(nextPrevPos)) return

      const nextPos = this.getNextCardinalPos(nextPrevPos)
      if (nextPos === false) return

      if (!this.usedPositions[nextPos[0]]) this.usedPositions[nextPos[0]] = []
      this.usedPositions[nextPos[0]][nextPos[1]] = true

      this.prevPos = nextPrevPos
      this.pos = nextPos

      return
    }

    const [intermediatePos, nextPos] = nextPositions

    // console.log(nextPos)

    const nextNextPositions = this.getNextPos(intermediatePos || this.pos, nextPos)
    if (nextNextPositions === false) {
      console.log('gonna hit a dead end so forgettaboutit')
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
      // if (!this.usedPositions[intermediatePos[0]]) this.usedPositions[intermediatePos[0]] = []
      // this.usedPositions[intermediatePos[0]][intermediatePos[1]] = true
      if (!this.usedPositions[nextPos[0]]) this.usedPositions[nextPos[0]] = []
      this.usedPositions[nextPos[0]][nextPos[1]] = true
    } else {
      this.ctx.lineTo(nextPos[0] * gridSize, nextPos[1] * gridSize)
      if (!this.usedPositions[nextPos[0]]) this.usedPositions[nextPos[0]] = []
      this.usedPositions[nextPos[0]][nextPos[1]] = true
    }
    this.ctx.stroke()

    // debugger

    this.prevPos = intermediatePos || this.pos
    this.pos = nextPos
  }
}
