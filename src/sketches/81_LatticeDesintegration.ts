import { deg360 } from '../constants/angles'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { perlin2, seedNoise } from '../utils/noise'
import { plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class LatticeDesintegration extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('segments', { name: 'segments', initialValue: 8, min: 1, max: 128, step: 1 })
    this.addVar('dissolutionStrength', { name: 'dissolutionStrength', initialValue: 0.5, min: 0, max: 15, step: 0.01 }) // prettier-ignore
    this.addVar('distortDistMult', { name: 'distortDistMult', initialValue: 0.5, min: 0, max: 1, step: 0.01, disableRandomize: true }) // prettier-ignore
    this.addVar('inverseResolution', { name: 'inverseResolution', initialValue: 0.25, min: 0.05, max: 2, step: 0.01, disableRandomize: true }) // prettier-ignore
    this.addVar('perlinDiv', {name: 'perlinDiv', initialValue: 25, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('offsetX', { name: 'offsetX', initialValue: 0, min: -500, max: 500, step: 1 })
    this.addVar('offsetY', { name: 'offsetY', initialValue: 0, min: -500, max: 500, step: 1 })
  }

  segSize = 0
  gridSize = 0

  getDistortedPt = (pt: Point | [x: number, y: number], strength: number) => {
    const x = pt instanceof Array ? pt[0] : pt.x
    const y = pt instanceof Array ? pt[1] : pt.y
    const { dissolutionStrength, distortDistMult, perlinDiv, offsetX, offsetY } = this.vars
    const angleMod = perlin2((x + offsetX) / perlinDiv, (y + offsetY) / perlinDiv)
    return new Point(
      x +
        Math.cos(angleMod * deg360) *
          (this.segSize * distortDistMult) *
          (dissolutionStrength * strength),
      y +
        Math.sin(angleMod * deg360) *
          (this.segSize * distortDistMult) *
          (dissolutionStrength * strength)
    )
  }

  initDraw(): void {
    const { seed, gutter, segments, inverseResolution } = this.vars
    seedRandom(seed)
    seedNoise(seed)

    plotBounds(this)

    this.segSize = (this.ch - gutter * 2) / segments
    this.gridSize = this.segSize * segments
    const gridHypot = Math.sqrt(this.gridSize ** 2 + this.gridSize ** 2)
    const startX = (this.cw - this.segSize * segments) / 2
    const endPt = new Point(startX + this.gridSize, gutter + this.gridSize)

    for (let xI = 1; xI < segments; xI++) {
      const x = startX + xI * this.segSize
      const pt = new Point(x, xI % 2 ? gutter : gutter + this.gridSize)
      let strength = pt.distanceTo(endPt) / gridHypot
      this.ctx.beginPath()
      this.ctx.moveTo(...this.getDistortedPt(pt, strength).toArray())
      for (
        ;
        xI % 2 ? pt.y < gutter + this.gridSize : pt.y > gutter;
        pt.y += inverseResolution * (xI % 2 ? 1 : -1)
      ) {
        strength = pt.distanceTo(endPt) / gridHypot
        const distortedPt = this.getDistortedPt(pt, strength)
        this.ctx.lineTo(...distortedPt.toArray())
      }
      this.ctx.stroke()
      this.ctx.closePath()
    }

    for (let yI = 1; yI < segments; yI++) {
      const y = gutter + yI * this.segSize
      const pt = new Point(yI % 2 ? startX : startX + this.gridSize, y)
      let strength = pt.distanceTo(endPt) / gridHypot
      this.ctx.beginPath()
      this.ctx.moveTo(...this.getDistortedPt(pt, strength).toArray())
      for (
        ;
        yI % 2 ? pt.x < startX + this.gridSize : pt.x > startX;
        pt.x += inverseResolution * (yI % 2 ? 1 : -1)
      ) {
        strength = pt.distanceTo(endPt) / gridHypot
        const distortedPt = this.getDistortedPt(pt, strength)
        this.ctx.lineTo(...distortedPt.toArray())
      }
      this.ctx.stroke()
      this.ctx.closePath()
      //
    }
  }

  draw(): void {
    //
  }
}
