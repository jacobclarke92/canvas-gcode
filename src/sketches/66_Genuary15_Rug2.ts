import type { Bounds } from '../Path'
import type Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Genuary15_Rug2 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutterX', { initialValue: 43, min: 0, max: 120, step: 0.25 })
    this.addVar('gutterY', { initialValue: 66, min: 0, max: 120, step: 0.25 })
    this.addVar('segments', { initialValue: 4, min: 3, max: 30, step: 1 })
    this.addVar('thickness', { initialValue: 2, min: 0.25, max: 100, step: 0.25 })
    this.addVar('offsetDistance', { initialValue: 2, min: 0.25, max: 50, step: 0.25 })
    this.addVar('offsetCount', { initialValue: 16, min: 0, max: 50, step: 1 })
  }

  initDraw(): void {
    const { seed, gutterX, gutterY, segments, thickness, offsetDistance, offsetCount } = this.vars
    seedRandom(seed)
    initPen(this)
    // Challenge: rug but also ended up being more op art

    const canvasW = this.cw - gutterX * 2
    const canvasH = this.ch - gutterY * 2

    const segLength = (canvasH - thickness) / 2
    const segSpacing = (canvasW - thickness * segments) / (segments - 1)

    this.ctx.beginPath()
    this.ctx.moveTo(gutterX, gutterY + segLength)
    this.ctx.lineToRelative(0, thickness + segLength)

    this.ctx.lineToRelative(thickness, 0)
    // this.ctx.lineToRelative(thickness / 2, thickness / 2)
    // this.ctx.lineToRelative(thickness / 2, -thickness / 2)

    this.ctx.lineToRelative(0, -segLength)

    for (let i = 0; i < segments - 1; i++) {
      this.ctx.lineToRelative(segSpacing, 0)
      this.ctx.lineToRelative(0, segLength)

      this.ctx.lineToRelative(thickness, 0)
      // this.ctx.lineToRelative(thickness / 2, thickness / 2)
      // this.ctx.lineToRelative(thickness / 2, -thickness / 2)

      this.ctx.lineToRelative(0, -segLength)
    }

    this.ctx.lineToRelative(0, -(thickness + segLength))

    this.ctx.lineToRelative(-thickness, 0)
    // this.ctx.lineToRelative(-thickness / 2, -thickness / 2)
    // this.ctx.lineToRelative(-thickness / 2, thickness / 2)

    this.ctx.lineToRelative(0, segLength)

    for (let i = 0; i < segments - 1; i++) {
      this.ctx.lineToRelative(-segSpacing, 0)
      this.ctx.lineToRelative(0, -segLength)

      this.ctx.lineToRelative(-thickness, 0)
      // this.ctx.lineToRelative(-thickness / 2, -thickness / 2)
      // this.ctx.lineToRelative(-thickness / 2, thickness / 2)

      this.ctx.lineToRelative(0, segLength)
    }
    // this.ctx.stroke()

    let outlinePts = this.ctx.currentPath.getPoints()
    this.ctx.stroke()
    let bounds: Bounds

    for (let i = 0; i < offsetCount; i++) {
      const offsetPaths = this.ctx
        .offsetPath(outlinePts, offsetDistance)
        .sort((a, b) => a.length - b.length)
      outlinePts = offsetPaths[offsetPaths.length - 1]

      for (const offsetPath of offsetPaths) {
        this.ctx.beginPath()
        this.ctx.moveTo(offsetPath[0].x, offsetPath[0].y)
        for (let i = 1; i < offsetPath.length; i++) {
          this.ctx.lineTo(offsetPath[i].x, offsetPath[i].y)
        }
        bounds = this.ctx.currentPath.getBounds()
        this.ctx.stroke()
      }
    }

    bounds.left -= thickness
    bounds.right += thickness
    bounds.top -= thickness
    bounds.bottom += thickness

    this.ctx.beginPath()
    this.ctx.moveTo(bounds.left, bounds.top)
    this.ctx.lineTo(bounds.right, bounds.top)
    this.ctx.lineTo(bounds.right, bounds.bottom)
    this.ctx.lineTo(bounds.left, bounds.bottom)
    this.ctx.closePath()
    this.ctx.stroke()

    bounds.left -= offsetDistance
    bounds.right += offsetDistance
    bounds.top -= offsetDistance
    bounds.bottom += offsetDistance

    this.ctx.beginPath()
    this.ctx.moveTo(bounds.left + offsetDistance * 2, bounds.top)
    let lastPt = this.ctx.currentPath.lastPoint()
    while (lastPt && lastPt.x < bounds.right - offsetDistance * 2) {
      this.ctx.lineToRelative(0, -offsetDistance * 2)
      this.ctx.lineToRelative(offsetDistance * 2, 0)
      this.ctx.lineToRelative(0, offsetDistance)
      this.ctx.lineToRelative(-offsetDistance, 0)
      this.ctx.lineToRelative(0, offsetDistance)
      this.ctx.lineToRelative(offsetDistance * 2, 0)
      lastPt = this.ctx.currentPath.lastPoint()
    }
    const topRightLastPt = this.ctx.currentPath.lastPoint() as Point
    this.ctx.lineTo(bounds.right, bounds.top)
    this.ctx.lineToRelative(0, offsetDistance * 2)
    lastPt = this.ctx.currentPath.lastPoint()
    while (lastPt && lastPt.y < bounds.bottom - offsetDistance * 2) {
      this.ctx.lineToRelative(offsetDistance * 2, 0)
      this.ctx.lineToRelative(0, offsetDistance * 2)
      this.ctx.lineToRelative(-offsetDistance, 0)
      this.ctx.lineToRelative(0, -offsetDistance)
      this.ctx.lineToRelative(-offsetDistance, 0)
      this.ctx.lineToRelative(0, offsetDistance * 2)
      lastPt = this.ctx.currentPath.lastPoint()
    }
    const bottomRightLastPt = this.ctx.currentPath.lastPoint() as Point
    this.ctx.lineTo(bounds.right, bounds.bottom)
    this.ctx.lineToRelative(-offsetDistance * 2, 0)
    lastPt = this.ctx.currentPath.lastPoint()
    while (lastPt && lastPt.x > bounds.left + offsetDistance * 2) {
      this.ctx.lineToRelative(0, offsetDistance * 2)
      this.ctx.lineToRelative(-offsetDistance * 2, 0)
      this.ctx.lineToRelative(0, -offsetDistance)
      this.ctx.lineToRelative(offsetDistance, 0)
      this.ctx.lineToRelative(0, -offsetDistance)
      this.ctx.lineToRelative(-offsetDistance * 2, 0)
      lastPt = this.ctx.currentPath.lastPoint()
    }
    const bottomLeftLastPt = this.ctx.currentPath.lastPoint() as Point
    this.ctx.lineTo(bounds.left, bounds.bottom)
    this.ctx.lineToRelative(0, -offsetDistance * 2)
    lastPt = this.ctx.currentPath.lastPoint()
    while (lastPt && lastPt.y > bounds.top + offsetDistance * 2) {
      this.ctx.lineToRelative(-offsetDistance * 2, 0)
      this.ctx.lineToRelative(0, -offsetDistance * 2)
      this.ctx.lineToRelative(offsetDistance, 0)
      this.ctx.lineToRelative(0, offsetDistance)
      this.ctx.lineToRelative(offsetDistance, 0)
      this.ctx.lineToRelative(0, -offsetDistance * 2)
      lastPt = this.ctx.currentPath.lastPoint()
    }
    const topLeftLastPt = this.ctx.currentPath.lastPoint() as Point
    this.ctx.lineTo(bounds.left, bounds.top)
    this.ctx.lineToRelative(offsetDistance * 2, 0)
    this.ctx.stroke()

    // draw top right corner
    this.ctx.beginPath()
    this.ctx.moveTo(topRightLastPt.x, topRightLastPt.y - offsetDistance)
    this.ctx.lineToRelative(0, -offsetDistance)
    this.ctx.lineTo(bounds.right + offsetDistance * 2, bounds.top - offsetDistance * 2)
    this.ctx.lineToRelative(0, offsetDistance * 3)
    this.ctx.lineToRelative(-offsetDistance, 0)
    this.ctx.lineToRelative(0, -offsetDistance * 2)
    this.ctx.closePath()
    this.ctx.stroke()

    // draw bottom right corner
    this.ctx.beginPath()
    this.ctx.moveTo(bottomRightLastPt.x + offsetDistance, bottomRightLastPt.y)
    this.ctx.lineToRelative(offsetDistance, 0)
    this.ctx.lineTo(bounds.right + offsetDistance * 2, bounds.bottom + offsetDistance * 2)
    this.ctx.lineToRelative(-offsetDistance * 3, 0)
    this.ctx.lineToRelative(0, -offsetDistance)
    this.ctx.lineToRelative(offsetDistance * 2, 0)
    this.ctx.closePath()
    this.ctx.stroke()

    // draw bottom left corner
    this.ctx.beginPath()
    this.ctx.moveTo(bottomLeftLastPt.x, bottomLeftLastPt.y + offsetDistance)
    this.ctx.lineToRelative(0, offsetDistance)
    this.ctx.lineTo(bounds.left - offsetDistance * 2, bounds.bottom + offsetDistance * 2)
    this.ctx.lineToRelative(0, -offsetDistance * 3)
    this.ctx.lineToRelative(offsetDistance, 0)
    this.ctx.lineToRelative(0, offsetDistance * 2)
    this.ctx.closePath()
    this.ctx.stroke()

    // draw top left corner
    this.ctx.beginPath()
    this.ctx.moveTo(topLeftLastPt.x - offsetDistance, topLeftLastPt.y)
    this.ctx.lineToRelative(-offsetDistance, 0)
    this.ctx.lineTo(bounds.left - offsetDistance * 2, bounds.top - offsetDistance * 2)
    this.ctx.lineToRelative(offsetDistance * 3, 0)
    this.ctx.lineToRelative(0, offsetDistance)
    this.ctx.lineToRelative(-offsetDistance * 2, 0)
    this.ctx.closePath()
    this.ctx.stroke()

    this.ctx.beginPath()
    this.ctx.moveTo(bounds.left - offsetDistance * 3, bounds.top - offsetDistance * 3)
    this.ctx.lineTo(bounds.right + offsetDistance * 3, bounds.top - offsetDistance * 3)
    this.ctx.lineTo(bounds.right + offsetDistance * 3, bounds.bottom + offsetDistance * 3)
    this.ctx.lineTo(bounds.left - offsetDistance * 3, bounds.bottom + offsetDistance * 3)
    this.ctx.closePath()
    this.ctx.stroke()
  }

  draw(increment: number): void {
    //
  }
}
