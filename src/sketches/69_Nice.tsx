import { FluidRenderer } from '../FluidRenderer'
import {
  addCircularObstacle,
  addQuadrilateralObstacle,
  addTriangleObstacle,
  FluidSimulator,
} from '../FluidSimulator'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { hexToRgb } from '../utils/colorUtils'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { BooleanRange } from './tools/Range'

export default class Nice69 extends Sketch {
  static disableOverclock = true

  init() {
    this.addVar('size', { initialValue: 150, min: 16, max: 512, step: 1 })
    this.addVar('timeStep', { initialValue: 0.0122, min: 0.001, max: 0.05, step: 0.001 })
    this.addVar('solverIterations', { initialValue: 50, min: 8, max: 120, step: 1 })
    this.addVar('pipeHeight', { initialValue: 0.15, min: 0.01, max: 1, step: 0.01 })
    this.addVar('windVelocity', { initialValue: 1.3, min: 0.1, max: 10, step: 0.1 })
    this.addVar('streamlineDensity', { initialValue: 2, min: 1, max: 25, step: 1 })
    this.addVar('maxStreamlineIterations', { initialValue: 150, min: 1, max: 500, step: 1 })
    this.addVar('minPressureForStreamline', { initialValue: 0.1, min: 0, max: 1, step: 0.01 })
    this.addVar('waitBeforeSnapshot', { initialValue: 64, min: 0, max: 500, step: 1 })
    this.vs.showDye = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.vs.showStreamlines = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.vs.showObstacles = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.strokeObstacles = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  done = false
  linesDrawn = 0
  lines: number[][][] = []
  renderer: FluidRenderer
  simulator: FluidSimulator
  rectangles: [Point, Point, Point, Point][] = []
  triangles: [Point, Point, Point][] = []

  initDraw(): void {
    const { size, timeStep, solverIterations, pipeHeight, windVelocity } = this.vars

    this.done = false
    this.linesDrawn = 0
    this.lines = []

    this.simulator = new FluidSimulator(
      Math.floor((this.cw / this.ch) * size),
      size,
      timeStep,
      solverIterations
    )
    this.renderer = new FluidRenderer(
      this.simulator,
      this.ctx.canvasElement! /*, {
      width: size,
      height: size,
    }*/
    )

    this.rectangles = []
    this.triangles = []
    for (let i = 0; i < 7; i++) {
      this.drawTree({
        x: this.cw / 10 + (i * this.cw) / 8,
        height: randFloatRange(150, 100),
        width: randFloatRange(30, 25),
      })
    }

    //
    //
    //

    const id = (i: number, j: number) => i + this.simulator.gridW * j

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

    const iyMin = Math.floor(this.simulator.gridH * 0.05)
    const iyMax = Math.floor(this.simulator.gridH * (pipeHeight + 0.05))

    // set velocity
    for (let iy = 0; iy < iyMax; iy++) this.simulator.velocityFieldX[id(1, iy)] = windVelocity
    for (let iy = 0; iy < iyMax; iy++)
      this.simulator.velocityFieldX[id(this.simulator.gridW - 1, iy)] = -windVelocity
    for (let ix = 0; ix < this.simulator.gridW; ix++) {
      this.simulator.velocityFieldY[id(ix, 1)] = windVelocity / 10
      this.simulator.velocityFieldY[id(ix, this.simulator.gridH - 1)] = -windVelocity / 5
      this.simulator.velocityFieldX[id(ix, 1)] = randFloat(0.3)
    }

    // set dye
    // for (let ix = 0; ix < this.simulator.gridW; ix++) {
    //   if (ix % 10 !== 0) continue
    //   this.simulator.rDyeField[id(ix, 0)] = 0.0
    //   this.simulator.gDyeField[id(ix, 0)] = 0.0
    //   this.simulator.bDyeField[id(ix, 0)] = 0.0
    //   this.simulator.rDyeField[id(ix, 1)] = 0.0
    //   this.simulator.gDyeField[id(ix, 1)] = 0.0
    //   this.simulator.bDyeField[id(ix, 1)] = 0.0
    // }
    for (let iy = iyMin; iy < iyMax; iy++) {
      this.simulator.rDyeField[id(0, iy)] = 0.0
      this.simulator.gDyeField[id(0, iy)] = 0.0
      this.simulator.bDyeField[id(0, iy)] = 0.0
      this.simulator.rDyeField[id(1, iy)] = 0.0
      this.simulator.gDyeField[id(1, iy)] = 0.0
      this.simulator.bDyeField[id(1, iy)] = 0.0
    }

    const normalizePt = new Point(this.cw, this.ch)
    for (const triangle of this.triangles) {
      addTriangleObstacle(
        this.simulator,
        triangle[0].divide(normalizePt),
        triangle[1].divide(normalizePt),
        triangle[2].divide(normalizePt)
      )
    }
    for (const rectangle of this.rectangles) {
      addQuadrilateralObstacle(
        this.simulator,
        rectangle[0].divide(normalizePt),
        rectangle[1].divide(normalizePt),
        rectangle[2].divide(normalizePt),
        rectangle[3].divide(normalizePt)
      )
    }
  }

  drawTree({ x, height, width }: { x: number; height: number; width: number }) {
    const trunkWidth = 5
    const crownHeight = Math.min(randFloatRange(30, 10), height / 2)
    const canopyHeight = height - crownHeight
    const branches = Math.round(canopyHeight / (width * 0.5))

    const rectangle: [Point, Point, Point, Point] = [
      new Point(x - trunkWidth / 2, this.ch),
      new Point(x + trunkWidth / 2, this.ch),
      new Point(x + trunkWidth / 2, this.ch - height + 5),
      new Point(x - trunkWidth / 2, this.ch - height + 5),
    ]
    this.rectangles.push(rectangle)
    if (!!this.vs.strokeObstacles.value) {
      this.ctx.strokeRect(x - trunkWidth / 2, this.ch, trunkWidth, -height + 5)
    }
    let y = this.ch - height
    let w = width / 2
    for (let i = 0; i < branches; i++) {
      const foliageHeight = canopyHeight / (branches + 2)
      const triangle: [Point, Point, Point] = [
        new Point(x, y),
        new Point(x + w / 2, y + foliageHeight),
        new Point(x - w / 2, y + foliageHeight),
      ]
      this.triangles.push(triangle)
      if (!!this.vs.strokeObstacles.value) {
        this.ctx.strokeTriangle(...triangle)
      }
      y += canopyHeight / branches + randFloat(5)
      w += width / branches
    }
  }

  draw(increment: number): void {
    const {
      size,
      pipeHeight,
      windVelocity,
      streamlineDensity,
      maxStreamlineIterations,
      minPressureForStreamline,
      waitBeforeSnapshot,
    } = this.vars

    if (this.done) {
      if (this.linesDrawn < this.lines.length) {
        // size=32, / 1.35
        // size=64, / 5.3
        // size=96, / 12
        // size=128, / 22
        // size=136, / 24
        // polynomial pls
        // https://mycurvefit.com/
        // y = 0.001528273 - 0.001328085*x + 0.001325747*x^2
        // const divAmt = 0.001528273 - 0.001328085 * size + 0.001325747 * Math.pow(size, 2)
        const divAmt = 0.00129 * Math.pow(size, 2)
        const modifier = size / divAmt
        // const modifierY = size / 44

        for (let i = 0; i < size * 20; i++) {
          if (this.linesDrawn >= this.lines.length) break
          const line = this.lines[this.linesDrawn]
          this.ctx.beginPath()
          let lastPt = new Point(line[0][0] * modifier * this.cw, line[0][1] * modifier * this.ch)
          this.ctx.moveTo(lastPt.x, lastPt.y)
          for (let i = 1; i < line.length; i++) {
            const pt = new Point(line[i][0] * modifier * this.cw, line[i][1] * modifier * this.ch)
            if (lastPt.distanceTo(pt) > 0.8) {
              this.ctx.lineTo(pt.x, pt.y)
              lastPt = pt
            }
          }
          this.ctx.stroke()
          this.linesDrawn++
        }
      }
      return
    }

    const id = (i: number, j: number) => i + this.simulator.gridW * j
    const iyMax = Math.floor(this.simulator.gridH * (pipeHeight + 0.05))

    // set velocity
    // for (let iy = 0; iy < iyMax; iy++) this.simulator.velocityFieldX[id(1, iy)] = windVelocity
    for (let iy = 0; iy < iyMax; iy++)
      this.simulator.velocityFieldX[id(this.simulator.gridW - 2, iy)] = -windVelocity * 5

    this.simulator.simulate()
    this.renderer.draw({
      showDye: !!this.vs.showDye.value,
      showObstacle: !!this.vs.showObstacles.value,
      showStreamline: false,
    })

    if (!!this.vs.showStreamlines.value) {
      const returnData = increment === waitBeforeSnapshot
      const lines = this.renderer.drawStreamline({
        nthPixel: streamlineDensity,
        maxLineIterations: maxStreamlineIterations,
        minPressure: minPressureForStreamline,
        returnData,
      })
      if (returnData) {
        this.done = true
        this.ctx.reset()

        console.log(lines)
        this.lines = lines
        const normalizePt = new Point(this.cw, this.ch)

        if (!!this.vs.strokeObstacles.value) {
          for (const rectPts of this.rectangles) {
            this.ctx.beginPath()
            this.ctx.path(rectPts.map((pt) => pt.multiply(normalizePt)))
            this.ctx.closePath()
            this.ctx.stroke()
          }
          for (const trianglePts of this.triangles) {
            this.ctx.beginPath()
            this.ctx.path(trianglePts.map((pt) => pt.multiply(normalizePt)))
            this.ctx.closePath()
            this.ctx.stroke()
          }
        }
      }
    }
  }
}
