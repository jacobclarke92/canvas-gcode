import { clamp } from './utils/numberUtils'

export class FluidSimulator {
  density: number
  gridW: number
  gridH: number
  totalGridCells: number
  cellSize: number
  pressureSolverIterations: number
  timeStep: number

  velocityFieldX: Float32Array
  velocityFieldY: Float32Array
  pressureField: Float32Array
  solidMaskField: Float32Array

  divergenceField: Float32Array
  surroundingSolidCellsField: Float32Array
  prevVelocityFieldX: Float32Array
  prevVelocityFieldY: Float32Array
  prevDyeField: Float32Array

  rDyeField: Float32Array
  gDyeField: Float32Array
  bDyeField: Float32Array
  rDyeFieldPrev: Float32Array
  gDyeFieldPrev: Float32Array
  bDyeFieldPrev: Float32Array
  overRelaxation: number

  constVelocityFieldX: Float32Array
  constVelocityFieldY: Float32Array
  rDyeFieldConst: Float32Array
  gDyeFieldConst: Float32Array
  bDyeFieldConst: Float32Array

  constructor(gridW: number, gridH: number, timeStep: number, pressureSolverIterations: number) {
    this.density = 1000
    this.gridW = gridW
    this.gridH = gridH
    this.cellSize = 1.0 / gridW
    this.pressureSolverIterations = pressureSolverIterations
    this.timeStep = timeStep
    this.totalGridCells = this.gridW * this.gridH

    this.velocityFieldX = new Float32Array(this.totalGridCells)
    this.velocityFieldY = new Float32Array(this.totalGridCells)

    this.pressureField = new Float32Array(this.totalGridCells)
    this.solidMaskField = new Float32Array(this.totalGridCells) // 0 : solid obstacle, 1 : none
    this.solidMaskField.fill(1.0)

    // helper fields
    this.divergenceField = new Float32Array(this.totalGridCells)
    this.surroundingSolidCellsField = new Float32Array(this.totalGridCells)
    this.prevVelocityFieldX = new Float32Array(this.totalGridCells)
    this.prevVelocityFieldY = new Float32Array(this.totalGridCells)
    this.prevDyeField = new Float32Array(this.totalGridCells)

    this.rDyeField = new Float32Array(this.totalGridCells)
    this.gDyeField = new Float32Array(this.totalGridCells)
    this.bDyeField = new Float32Array(this.totalGridCells)
    this.rDyeFieldPrev = new Float32Array(this.totalGridCells)
    this.gDyeFieldPrev = new Float32Array(this.totalGridCells)
    this.bDyeFieldPrev = new Float32Array(this.totalGridCells)
    this.rDyeField.fill(1.0)
    this.gDyeField.fill(1.0)
    this.bDyeField.fill(1.0)

    this.constVelocityFieldX = new Float32Array(this.totalGridCells)
    this.constVelocityFieldY = new Float32Array(this.totalGridCells)
    this.rDyeFieldConst = new Float32Array(this.totalGridCells)
    this.gDyeFieldConst = new Float32Array(this.totalGridCells)
    this.bDyeFieldConst = new Float32Array(this.totalGridCells)
    this.constVelocityFieldX.fill(NaN)
    this.constVelocityFieldY.fill(NaN)
    this.rDyeFieldConst.fill(NaN)
    this.gDyeFieldConst.fill(NaN)
    this.bDyeFieldConst.fill(NaN)

    // parameter for SOR solver
    this.overRelaxation = 1.9
  }

  solveDivergence() {
    const cp = (this.density * this.cellSize) / this.timeStep
    this.pressureField.fill(0.0)

    for (let k = 0; k < this.pressureSolverIterations; k++) {
      for (let i = 1; i < this.gridW - 1; i++) {
        for (let j = 1; j < this.gridH - 1; j++) {
          if (this.solidMaskField[i + this.gridW * j] == 0.0) continue

          const sx0 = this.solidMaskField[i - 1 + this.gridW * j]
          const sx1 = this.solidMaskField[i + 1 + this.gridW * j]
          const sy0 = this.solidMaskField[i + this.gridW * (j - 1)]
          const sy1 = this.solidMaskField[i + this.gridW * (j + 1)]
          const s = sx0 + sx1 + sy0 + sy1
          if (s == 0.0) continue

          const div =
            this.velocityFieldX[i + 1 + this.gridW * j] -
            this.velocityFieldX[i + this.gridW * j] +
            this.velocityFieldY[i + this.gridW * (j + 1)] -
            this.velocityFieldY[i + this.gridW * j]

          this.divergenceField[i + this.gridW * j] = div
          this.surroundingSolidCellsField[i + this.gridW * j] = s

          let p = -div / s
          p *= this.overRelaxation
          this.pressureField[i + this.gridW * j] += cp * p

          this.velocityFieldX[i + this.gridW * j] -= sx0 * p
          this.velocityFieldX[i + 1 + this.gridW * j] += sx1 * p
          this.velocityFieldY[i + this.gridW * j] -= sy0 * p
          this.velocityFieldY[i + this.gridW * (j + 1)] += sy1 * p
        }
      }
    }
  }

  applyConstantFields() {
    for (let i = 0; i < this.totalGridCells; i++) {
      if (!isNaN(this.constVelocityFieldX[i])) this.velocityFieldX[i] = this.constVelocityFieldX[i]
      if (!isNaN(this.constVelocityFieldY[i])) this.velocityFieldY[i] = this.constVelocityFieldY[i]
      if (!isNaN(this.rDyeFieldConst[i])) this.rDyeField[i] = this.rDyeFieldConst[i]
      if (!isNaN(this.gDyeFieldConst[i])) this.gDyeField[i] = this.gDyeFieldConst[i]
      if (!isNaN(this.bDyeFieldConst[i])) this.bDyeField[i] = this.bDyeFieldConst[i]
    }
  }

  extrapolateBoundary() {
    for (let i = 0; i < this.gridW; i++) {
      this.velocityFieldX[i + this.gridW * 0] = this.velocityFieldX[i + this.gridW * 1]
      this.velocityFieldX[i + this.gridW * (this.gridH - 1)] =
        this.velocityFieldX[i + this.gridW * (this.gridH - 2)]
    }
    for (let j = 0; j < this.gridH; j++) {
      this.velocityFieldY[0 + this.gridW * j] = this.velocityFieldY[1 + this.gridW * j]
      this.velocityFieldY[this.gridW - 1 + this.gridW * j] =
        this.velocityFieldY[this.gridW - 2 + this.gridW * j]
    }
  }

  interpolateFromField(x: number, y: number, field: Float32Array) {
    const i = clamp(x / this.cellSize, 1, this.gridW - 1)
    const j = clamp(y / this.cellSize, 1, this.gridH - 1)

    const i0 = Math.floor(i - 0.5)
    const i1 = i0 + 1
    const j0 = Math.floor(j - 0.5)
    const j1 = j0 + 1

    const tx = i - 0.5 - i0
    const ty = j - 0.5 - j0

    const sx = 1.0 - tx
    const sy = 1.0 - ty

    const val =
      sx * sy * field[i0 + this.gridW * j0] +
      tx * sy * field[i1 + this.gridW * j0] +
      tx * ty * field[i1 + this.gridW * j1] +
      sx * ty * field[i0 + this.gridW * j1]
    return val
  }

  averageVelocityX(i: number, j: number, velocityFieldX: Float32Array) {
    return (
      (velocityFieldX[i + this.gridW * (j - 1)] +
        velocityFieldX[i + this.gridW * j] +
        velocityFieldX[i + 1 + this.gridW * (j - 1)] +
        velocityFieldX[i + 1 + this.gridW * j]) *
      0.25
    )
  }

  averageVelocityY(i: number, j: number, velocityFieldY: Float32Array) {
    return (
      (velocityFieldY[i - 1 + this.gridW * j] +
        velocityFieldY[i + this.gridW * j] +
        velocityFieldY[i - 1 + this.gridW * (j + 1)] +
        velocityFieldY[i + this.gridW * (j + 1)]) *
      0.25
    )
  }

  advectVelocity() {
    this.prevVelocityFieldX.set(this.velocityFieldX)
    this.prevVelocityFieldY.set(this.velocityFieldY)

    for (let i = 1; i < this.gridW - 1; i++) {
      for (let j = 1; j < this.gridH - 1; j++) {
        if (this.solidMaskField[i + this.gridW * j] == 0.0) continue

        // consider point in the center of the grid
        const cellX = i * this.cellSize + 0.5 * this.cellSize
        const cellY = j * this.cellSize + 0.5 * this.cellSize

        // x component
        if (this.solidMaskField[i - 1 + this.gridW * j] != 0.0) {
          const velocityX = this.velocityFieldX[i + this.gridW * j]
          // const vy = this.velocityFieldY[i + this.gridW*j];
          // const vx = this.averageVelocityX(i, j);
          const velocityY = this.averageVelocityY(i, j, this.prevVelocityFieldY)
          const x = cellX - velocityX * this.timeStep
          const y = cellY - velocityY * this.timeStep
          this.velocityFieldX[i + this.gridW * j] = this.interpolateFromField(
            x,
            y,
            this.prevVelocityFieldX
          )
        }
        // y component
        if (this.solidMaskField[i + this.gridW * (j - 1)] != 0.0) {
          const vx = this.averageVelocityX(i, j, this.prevVelocityFieldX)
          // const vy = this.averageVelocityY(i, j);
          // const vx = this.velocityFieldX[i + this.gridW*j];
          const vy = this.velocityFieldY[i + this.gridW * j]
          const x = cellX - vx * this.timeStep
          const y = cellY - vy * this.timeStep
          this.velocityFieldY[i + this.gridW * j] = this.interpolateFromField(
            x,
            y,
            this.prevVelocityFieldY
          )
        }
      }
    }
  }

  advectDye(dye: Float32Array, dyePrev: Float32Array) {
    dyePrev.set(dye)
    for (let i = 1; i < this.gridW - 1; i++) {
      for (let j = 1; j < this.gridH - 1; j++) {
        if (this.solidMaskField[i + this.gridW * j] == 0.0) continue
        // const velocityX = (this.velocityFieldX[i + this.gridW*j] + this.velocityFieldX[(i+1) + this.gridW*j]) * 0.5;
        // const velocityY = (this.velocityFieldY[i + this.gridW*j] + this.velocityFieldY[i + this.gridW*(j+1)]) * 0.5;
        const velocityX = this.velocityFieldX[i + this.gridW * j]
        const velocityY = this.velocityFieldY[i + this.gridW * j]
        const x = i * this.cellSize + 0.5 * this.cellSize - velocityX * this.timeStep
        const y = j * this.cellSize + 0.5 * this.cellSize - velocityY * this.timeStep
        dye[i + this.gridW * j] = this.interpolateFromField(x, y, dyePrev)
      }
    }
  }

  simulate() {
    this.solveDivergence()
    this.extrapolateBoundary()
    this.advectVelocity()

    this.advectDye(this.rDyeField, this.rDyeFieldPrev)
    this.advectDye(this.gDyeField, this.gDyeFieldPrev)
    this.advectDye(this.bDyeField, this.bDyeFieldPrev)
    this.applyConstantFields()
  }

  reset() {
    this.velocityFieldX.fill(0.0)
    this.velocityFieldY.fill(0.0)

    this.pressureField.fill(0.0)
    this.solidMaskField.fill(1.0)
    this.rDyeField.fill(1.0)
    this.gDyeField.fill(1.0)
    this.bDyeField.fill(1.0)

    this.prevVelocityFieldX.fill(0.0)
    this.prevVelocityFieldY.fill(0.0)

    this.rDyeFieldPrev.fill(0.0)
    this.gDyeFieldPrev.fill(0.0)
    this.bDyeFieldPrev.fill(0.0)

    this.constVelocityFieldX.fill(NaN)
    this.constVelocityFieldY.fill(NaN)
    this.rDyeFieldConst.fill(NaN)
    this.gDyeFieldConst.fill(NaN)
    this.bDyeFieldConst.fill(NaN)
  }
}

export function addCircularObstacle(sim: FluidSimulator, x: number, y: number, radius: number) {
  const iFrom = clamp(Math.floor((x - radius - 1) / sim.cellSize), 0, sim.gridW - 1)
  const ito = clamp(Math.ceil((x + radius + 2) / sim.cellSize), 0, sim.gridW - 1)
  const jFrom = clamp(Math.floor((y - radius - 1) / sim.cellSize), 0, sim.gridH - 1)
  const jto = clamp(Math.ceil((y + radius + 2) / sim.cellSize), 0, sim.gridH - 1)
  for (let i = iFrom; i < ito; i++) {
    for (let j = jFrom; j < jto; j++) {
      const dx = (i + 0.5) * sim.cellSize - x
      const dy = (j + 0.5) * sim.cellSize - y
      if (dx * dx + dy * dy < radius * radius) {
        sim.solidMaskField[i + sim.gridW * j] = 0.0
        sim.rDyeField[i + sim.gridW * j] = 1.0
        sim.velocityFieldX[i + sim.gridW * j] = 0.0
        sim.velocityFieldY[i + sim.gridW * j] = 0.0
      }
    }
  }
}
