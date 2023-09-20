import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Bounds, Circle } from '../utils/geomUtils'
import { boundsOverlap, circleOverlapsCircles, getBoundsFromCircles } from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloat, randIntRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'

export default class Aeroplane extends Sketch {
  static generateGCode = false

  init() {
    this.ctx._background = '#111111'
    this.ctx._fillStyle = '#111111'
    this.ctx._strokeStyle = '#ffffff'
    this.ctx.ctx.fillStyle = '#111111'
    this.ctx.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', { initialValue: 9275, min: 1000, max: 5000, step: 1, disableRandomize: true })
    this.addVar('noiseSeed', { initialValue: 9275, min: 1000, max: 5000, step: 1, disableRandomize: true })
    this.addVar('stopAfter', { initialValue: 12500, min: 5, max: 20000, step: 1, disableRandomize: true })
    this.addVar('startRadius', { initialValue: 1.5, min: 1, max: 20, step: 0.1 })
    this.addVar('startRadiusVary', { initialValue: 0.5, min: 0, max: 10, step: 0.01 })
    this.addVar('radiusVary', { initialValue: 0, min: 0, max: 2, step: 0.01 })
    this.addVar('radiusReductionDiv', { initialValue: 1.08, min: 1.001, max: 2, step: 0.001 })
    this.addVar('radiusFitDiv', { initialValue: 1.1, min: 1.01, max: 10, step: 0.01 })
    this.addVar('radiusDiffChainCutoff', { initialValue: 2, min: 1.01, max: 10, step: 0.001 })
    this.addVar('minChainLength', { initialValue: 6, min: 1, max: 15, step: 1 })
    this.addVar('perlinDivX', { initialValue: 40, min: 1, max: 100, step: 1 })
    this.addVar('perlinDivY', { initialValue: 75, min: 1, max: 100, step: 1 })
    this.addVar('perlinOffsetX', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('perlinOffsetY', { initialValue: 0, min: -100, max: 100, step: 1 })
  }

  increment = 0
  currentPos = new Point(0, 0)
  lastRadius = 0
  chains: { circles: Circle[]; bounds: Bounds }[] = []
  currentChain: Circle[] = []
  circleCount = 0

  initDraw(): void {
    seedRandom(this.vars.randSeed)
    seedNoise(this.vars.noiseSeed)
    this.increment = 0
    this.circleCount = 0

    this.chains = []
    this.lastRadius = 0
    this.currentPos.x = randIntRange(this.cw)
    this.currentPos.y = randIntRange(this.ch)
  }

  getCirclesNearBounds(bounds: Bounds): Circle[] {
    const circles: Circle[] = []
    this.chains
      .filter((chain) => boundsOverlap(bounds, chain.bounds))
      .forEach((chain) => {
        circles.push(...chain.circles)
      })
    return circles
  }

  draw(increment: number): void {
    const {
      startRadius,
      radiusReductionDiv,
      radiusVary,
      startRadiusVary,
      perlinDivX,
      perlinDivY,
      perlinOffsetX,
      perlinOffsetY,
    } = this.vars

    if (this.circleCount < this.vars.stopAfter) {
      console.log('running')
      for (let i = 0; i < this.vs.speedUp.value; i++) {
        this.increment++

        let nextRadius: number
        let nextPos: Point

        if (this.lastRadius <= 0) {
          let panic1 = 0
          while (panic1 < 1000 && (!nextRadius || nextRadius <= 0)) {
            panic1++
            nextRadius = startRadius + randFloat(startRadiusVary)
          }
          let panic2 = 0
          while (
            panic2 < 2000 &&
            (!nextPos ||
              circleOverlapsCircles(
                [nextPos, nextRadius],
                ...this.getCirclesNearBounds(getBoundsFromCircles([nextPos, nextRadius]))
              ))
          ) {
            panic2++
            nextPos = new Point(randIntRange(this.cw), randIntRange(this.ch))
          }
          if (panic1 < 1000 && panic2 < 1000) {
            // this.ctx.strokeCircle(nextPos, nextRadius)
            this.currentChain.push([nextPos, nextRadius])
          }
          // this.ctx.ctx.lineWidth = 0.5
        } else {
          const theta =
            perlin2(
              (this.currentPos.x + perlinOffsetX) / perlinDivX,
              (this.currentPos.y + perlinOffsetY) / perlinDivY
            ) *
            Math.PI *
            2
          nextRadius = this.lastRadius / (radiusReductionDiv * (1 + randFloat(radiusVary)))
          if (nextRadius > 0) {
            nextPos = new Point(
              this.currentPos.x + Math.cos(theta) * (this.lastRadius + nextRadius),
              this.currentPos.y + Math.sin(theta) * (this.lastRadius + nextRadius)
            )
            let panic = 0
            while (
              panic < 1000 &&
              nextRadius > 0.07 &&
              circleOverlapsCircles(
                [nextPos, nextRadius],
                ...this.getCirclesNearBounds(getBoundsFromCircles(...this.currentChain, [nextPos, nextRadius])),
                ...this.currentChain
              )
            ) {
              panic++
              nextRadius /= this.vars.radiusFitDiv
              nextPos.x = this.currentPos.x + Math.cos(theta) * (this.lastRadius + nextRadius)
              nextPos.y = this.currentPos.y + Math.sin(theta) * (this.lastRadius + nextRadius)
            }

            if (
              nextRadius <= 0.07 ||
              nextPos.x + nextRadius < 0 ||
              nextPos.x - nextRadius > this.cw ||
              nextPos.y + nextRadius < 0 ||
              nextPos.y - nextRadius > this.ch
            ) {
              nextRadius = 0
              // commit chain
              if (this.currentChain.length >= this.vars.minChainLength) {
                this.chains.push({
                  circles: this.currentChain,
                  bounds: getBoundsFromCircles(...this.currentChain),
                })
                this.circleCount += this.currentChain.length
                for (const [pt, radius] of this.currentChain) this.ctx.strokeCircle(pt, radius)
              }
              this.currentChain = []
            } else if (this.lastRadius / nextRadius > this.vars.radiusDiffChainCutoff) {
              // radius change is too big - discard chain
              nextRadius = 0
              this.currentChain = []
            } else {
              this.currentChain.push([nextPos, nextRadius])
            }
          }
        }
        this.lastRadius = nextRadius
        if (nextRadius > 0) this.currentPos = nextPos
      }
    }
  }
}
