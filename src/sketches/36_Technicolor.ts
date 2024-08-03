import type { IBodyDefinition, IChamferableBodyDefinition } from 'matter-js'
import { Bodies, Body, Composite, Engine, Vector } from 'matter-js'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class Technicolor extends Sketch {
  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('startAfter', {
      initialValue: 5,
      min: 0,
      max: 100,
      step: 1,
    })
    this.addVar('stopAfter', {
      initialValue: 150,
      min: 10,
      max: 10000,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('objects', {
      initialValue: 1,
      min: 1,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('initialX', {
      initialValue: 0.5,
      min: 0,
      max: 1,
      step: 0.001,
    })
    this.addVar('initialY', {
      initialValue: 0.25,
      min: 0,
      max: 1,
      step: 0.001,
    })
    this.addVar('initialAngle', {
      initialValue: 0.24,
      min: 0,
      max: Math.PI / 2,
      step: 0.001,
    })
    this.addVar('initialTorque', {
      initialValue: 0.1,
      min: 0,
      max: 1,
      step: 0.001,
    })
    this.addVar('minSize', {
      initialValue: 35,
      min: 1,
      max: 75,
      step: 1,
    })
    this.addVar('maxSize', {
      initialValue: 40,
      min: 1,
      max: 100,
      step: 1,
    })
    this.addVar('sizeOscAmount', {
      initialValue: 0,
      min: 0,
      max: 0.25,
      step: 0.001,
      disableRandomize: true,
    })
    this.addVar('sizeOscSpeed', {
      initialValue: 0.1,
      min: 0,
      max: Math.PI / 8,
      step: Math.PI / 666,
    })
    this.sizeOsc = new Osc({
      speed: (i) => this.vars.sizeOscSpeed,
      radius: (i) => this.vars.sizeOscAmount,
      phase: 0,
    })
    this.addVar('initSpeedX', {
      initialValue: 0.005,
      min: -0.1,
      max: 0.1,
      step: 0.0001,
    })
    this.addVar('initSpeedY', {
      initialValue: -0.005,
      min: -0.1,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('bounciness', {
      initialValue: 0.95,
      min: 0,
      max: 1,
      step: 0.0001,
    })
    this.addVar('simSpeed', {
      initialValue: 10,
      min: 0.1,
      max: 100,
      step: 0.1,
    })
    this.addVar('wallThickness', {
      initialValue: 5,
      min: 0.1,
      max: 50,
      step: 0.1,
      disableRandomize: true,
    })
    this.vs.showWalls = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.circleInstead = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
  }

  engine: Engine
  shapes: Matter.Body[] = []
  panicCount = 0
  finalized = false

  colors = ['#00ff00', '#ff00ff', '#00ffff', '#ff0000'] as const
  colorShapes: Record<number, (Vector[] | { pos: Vector; radius: number })[]>

  initDraw(): void {
    this.ctx.ctx.fillStyle = '#111111'
    this.ctx.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    this.sizeOsc.phase = 0
    this.sizeOsc.radius = new Point(this.vars.sizeOscAmount, this.vars.sizeOscAmount)
    this.sizeOsc.reset()

    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.colorShapes = { 0: [], 1: [], 2: [], 3: [] }
    this.engine = Engine.create({ enableSleeping: true, velocityIterations: 12 })
    this.shapes = []
    this.panicCount = 0
    this.finalized = false

    const {
      objects,
      minSize,
      maxSize,
      initSpeedX,
      initSpeedY,
      bounciness,
      wallThickness,
      initialAngle,
      initialX,
      initialY,
      initialTorque,
    } = this.vars

    const isCircle = !!this.vs.circleInstead.value

    for (let i = 0; i < objects; i++) {
      const size = randFloatRange(maxSize, minSize)

      const shapeProperties: IBodyDefinition = {
        restitution: bounciness,
        // friction: isCircle ? 0.9 : 0.1,
        density: 0.0001,
        angle: initialAngle,
        // angularSpeed
        torque: initialTorque,
        force: { x: initSpeedX, y: initSpeedY },
      }

      const x = initialX * this.cw
      const y = initialY * this.ch

      if (isCircle) {
        this.shapes.push(Bodies.circle(x, y, size / 2, shapeProperties))
      } else {
        this.shapes.push(Bodies.rectangle(x, y, size, size, shapeProperties))
      }
    }

    const ground = Bodies.rectangle(
      this.cw / 2,
      this.ch - wallThickness / 2,
      this.cw,
      wallThickness,
      { isStatic: true, restitution: 1, friction: 0.05 }
    )
    const roof = Bodies.rectangle(this.cw / 2, wallThickness / 2, this.cw, wallThickness, {
      isStatic: true,
      restitution: 1,
      friction: 0.05,
    })
    const wallLeft = Bodies.rectangle(wallThickness / 2, this.ch / 2, wallThickness, this.ch, {
      isStatic: true,
      restitution: 1,
      friction: 0.05,
    })
    const wallRight = Bodies.rectangle(
      this.cw - wallThickness / 2,
      this.ch / 2,
      wallThickness,
      this.ch,
      { isStatic: true, restitution: 1, friction: 0.05 }
    )
    Composite.add(this.engine.world, [ground, roof, wallLeft, wallRight, ...this.shapes])

    if (this.vs.showWalls.value) {
      this.drawBody(ground)
      this.drawBody(roof)
      this.drawBody(wallLeft)
      this.drawBody(wallRight)
    }
  }

  drawBody(body: Body): void {
    this.drawVertices([...body.vertices])
  }

  drawVertices(vertices: Vector[]): void {
    this.ctx.beginPath()
    this.ctx.moveTo(vertices[0].x, vertices[0].y)
    for (let v = 0; v < vertices.length; v++) {
      this.ctx.lineTo(vertices[v].x, vertices[v].y)
    }
    this.ctx.lineTo(vertices[0].x, vertices[0].y)
    this.ctx.stroke()
    this.ctx.closePath()
  }

  finalizeDraw(): void {
    if (this.finalized) return
    for (let i = 0; i < this.colors.length; i++) {
      const color = this.colors[i]
      if (i > 0) stopAndWigglePen(this, `color ${color}`)
      this.ctx.strokeStyle = color
      for (const shape of this.colorShapes[i]) {
        if (!!this.vs.circleInstead.value && !Array.isArray(shape)) {
          this.ctx.beginPath()
          this.ctx.strokeCircle(shape.pos.x, shape.pos.y, shape.radius)
          this.ctx.closePath()
        } else {
          this.drawVertices(shape as Vector[])
        }
      }
    }
    penUp(this)
    this.finalized = true
  }

  draw(increment: number): void {
    const { startAfter } = this.vars

    const bedtime = this.shapes.every((box) => box.isSleeping)
    if (bedtime || ++this.panicCount >= this.vars.stopAfter) {
      this.finalizeDraw()
      return
    }

    this.sizeOsc.step(increment)

    for (const box of this.shapes) {
      Body.scale(box, 1 + this.sizeOsc.value.x, 1 + this.sizeOsc.value.x)
    }

    Engine.update(this.engine, this.vars.simSpeed)

    if (increment < startAfter) return
    const colorIndex = increment % this.colors.length

    for (const shape of this.shapes) {
      if (!!this.vs.circleInstead.value) {
        this.colorShapes[colorIndex].push({
          pos: Vector.clone(shape.position),
          radius: shape.circleRadius!,
        })
      } else {
        this.colorShapes[colorIndex].push(shape.vertices.map((vector) => Vector.clone(vector)))
      }
    }
  }
}
