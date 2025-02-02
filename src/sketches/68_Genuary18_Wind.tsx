import { FluidRenderer } from '../FluidRenderer'
import { addCircularObstacle, FluidSimulator } from '../FluidSimulator'
import { Sketch } from '../Sketch'
import { hexToRgb } from '../utils/colorUtils'

export default class Genuary18_Wind extends Sketch {
  static disableOverclock = true

  init() {
    this.addVar('size', { initialValue: 100, min: 16, max: 1024, step: 1 })
    this.addVar('timeStep', { initialValue: 0.016, min: 0.001, max: 1, step: 0.001 })
    this.addVar('solverIterations', { initialValue: 40, min: 1, max: 120, step: 1 })
  }

  renderer: FluidRenderer
  simulator: FluidSimulator

  initDraw(): void {
    const { size, timeStep, solverIterations } = this.vars

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
    const windVelocity = 2.0
    const pipeHeight = 0.1 * this.simulator.gridH

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
    const jMin = Math.floor(0.5 * this.simulator.gridH - 0.5 * pipeHeight)
    const jMax = Math.floor(0.5 * this.simulator.gridH + 0.5 * pipeHeight)
    for (let j = jMin; j < jMax; j++) {
      this.simulator.rDyeField[id(0, j)] = 0.0
      this.simulator.gDyeField[id(0, j)] = 0.0
      this.simulator.bDyeField[id(0, j)] = 0.0
      this.simulator.rDyeField[id(1, j)] = 0.0
      this.simulator.gDyeField[id(1, j)] = 0.0
      this.simulator.bDyeField[id(1, j)] = 0.0
    }

    addCircularObstacle(this.simulator, 0.3, 0.5, 0.1)
  }

  draw(increment: number): void {
    //
    // debugger
    this.simulator.simulate()
    this.renderer.draw({ showDye: true, showObstacle: false, showStreamline: true })
  }
}
