import Point from '../Point'
import { Sketch } from '../Sketch'
import { circleOverlapsCircles } from '../utils/geomUtils'
import { randFloat, randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

// const shapes = ['circle', 'triangle', 'rect', 'line'] as const

export default class Tattoo extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 1234, min: 1000, max: 5000, step: 1 })
    this.addVar('rez', { presentation: true, initialValue: 1, min: 0, max: 1.5, step: 0.01 })
    this.addVar('gutter', { presentation: true, initialValue: 0.1, min: 0, max: 0.4, step: 0.001 })
    this.addVar('wavePeriod', { initialValue: 1, min: 0.5, max: 4.5, step: 0.5 })
    this.addVar('startWave', { initialValue: 2, min: 1, max: 4, step: 1 })
    this.addVar('waves', { initialValue: 9, min: 1, max: 64, step: 1 })
    this.addVar('maxAmplitude', { initialValue: 200, min: 1, max: 500, step: 1 })
    this.addVar('steepness', { initialValue: 1, min: 1, max: 10, step: 2 })
    this.addVar('fatness', { initialValue: 1.8, min: 0.01, max: 2, step: 0.01 })

    this.vs.showShapes = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.vs.circles = new BooleanRange({
      requires: 'showShapes',
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.triangles = new BooleanRange({
      requires: 'showShapes',
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.lines = new BooleanRange({
      requires: 'showShapes',
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.rects = new BooleanRange({
      requires: 'showShapes',
      disableRandomize: true,
      initialValue: true,
    })
    this.addVar('shapeInterval', { requires: 'showShapes', initialValue: 0.5, min: 0.1, max: 10, step: 0.1 }) // prettier-ignore
    this.addVar('shapeChance', { requires: 'showShapes', initialValue: 0.05, min: 0, max: 0.5, step: 0.0001 }) // prettier-ignore
    this.addVar('chainChance', { requires: 'showShapes', initialValue: 0.5, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('maxShapeDrift', { requires: 'showShapes', initialValue: 0, min: 0, max: 20, step: 0.01 }) // prettier-ignore
    this.addVar('minShapeSize', { requires: 'showShapes', initialValue: 1.5, min: 1, max: 20, step: 0.01 }) // prettier-ignore
    this.addVar('maxShapeSize', { requires: 'showShapes', initialValue: 5, min: 1, max: 20, step: 0.01 }) // prettier-ignore
  }

  prevShapes: [pos: Point, rad: number][] = []

  initDraw(): void {
    // seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    /**
     * Draw the waves
     */

    const { startWave, waves, gutter, wavePeriod, rez, maxAmplitude, steepness, fatness } =
      this.vars

    const waveLength = this.cw * (1 - gutter)
    const detail = Math.max(0.1, (waveLength / 2) * (1 - rez))
    const startPt = new Point(this.cw * (gutter / 2), this.ch / 2)
    const endPt = new Point(this.cw * (1 - gutter / 2), this.ch / 2)

    this.ctx.ctx.lineWidth *= 2 // 2.5
    for (let i = startWave; i < waves; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(startPt.x, startPt.y)
      for (let x = 0; x < waveLength; x += detail) {
        const xAngle = (x / waveLength) * i * wavePeriod
        const xSin = Math.sin(xAngle * (Math.PI * 2))
        const y =
          Math.pow(xSin, steepness) *
          Math.pow(1 / i, fatness) *
          maxAmplitude *
          (1 - 1 / wavePeriod / 8)
        this.ctx.lineTo(startPt.x + x, startPt.y + y)
      }
      this.ctx.lineTo(endPt.x, endPt.y)

      this.ctx.stroke()
    }
    // this.ctx.ctx.lineWidth /= 2.5

    /**
     * Draw the shapes
     */

    const showShapes = !!this.vs.showShapes.value
    const shapes: string[] = []
    if (!!this.vs.circles.value) shapes.push('circle')
    if (!!this.vs.triangles.value) shapes.push('triangle')
    if (!!this.vs.lines.value) shapes.push('line')
    if (!!this.vs.rects.value) shapes.push('rect')

    this.prevShapes = []

    const { shapeInterval, shapeChance, maxShapeDrift, chainChance, minShapeSize, maxShapeSize } =
      this.vars

    if (showShapes) {
      const lastPt = startPt.clone()
      for (let i = startWave; i < waves; i++) {
        let drewLastTick = false
        let shape = shapes[randIntRange(shapes.length)]
        for (let x = 0; x < waveLength; x += shapeInterval) {
          const xAngle = (x / waveLength) * i * wavePeriod
          const xSin = Math.sin(xAngle * (Math.PI * 2))
          const y =
            Math.pow(xSin, steepness) *
            Math.pow(1 / i, fatness) *
            maxAmplitude *
            (1 - 1 / wavePeriod / 8)

          const spawnShape = randFloatRange(1) <= shapeChance
          const breakChain = randFloatRange(1) > chainChance
          if (!spawnShape || (drewLastTick && breakChain)) {
            drewLastTick = false
            shape = shapes[randIntRange(shapes.length)]
            lastPt.x = x
            lastPt.y = y
            continue
          }

          if (drewLastTick) {
            this.ctx.beginPath()
            this.ctx.moveTo(startPt.x + lastPt.x, startPt.y + lastPt.y)
            this.ctx.lineTo(startPt.x + x, startPt.y + y)
            this.ctx.stroke()
          }

          const shapeSize = randFloatRange(maxShapeSize, minShapeSize)
          const offsetX = randFloat(maxShapeDrift)
          const offsetY = randFloat(maxShapeDrift)
          const angleFromLast = Math.atan2(y - lastPt.y, x - lastPt.x)

          const shapePos = startPt.clone().add(new Point(x, y)).add(new Point(offsetX, offsetY))
          const shapeRotation = randFloat(Math.PI)

          if (circleOverlapsCircles([shapePos, shapeSize * 0.9], ...this.prevShapes)) {
            drewLastTick = false
            continue
          }

          this.prevShapes.push([shapePos, shapeSize * 0.9])

          // this.ctx.ctx.fillStyle =
          this.ctx.fillStyle = randFloatRange(1) > 0.5 ? '#000000' : '#ffffff'

          if (shape == 'circle') {
            this.ctx.fillCircle(startPt.x + x + offsetX, startPt.y + y + offsetY, shapeSize * 0.9)
            this.ctx.strokeCircle(startPt.x + x + offsetX, startPt.y + y + offsetY, shapeSize * 0.9)
          } else if (shape === 'line') {
            this.ctx.beginPath()
            this.ctx.moveTo(
              shapePos.x + Math.cos(angleFromLast - Math.PI / 2) * shapeSize,
              shapePos.y + Math.sin(angleFromLast - Math.PI / 2) * shapeSize
            )
            this.ctx.lineTo(
              shapePos.x + Math.cos(angleFromLast + Math.PI / 2) * shapeSize,
              shapePos.y + Math.sin(angleFromLast + Math.PI / 2) * shapeSize
            )
            this.ctx.stroke()
          } else if (shape === 'triangle') {
            this.ctx.fillPolygon(
              startPt.x + x + offsetX,
              startPt.y + y + offsetY,
              3,
              shapeSize,
              shapeRotation
            )
            this.ctx.strokePolygon(
              startPt.x + x + offsetX,
              startPt.y + y + offsetY,
              3,
              shapeSize,
              shapeRotation
            )
          } else if (shape === 'rect') {
            this.ctx.fillPolygon(
              startPt.x + x + offsetX,
              startPt.y + y + offsetY,
              4,
              shapeSize,
              shapeRotation
            )
            this.ctx.strokePolygon(
              startPt.x + x + offsetX,
              startPt.y + y + offsetY,
              4,
              shapeSize,
              shapeRotation
            )
          }

          lastPt.x = x
          lastPt.y = y

          drewLastTick = true
        }
      }
    }

    penUp(this)
  }

  draw(increment: number): void {
    //
  }
}
