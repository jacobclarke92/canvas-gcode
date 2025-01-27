import type Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

interface LineSegment {
  pt1: Point
  pt2: Point
  length: number
  touchL?: LineSegment
  touchR?: LineSegment
}

interface SegmentIntersection {
  pt: Point
  lineSeg: LineSegment
}

export default class Genuary15_Rug1 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutterX', { initialValue: 11.25, min: 0, max: 120, step: 0.25 })
    this.addVar('gutterY', { initialValue: 11, min: 0, max: 120, step: 0.25 })
    this.addVar('baseSize', { initialValue: 13, min: 1, max: 50, step: 0.5 })
    this.addVar('spacerSize', { initialValue: 0, min: 0, max: 10, step: 0.1 })
    this.addVar('fillGap', { initialValue: 0.35, min: 0.1, max: 10, step: 0.05, disableRandomize: true }) // prettier-ignore
    this.addVar('indexDiv', { initialValue: 68.5, min: 1.5, max: 100, step: 0.5 })
    this.addVar('sizingOffset', {
      initialValue: 2.35619449019234,
      min: 0,
      max: Math.PI,
      step: Math.PI / 16,
    })
  }

  mode: 'plan' | 'draw' = 'plan'
  lines: LineSegment[] = []
  lastDrawLine: LineSegment | null = null

  initDraw(): void {
    const { seed, gutterX, gutterY, baseSize, spacerSize, indexDiv, sizingOffset } = this.vars
    seedRandom(seed)
    initPen(this)
    // Challenge: rug but also ended up being more op art

    const canvasW = this.cw - gutterX * 2
    const canvasH = this.ch - gutterY * 2

    let x = gutterX
    let xI = 0
    let y = gutterY
    let yI = 0

    while (y < gutterY + canvasH) {
      const w =
        xI % 2 === 0 && spacerSize !== 0
          ? spacerSize
          : Math.sin((sizingOffset + xI * (Math.PI / indexDiv)) % Math.PI) * baseSize
      const h =
        yI % 2 === 0 && spacerSize !== 0
          ? spacerSize
          : Math.sin((sizingOffset + yI * (Math.PI / indexDiv)) % Math.PI) * baseSize
      if ((xI % 2 === 0 && yI % 2 === 0) || (xI % 2 === 1 && yI % 2 === 1)) {
        this.fillRect(x, y, w, h)
      }

      xI++
      x += w
      if (x >= gutterX + canvasW) {
        x = gutterX
        xI = 0
        y += h
        yI++
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const { fillGap } = this.vars
    const rows = Math.floor(h / fillGap)
    const gapY = h / rows
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    for (let i = 0; i < rows; i++) {
      this.ctx.lineToRelative((i % 2 === 0 ? 1 : -1) * w, 0)
      this.ctx.lineToRelative(0, gapY)
    }
    this.ctx.lineToRelative((rows % 2 === 0 ? 1 : -1) * w, 0)
    this.ctx.stroke()
  }

  draw(increment: number): void {
    //
  }
}
