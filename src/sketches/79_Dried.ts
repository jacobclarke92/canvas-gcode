import { deg2, deg10, deg30, deg90, deg180, deg270, deg360 } from '../constants/angles'
import type GCanvas from '../GCanvas'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'

export default class Dried extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('gridSize', { name: 'gridSize', initialValue: 1, min: 0.1, max: 25, step: 0.1 })
    this.addVar('rule', { name: 'rule', initialValue: 30, min: 0, max: 255, step: 1 })
  }

  prevAngles: number[] = []
  initDraw(): void {
    seedRandom(this.vars.seed)
    seedNoise(this.vars.seed)
    this.prevAngles = []
    const { gridSize, gutter, rule } = this.vars
    for (let i = 0; i < 10; i++) {
      this.drawStem()
    }
  }

  getLeafPts(pt: Point, initialAngle: number, size: number): [Point[], Point] {
    const midPt = pt.clone().moveAlongAngle(initialAngle, size)
    const pts: Point[] = [pt.clone()]
    const numPts = 36
    let angle = initialAngle + deg180
    for (let i = 0; i < numPts; i++) {
      angle += deg360 / numPts
      const dist = size + Math.abs(Math.sin((i / numPts) * deg360)) * (size * 2)
      pts.push(midPt.clone().moveAlongAngle(angle, dist))
    }
    return [pts, midPt]
  }

  drawStem() {
    let pt = new Point(this.cw / 2, this.ch - this.vars.gutter)
    let angle = randFloatRange(deg270 + deg30, deg270 - deg30)
    let panik = 0
    while (
      ++panik < 500 &&
      this.prevAngles.filter((a) => Math.abs(smallestSignedAngleDiff(a, angle)) < deg10).length > 0
    )
      randFloatRange(deg270 + deg30, deg270 - deg30)
    if (panik > 499) return
    this.prevAngles.push(angle)
    const angleStep = randFloatRange(deg2, -deg2)
    for (let i = 0; i < 15; i++) {
      const stemLength = randFloatRange(10, 7)
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y)
      pt.moveAlongAngle(angle, stemLength)
      this.ctx.lineTo(pt.x, pt.y)
      this.ctx.stroke()

      const [leafPts, midPt] = this.getLeafPts(pt, angle, 1 + (i / 15) * 2)
      this.ctx.beginPath()
      this.ctx.moveTo(pt.x, pt.y)
      this.ctx.strokePath(leafPts as IntPoint[])

      pt = midPt

      angle += angleStep
    }
  }

  draw(): void {
    //
  }
}
