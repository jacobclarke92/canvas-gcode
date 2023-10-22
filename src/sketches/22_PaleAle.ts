import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { randIntRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pos = [number, number]

type TurnDir = -1 | 0 | 1

export default class PaleAle extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('slowDown', { initialValue: 1, min: 1, max: 1000, step: 1, disableRandomize: true })
    this.addVar('randSeed', { initialValue: 3190, min: 1000, max: 10000, step: 1, disableRandomize: true })
    this.addVar('stopAfter', { initialValue: 1000, min: 5, max: 2000, step: 1, disableRandomize: true })

    this.addVar('gridSize', { initialValue: 4, min: 1, max: 20, step: 1 })
    this.addVar('numStartPts', { initialValue: 1, min: 1, max: 20, step: 1 })
    this.addVar('newLineAttempts', { initialValue: 20, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.displayGrid = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.displayUsed = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.displayArrows = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.curvedPaths = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  stopDrawing = false
  increment = 0
  rows = 0
  cols = 0
  startingPoints: [prevPos: Pos, pos: Pos][] = []

  usedPositions: boolean[][] = []
  usedPivotPositions: boolean[][] = []

  initDraw(): void {
    seedRandom(this.vars.randSeed)

    this.stopDrawing = false
    this.increment = 0
    this.usedPositions = []
    this.usedPivotPositions = []
    this.startingPoints = []

    const { gridSize } = this.vars
    this.cols = Math.floor(this.cw / gridSize)
    this.rows = Math.floor(this.ch / gridSize)

    // Dark bg pls
    this.ctx._background = '#111111'
    this.ctx._fillStyle = '#111111'
    this.ctx._strokeStyle = '#ffffff'
    this.ctx.ctx.fillStyle = '#111111'
    this.ctx.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    if (this.vs.displayGrid.value) {
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

    for (let i = 0; i < this.vars.numStartPts; i++) {
      const newLinePts = this.spawnNewLine()
      if (newLinePts) this.startingPoints.push(...newLinePts)
    }
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

  isUsed(pos: Pos, includePivots = false): boolean {
    const usedAsPivot = includePivots ? this.isUsedAsPivot(pos) : false
    if (!this.usedPositions[pos[0]]) return false || usedAsPivot
    return !!this.usedPositions[pos[0]][pos[1]] || usedAsPivot
  }

  isUsedAsPivot(pos: Pos) {
    if (!this.usedPivotPositions[pos[0]]) return false
    return !!this.usedPivotPositions[pos[0]][pos[1]]
  }

  markUsed(pos: Pos, isPivot = false) {
    const usedArr = isPivot ? this.usedPivotPositions : this.usedPositions
    if (!usedArr[pos[0]]) usedArr[pos[0]] = []
    usedArr[pos[0]][pos[1]] = true

    const { gridSize } = this.vars

    if (this.vs.displayUsed.value) {
      this.ctx.beginPath()
      this.ctx.strokeStyle = '#ff0000'
      this.ctx.rect(pos[0] * gridSize - 0.25, pos[1] * gridSize - 0.25, 0.5, 0.5)
      this.ctx.stroke()
      this.ctx.closePath()
      this.ctx.strokeStyle = '#ffffff'
    }
  }

  getNextPos(
    prevPos: Pos,
    pos: Pos,
    options: null | TurnDir[] = null
  ): [intermediatePos: null | Pos, nextPos: Pos, remainingOptions: TurnDir[]] | false {
    if (options && !options.length) return false
    if (!options) {
      options = shuffle([-1, 0, 1] satisfies TurnDir[])
    }

    const turn = options.pop()
    const dir = Math.atan2(pos[1] - prevPos[1], pos[0] - prevPos[0])

    const nextIntermediatePos: Pos = [pos[0] + Math.round(Math.cos(dir)), pos[1] + Math.round(Math.sin(dir))]

    // go straight
    if (turn === 0) {
      const nextPos = nextIntermediatePos
      if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, options)
      return [null, nextPos, options]
    }

    // if turning left or right
    if (this.isUsed(nextIntermediatePos)) return this.getNextPos(prevPos, pos, options)
    const nextDir = dir + turn * (Math.PI / 2)
    const nextPos: Pos = [
      nextIntermediatePos[0] + Math.round(Math.cos(nextDir)),
      nextIntermediatePos[1] + Math.round(Math.sin(nextDir)),
    ]
    if (this.isOutOfBounds(nextPos) || this.isUsed(nextPos)) return this.getNextPos(prevPos, pos, options)
    return [nextIntermediatePos, nextPos, options]
  }

  capOffLine(prevPos: Pos, pos: Pos, isExiting = false, debugColor?: string) {
    // this.capOffLine(prevPos, pos)
    const { gridSize } = this.vars
    const dir = Math.atan2(pos[1] - prevPos[1], pos[0] - prevPos[0])

    this.ctx.beginPath()
    /*
    this.ctx.moveTo(
      pos[0] * gridSize +
        Math.cos(dir - Math.PI / 2) * (gridSize / 2) +
        Math.cos(dir + (isExiting ? 0 : Math.PI)) * (gridSize / 4),
      pos[1] * gridSize +
        Math.sin(dir - Math.PI / 2) * (gridSize / 2) +
        Math.sin(dir + (isExiting ? 0 : Math.PI)) * (gridSize / 4)
    )
    this.ctx.quadraticCurveTo(
      pos[0] * gridSize + Math.cos(dir + (isExiting ? Math.PI : 0)) * (gridSize / 2),
      pos[1] * gridSize + Math.sin(dir + (isExiting ? Math.PI : 0)) * (gridSize / 2),
      pos[0] * gridSize +
        Math.cos(dir + Math.PI / 2) * (gridSize / 2) +
        Math.cos(dir + (isExiting ? 0 : Math.PI)) * (gridSize / 4),
      pos[1] * gridSize +
        Math.sin(dir + Math.PI / 2) * (gridSize / 2) +
        Math.sin(dir + (isExiting ? 0 : Math.PI)) * (gridSize / 4)
    )
    */

    this.ctx.arc(
      pos[0] * gridSize, // + Math.cos(dir - Math.PI) * (gridSize / 2),
      pos[1] * gridSize, // + Math.sin(dir - Math.PI) * (gridSize / 2),
      gridSize / 5,
      dir + (isExiting ? 0 : Math.PI) + 0.4,
      dir + (isExiting ? 0 : Math.PI) - 0.4,
      false
    )

    if (debugColor) this.ctx.strokeStyle = debugColor
    this.ctx.stroke()
    this.ctx.closePath()
    if (debugColor) this.ctx.strokeStyle = '#ffffff'
  }

  drawSegment(from: Pos, corner: Pos | null, to: Pos, debugColor?: string) {
    const { gridSize } = this.vars

    this.ctx.beginPath()
    this.ctx.moveTo(from[0] * gridSize, from[1] * gridSize)
    if (corner) {
      if (this.vs.curvedPaths.value) {
        this.ctx.quadraticCurveTo(corner[0] * gridSize, corner[1] * gridSize, to[0] * gridSize, to[1] * gridSize)
      } else {
        this.ctx.lineTo(to[0] * gridSize, to[1] * gridSize)
      }
    } else {
      this.ctx.lineTo(to[0] * gridSize, to[1] * gridSize)
    }
    if (debugColor) this.ctx.strokeStyle = debugColor
    this.ctx.stroke()
    this.ctx.closePath()

    if (this.vs.displayArrows.value) {
      const dir = Math.atan2((corner || from)[1] - to[1], (corner || from)[0] - to[0])
      this.ctx.strokeTriangle(to[0] * gridSize, to[1] * gridSize, dir, 0.5 * gridSize)
    }

    if (corner) this.markUsed(corner)
    this.markUsed(to)

    if (debugColor) this.ctx.strokeStyle = '#ffffff'
  }

  makeTunnel(from: Pos, to: Pos): [prevPos: Pos, pos: Pos] | false {
    const dir = Math.atan2(to[1] - from[1], to[0] - from[0])
    const pos: Pos = [...to]
    let found = false
    while (!found) {
      pos[0] += Math.round(Math.cos(dir))
      pos[1] += Math.round(Math.sin(dir))
      if (this.isOutOfBounds(pos)) return false
      if (
        !this.isUsed(pos, true) &&
        !this.isUsed([pos[0] + Math.round(Math.cos(dir)), pos[1] + Math.round(Math.sin(dir))], true)
      )
        found = true
    }
    if (!found) return false
    this.markUsed(pos)
    return [[pos[0] - Math.round(Math.cos(dir)), pos[1] - Math.round(Math.sin(dir))], pos]
  }

  spawnNewLine(attempt = 0): typeof this.startingPoints | false {
    if (attempt > this.vars.newLineAttempts) return false

    const nextPrevPos: Pos = [randIntRange(this.cols), randIntRange(this.rows)]
    if (this.isUsed(nextPrevPos)) return this.spawnNewLine(attempt + 1)

    const nextPos = this.getNextCardinalPos(nextPrevPos)
    if (nextPos === false) return this.spawnNewLine(attempt + 1)

    const dir = Math.atan2(nextPos[1] - nextPrevPos[1], nextPos[0] - nextPrevPos[0])
    const nextNextPos: Pos = [nextPos[0] + Math.round(Math.cos(dir)), nextPos[1] + Math.round(Math.sin(dir))]
    if (this.isUsed(nextNextPos)) return this.spawnNewLine(attempt + 1)

    this.markUsed(nextPos)

    return [
      [nextPrevPos, nextPos],
      [nextNextPos, nextPos],
    ]
  }

  draw(increment: number): void {
    if (this.stopDrawing) return

    if (increment % this.vs.slowDown.value !== 0) return

    this.increment++
    if (this.increment > this.vars.stopAfter) return
    if (!this.startingPoints.length) {
      this.stopDrawing = true
      return
    }

    const newStartPts: typeof this.startingPoints = []
    for (let i = 0; i < this.startingPoints.length; i++) {
      const [prevPos, pos] = this.startingPoints[i]

      let nextPositions = this.getNextPos(prevPos, pos)

      if (nextPositions === false) {
        console.log('got nowhere to go, game over man')
        continue
      }

      let [intermediatePos, nextPos, remainingTurnOptions] = nextPositions

      let nextNextPositions = this.getNextPos(intermediatePos || pos, nextPos)
      if (nextNextPositions === false) {
        if (!remainingTurnOptions.length) {
          console.log('there are definitely no other options -- draw last segment')
          this.drawSegment(pos, intermediatePos, nextPos /*, '#ff0000'*/)
          this.capOffLine(!this.vs.curvedPaths.value ? pos : intermediatePos || pos, nextPos)
          const tunneledPos = this.makeTunnel(intermediatePos || pos, nextPos)
          if (tunneledPos) {
            newStartPts.push([...tunneledPos])
            this.capOffLine(tunneledPos[0], tunneledPos[1], true)
          } else {
            const newLinePts = this.spawnNewLine()
            if (newLinePts) newStartPts.push(...newLinePts)
          }
          continue
        }
        console.log('there miiight be other options')
        nextPositions = this.getNextPos(prevPos, pos, remainingTurnOptions)
        if (nextPositions === false) {
          console.log('nope, got nowhere to go. cap it.')
          this.capOffLine(prevPos, pos, false /*, '#ff0000'*/)
          const tunneledPos = this.makeTunnel(intermediatePos || pos, nextPos)
          if (tunneledPos) {
            newStartPts.push([...tunneledPos])
            this.capOffLine(tunneledPos[0], tunneledPos[1], true)
          } else {
            const newLinePts = this.spawnNewLine()
            if (newLinePts) newStartPts.push(...newLinePts)
          }
          continue
        }

        // take 2
        ;[intermediatePos, nextPos, remainingTurnOptions] = nextPositions
        nextNextPositions = this.getNextPos(intermediatePos || pos, nextPos)
        if (nextNextPositions === false) {
          console.log('gonna hit a dead end so forgettaboutit')
          this.drawSegment(pos, intermediatePos, nextPos /*, '#ff00ff'*/)
          this.capOffLine(!this.vs.curvedPaths.value ? pos : intermediatePos || pos, nextPos, false /*, '#ffff00'*/)
          const tunneledPos = this.makeTunnel(intermediatePos || pos, nextPos)
          if (tunneledPos) {
            newStartPts.push([...tunneledPos])
            this.capOffLine(tunneledPos[0], tunneledPos[1], true)
          } else {
            const newLinePts = this.spawnNewLine()
            if (newLinePts) newStartPts.push(...newLinePts)
          }
          continue
        }
      }

      this.drawSegment(pos, intermediatePos, nextPos)

      newStartPts.push([intermediatePos || pos, nextPos])
    }
    this.startingPoints = newStartPts
  }
}
