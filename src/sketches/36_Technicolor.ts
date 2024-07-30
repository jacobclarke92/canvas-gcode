import { Bodies, Composite, Engine } from 'matter-js'

import { Sketch } from '../Sketch'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Technicolor extends Sketch {
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })

    this.addVar('stopAfter', {
      initialValue: 150,
      min: 10,
      max: 50000,
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
  }

  engine: Engine
  boxes: Matter.Body[] = []
  panicCount = 0

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.engine = Engine.create({ enableSleeping: true, velocityIterations: 12 })
    this.boxes = []
    this.panicCount = 0

    const { objects, minSize, maxSize, initSpeedX, initSpeedY, bounciness } = this.vars

    for (let i = 0; i < objects; i++) {
      const size = randFloatRange(maxSize, minSize)
      const box = Bodies.rectangle(this.cw / 4, this.ch / 3, size, size, {
        restitution: bounciness,
        angle: randFloatRange(Math.PI / 2),
        force: { x: initSpeedX, y: initSpeedY },
      })
      this.boxes.push(box)
    }

    const ground = Bodies.rectangle(0, this.ch - 10, this.cw * 2, 5, { isStatic: true })
    const wallLeft = Bodies.rectangle(0, 0, 5, this.ch, { isStatic: true })
    const wallRight = Bodies.rectangle(this.cw - 10, 0, 5, this.ch, { isStatic: true })
    Composite.add(this.engine.world, [ground, wallLeft, wallRight, ...this.boxes])
  }

  draw(increment: number): void {
    //
    Engine.update(this.engine, this.vars.simSpeed)

    const bedtime = this.boxes.every((box) => box.isSleeping)
    if (bedtime || ++this.panicCount >= this.vars.stopAfter) {
      penUp(this)
      return
    }

    for (const box of this.boxes) {
      this.ctx.beginPath()
      const vertices = [...box.vertices]
      this.ctx.moveTo(vertices[0].x, vertices[0].y)
      for (let v = 0; v < box.vertices.length; v++) {
        this.ctx.lineTo(box.vertices[v].x, box.vertices[v].y)
      }
      this.ctx.lineTo(vertices[0].x, vertices[0].y)
      this.ctx.stroke()
      this.ctx.closePath()
    }
  }
}
