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
    })
    this.addVar('objects', {
      initialValue: 3,
      min: 1,
      max: 25,
      step: 1,
    })

    this.addVar('minSize', {
      initialValue: 5,
      min: 1,
      max: 25,
      step: 1,
    })
    this.addVar('maxSize', {
      initialValue: 20,
      min: 1,
      max: 50,
      step: 1,
    })
    this.addVar('sizeOscAmount', {
      initialValue: 0.1,
      min: 0,
      max: 1,
      step: 0.001,
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
      min: -0.02,
      max: 0.02,
      step: 0.001,
    })
    this.addVar('initSpeedY', {
      initialValue: -0.005,
      min: -0.02,
      max: 0.02,
      step: 0.001,
    })
    this.addVar('bounciness', {
      initialValue: 0.95,
      min: 0,
      max: 1,
      step: 0.01,
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
    })
    this.vs.showWalls = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
  }

  engine: Engine
  boxes: Matter.Body[] = []
  panicCount = 0
  finalized = false

  colors = ['#00ff00', '#ff00ff', '#00ffff', '#ff0000'] as const
  colorShapes: Record<number, Vector[][]>

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
    this.boxes = []
    this.panicCount = 0
    this.finalized = false

    const { objects, minSize, maxSize, initSpeedX, initSpeedY, bounciness, wallThickness } =
      this.vars

    for (let i = 0; i < objects; i++) {
      const size = randFloatRange(maxSize, minSize)
      const box = Bodies.rectangle(this.cw / 4, this.ch / 3, size, size, {
        restitution: bounciness,
        angle: randFloatRange(Math.PI / 2),
        force: { x: initSpeedX, y: initSpeedY },
      })
      this.boxes.push(box)
    }

    const ground = Bodies.rectangle(
      this.cw / 2,
      this.ch - wallThickness / 2,
      this.cw,
      wallThickness,
      { isStatic: true }
    )
    const roof = Bodies.rectangle(this.cw / 2, wallThickness / 2, this.cw, wallThickness, {
      isStatic: true,
    })
    const wallLeft = Bodies.rectangle(wallThickness / 2, this.ch / 2, wallThickness, this.ch, {
      isStatic: true,
    })
    const wallRight = Bodies.rectangle(
      this.cw - wallThickness / 2,
      this.ch / 2,
      wallThickness,
      this.ch,
      { isStatic: true }
    )
    Composite.add(this.engine.world, [ground, roof, wallLeft, wallRight, ...this.boxes])

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
        this.drawVertices(shape)
      }
    }
    penUp(this)
    this.finalized = true
  }

  draw(increment: number): void {
    const { startAfter } = this.vars

    const bedtime = this.boxes.every((box) => box.isSleeping)
    if (bedtime || ++this.panicCount >= this.vars.stopAfter) {
      this.finalizeDraw()
      return
    }

    this.sizeOsc.step(increment)

    for (const box of this.boxes) {
      Body.scale(box, 1 + this.sizeOsc.value.x, 1 + this.sizeOsc.value.x)
    }

    Engine.update(this.engine, this.vars.simSpeed)

    if (increment < startAfter) return
    const colorIndex = increment % this.colors.length

    for (const box of this.boxes) {
      this.colorShapes[colorIndex].push(box.vertices.map((vector) => Vector.clone(vector)))
    }
  }
}
