import { FluidRenderer } from '../FluidRenderer'
import { addCircularObstacle, FluidSimulator } from '../FluidSimulator'
import { Sketch } from '../Sketch'
import { hexToRgb } from '../utils/colorUtils'
import { BooleanRange } from './tools/Range'

export default class Genuary18_Wind extends Sketch {
  static disableOverclock = true

  init() {
    this.addVar('size', { initialValue: 128, min: 16, max: 512, step: 1 })
    this.addVar('timeStep', { initialValue: 0.0122, min: 0.001, max: 0.05, step: 0.001 })
    this.addVar('solverIterations', { initialValue: 40, min: 8, max: 120, step: 1 })
    this.addVar('pipeHeight', { initialValue: 0.1, min: 0.01, max: 1, step: 0.01 })
    this.addVar('windVelocity', { initialValue: 1.3, min: 0.1, max: 10, step: 0.1 })
    this.addVar('obstacleX', { initialValue: 0.15, min: 0.1, max: 0.9, step: 0.01 })
    this.addVar('obstacleY', { initialValue: 0.5, min: 0.1, max: 0.9, step: 0.01 })
    this.addVar('obstacleRadius', { initialValue: 0.1, min: 0.01, max: 0.5, step: 0.01 })
    this.vs.showDye = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.vs.showStreamlines = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  renderer: FluidRenderer
  simulator: FluidSimulator

  initDraw(): void {
    const {
      size,
      timeStep,
      solverIterations,
      pipeHeight,
      windVelocity,
      obstacleX,
      obstacleY,
      obstacleRadius,
    } = this.vars

    this.simulator = new FluidSimulator(size, size, timeStep, solverIterations)
    this.renderer = new FluidRenderer(
      this.simulator,
      this.ctx.canvasElement! /*, {
      width: size,
      height: size,
    }*/
    )

    const id = (i: number, j: number) => i + this.simulator.gridW * j

    // apply scene to simulator
    /*
    this.simulator.reset()
    const sourceVelocity = 10.0
    const pipeHeight = 0.05 * this.simulator.gridH
    const dyeHeight = 0.05 * this.simulator.gridH

    // set obstacles
    for (let i = 0; i < this.simulator.gridW; i++) {
      this.simulator.solidMaskField[id(i, 0)] = 0.0
      this.simulator.solidMaskField[id(i, this.simulator.gridH - 1)] = 0.0
    }
    for (let j = 0; j < this.simulator.gridH; j++) {
      this.simulator.solidMaskField[id(0, j)] = 0.0
      this.simulator.solidMaskField[id(this.simulator.gridW - 1, j)] = 0.0
    }

    let jMin = Math.floor(0.5 * this.simulator.gridH - 0.5 * pipeHeight)
    let jMax = Math.floor(0.5 * this.simulator.gridH + 0.5 * pipeHeight)

    for (let j = jMin; j < jMax; j++) {
      this.simulator.velocityFieldX[id(2, j)] = sourceVelocity
      this.simulator.velocityFieldX[id(this.simulator.gridW - 2, j)] = -sourceVelocity
    }

    jMin = Math.floor(0.5 * this.simulator.gridH - 0.5 * dyeHeight)
    jMax = Math.floor(0.5 * this.simulator.gridH + 0.5 * dyeHeight)

    const [r0, g0, b0] = hexToRgb(0x3477eb)
    const [r1, g1, b1] = hexToRgb(0xe81570)
    for (let j = jMin; j < jMax; j++) {
      this.simulator.rDyeField[id(0, j)] = r0 / 255
      this.simulator.gDyeField[id(0, j)] = g0 / 255
      this.simulator.bDyeField[id(0, j)] = b0 / 255
      this.simulator.rDyeField[id(2, j)] = r0 / 255
      this.simulator.gDyeField[id(2, j)] = g0 / 255
      this.simulator.bDyeField[id(2, j)] = b0 / 255
      this.simulator.rDyeField[id(this.simulator.gridW - 1, j)] = r1 / 255
      this.simulator.gDyeField[id(this.simulator.gridW - 1, j)] = g1 / 255
      this.simulator.bDyeField[id(this.simulator.gridW - 1, j)] = b1 / 255
      this.simulator.rDyeField[id(this.simulator.gridW - 3, j)] = r1 / 255
      this.simulator.gDyeField[id(this.simulator.gridW - 3, j)] = g1 / 255
      this.simulator.bDyeField[id(this.simulator.gridW - 3, j)] = b1 / 255
    }
      */

    this.simulator.reset()
    const realPipeHeight = pipeHeight * this.simulator.gridH

    // set obstacles
    this.simulator.solidMaskField.fill(1.0)
    for (let i = 0; i < this.simulator.gridW; i++) {
      this.simulator.solidMaskField[id(i, 0)] = 0.0
      this.simulator.solidMaskField[id(i, this.simulator.gridH - 1)] = 0.0
    }
    for (let j = 0; j < this.simulator.gridH; j++) {
      this.simulator.solidMaskField[id(0, j)] = 0.0
    }

    // set velocity
    for (let j = 0; j < this.simulator.gridH; j++)
      this.simulator.velocityFieldX[id(1, j)] = windVelocity

    // set dye
    const jMin = Math.floor(0.5 * this.simulator.gridH - 0.5 * realPipeHeight)
    const jMax = Math.floor(0.5 * this.simulator.gridH + 0.5 * realPipeHeight)
    for (let j = jMin; j < jMax; j++) {
      this.simulator.rDyeField[id(0, j)] = 0.0
      this.simulator.gDyeField[id(0, j)] = 0.0
      this.simulator.bDyeField[id(0, j)] = 0.0
      this.simulator.rDyeField[id(1, j)] = 0.0
      this.simulator.gDyeField[id(1, j)] = 0.0
      this.simulator.bDyeField[id(1, j)] = 0.0
    }

    addCircularObstacle(this.simulator, obstacleX, obstacleY, obstacleRadius)
  }

  draw(increment: number): void {
    //
    // debugger
    this.simulator.simulate()
    this.renderer.draw({
      showDye: !!this.vs.showDye.value,
      showObstacle: false,
      showStreamline: false,
    })

    if (!!this.vs.showStreamlines.value) {
      this.renderer.drawStreamline({
        nthPixel: 2,
      })
    }
  }
}
