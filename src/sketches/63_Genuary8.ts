import { deg180, deg360 } from '../constants/angles'
import { colors, darkColors, mixColors, vaporDarkColors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import {
  circleOverlapsCircles,
  isInBounds,
  pointInCircle,
  pointInCircles,
} from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

const milli = 1000000

const tendrilToLines = (tendril: Point[]): Line[] => {
  const lines: Line[] = []
  for (let i = 0; i < tendril.length - 1; i++) {
    lines.push([tendril[i], tendril[i + 1]])
  }
  return lines
}

export default class Genuary8_Cosmos extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 128, min: 1, max: 256, step: 1 })
    this.addVar('skip', { initialValue: 1, min: 1, max: 512, step: 1 })
    this.addVar('startingPoints', { initialValue: 1, min: 1, max: 6, step: 1 })
    this.addVar('pointAvoidance', { initialValue: 1, min: 0, max: 1, step: 0.01 })
    this.addVar('pointAvoidanceMaxDist', { initialValue: 100, min: 20, max: 300, step: 0.1 })
    this.addVar('pointAvoidanceAmount', { initialValue: 10, min: 0, max: 50, step: 0.01 })
    this.addVar('progressDistanceInfluence', { initialValue: 10, min: 0.5, max: 50, step: 0.01 })
    this.addVar('progressAngleInfluence', { initialValue: 1, min: 0.5, max: 1.5, step: 0.01 })
    this.addVar('distanceFrameDiv', { initialValue: 7500, min: 1, max: 10000, step: 1 })
    this.addVar('inverseCenterPull', { initialValue: 1.9, min: 0.5, max: 20, step: 0.001 })
    this.addVar('progressPullPowInfluence', { initialValue: 1.5, min: -10, max: 10, step: 0.001 })
    this.addVar('perlinDiv', { initialValue: 25, min: 1, max: 100, step: 1 })
    this.addVar('perlinOffsetX', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('perlinOffsetY', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('perlinInfluence', { initialValue: 1, min: 0, max: 1, step: 0.05 })
    this.addVar('avoidRegions', { initialValue: 5, min: 0, max: 10, step: 1 })
    this.addVar('regionMinRadius', { initialValue: 4, min: 0, max: 100, step: 1 })
    this.addVar('regionMaxRadius', { initialValue: 30, min: 0, max: 100, step: 1 })
    this.addVar('regionRepelForce', { initialValue: 1, min: 0, max: 100, step: 0.1 })
    this.addVar('regionAvoidRadiusOffset', { initialValue: 1, min: 0.1, max: 2, step: 0.01 })

    this.vs.outputGCode = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.addAvoidToPosition = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.avoidCircleOverlap = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.debugColors = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  drawn = 0
  panic = 0
  avoidZones: [Point, number][] = []
  initialAngleOffset = 0

  pts: Point[] = []
  ptsStore: Point[][] = []
  doneGCode = false
  gCodePtsIndex = 0
  gCodePtIndex = 0

  initDraw(): void {
    const { seed, startingPoints, avoidRegions, regionMinRadius, regionMaxRadius } = this.vars
    seedRandom(seed)
    seedNoise(seed)
    initPen(this)
    // Challenge: Draw a million of something

    this.drawn = 0
    this.panic = 0
    this.pts = []
    this.ptsStore = []
    this.doneGCode = false
    this.gCodePtsIndex = 0
    this.gCodePtIndex = 0

    // Initialize starting points
    this.initialAngleOffset = deg360 / startingPoints
    for (let i = 0; i < startingPoints; i++) {
      this.pts.push(new Point(this.cw / 2, this.ch / 2))
      this.ptsStore.push([])
    }

    // Initialize avoid zones
    this.avoidZones = []
    let panic = 0
    while (this.avoidZones.length < avoidRegions) {
      const radius = regionMinRadius + randFloatRange(regionMaxRadius - regionMinRadius)
      const pt = new Point(
        radius + randFloatRange(this.cw - radius * 2),
        radius + randFloatRange(this.ch - radius * 2)
      )
      if (
        this.vs.avoidCircleOverlap.value &&
        circleOverlapsCircles([pt, radius], ...this.avoidZones)
      ) {
        panic++
        if (panic > 1000) break
        else continue
      }
      this.avoidZones.push([pt, radius])
    }

    // this.avoidZones.forEach(([pt, radius]) => this.ctx.strokeCircle(pt.x, pt.y, radius))
    // this.ctx.dot(this.cw / 2, this.ch / 2)
    // this.ctx.dot(this.cw / 2 + 10, this.ch / 2)
    // this.ctx.dot(this.cw / 2 + 10, this.ch / 2 + 10)
    // this.ctx.dot(this.cw / 2, this.ch / 2 + 10)
    // this.ctx.stroke()
  }

  doGCode(): void {
    if (!this.vs.outputGCode.value) return
    for (let i = 0; i < 50; i++) {
      if (this.doneGCode) return
      const pts = this.ptsStore[this.gCodePtsIndex]
      const pt = pts[this.gCodePtIndex]

      this.gCodePtIndex++
      if (this.gCodePtIndex >= pts.length) {
        this.gCodePtsIndex++
        this.gCodePtIndex = 0

        if (this.gCodePtsIndex >= this.ptsStore.length) {
          this.doneGCode = true
          return
        } else {
          this.ctx.driver.comment(`Color ${this.gCodePtsIndex + 1}`, true)
        }
      }

      this.ctx.motion.rapid({ x: pt.x, y: pt.y })
      this.ctx.motion.plunge()
      this.ctx.motion.retract()
    }
  }

  draw(increment: number): void {
    //
    const {
      skip,
      startingPoints,
      pointAvoidance,
      pointAvoidanceAmount,
      pointAvoidanceMaxDist,
      progressDistanceInfluence,
      progressAngleInfluence,
      distanceFrameDiv,
      inverseCenterPull,
      progressPullPowInfluence,
      perlinDiv,
      perlinOffsetX,
      perlinOffsetY,
      perlinInfluence,
      regionRepelForce,
      regionAvoidRadiusOffset,
    } = this.vars

    let frame = increment * this.vars.speedUp
    if (this.drawn > milli || this.panic > 100000) {
      this.doGCode()
      return
    }
    if (increment % 1000 === 0) document.title = `Genuary 8: ${increment * this.vars.speedUp}`
    for (let i = 0; i < this.vars.speedUp; i++) {
      const progress = this.drawn / milli
      frame++
      if (this.drawn > milli) break

      for (let m = 0; m < this.pts.length; m++) {
        const pt = this.pts[m]

        // Calculate angle that we want the point to move in
        const angleOffset = this.initialAngleOffset * m
        const angle =
          startingPoints === 1
            ? angleOffset + frame / 4 / (1 - progress)
            : angleOffset + Math.cos(frame / 4 / ((1 - progress) / progressAngleInfluence))

        // Calculate the distance which we want the point to move
        const relativeFrameForce = frame / distanceFrameDiv

        // Move the point
        pt.add(
          Math.cos(angle) * (relativeFrameForce / ((1 - progress) * progressDistanceInfluence)),
          Math.sin(angle) * (relativeFrameForce / ((1 - progress) * progressDistanceInfluence))
        )

        // Apply the 'pull to center' force
        pt.add(
          (this.cp.x - pt.x) /
            (inverseCenterPull * Math.pow(1 - progress, progressPullPowInfluence * (1 - progress))),
          (this.cp.y - pt.y) /
            (inverseCenterPull * Math.pow(1 - progress, progressPullPowInfluence * (1 - progress)))
        )

        if (frame % skip !== 0) continue

        // Apply point avoidance forces
        if (pointAvoidance > 0) {
          for (let n = m + 1; n < this.pts.length; n++) {
            const otherPt = this.pts[n]
            const dist = pt.distanceTo(otherPt)
            if (dist < 50) {
              const avoidForce =
                ((pointAvoidanceMaxDist - dist) / pointAvoidanceMaxDist) *
                pointAvoidanceAmount *
                pointAvoidance
              pt.moveAway(otherPt, avoidForce)
              otherPt.moveAway(pt, avoidForce)
            }
          }
        }

        // Apply perlin noise
        const actualPos = pt.clone()
        if (perlinInfluence > 0) {
          const theta = perlin2(
            (pt.x + perlinOffsetX) / perlinDiv,
            (pt.y + perlinOffsetY) / perlinDiv
          )
          actualPos.moveAlongAngle(theta * deg360, theta * 10 * perlinInfluence)
        }

        // Check that the point is actually in bounds
        if (isInBounds(actualPos, [0, this.cw, this.ch, 0])) {
          this.panic = 0

          // Apply region avoidance forces
          for (const [pt, radius] of this.avoidZones) {
            if (!pointInCircle(actualPos, pt, radius)) continue
            const proximityToCenter =
              (radius * regionAvoidRadiusOffset - pt.distanceTo(actualPos)) / radius
            // const extraForce = (radius - regionMinRadius) / (regionMaxRadius - regionMinRadius)
            actualPos.moveAway(pt, regionRepelForce * proximityToCenter)
            if (this.vs.addAvoidToPosition.value) {
              pt.moveAway(pt, regionRepelForce * proximityToCenter)
            }
          }

          // Draw pixel and store it for later GCode generation
          this.ctx.ctx.beginPath()
          this.ptsStore[m].push(actualPos.clone())
          this.ctx.dot(...actualPos.toArray(), {
            drawSize: 0.25,
            pauseMs: 0,
            color: vaporDarkColors[m % vaporDarkColors.length],
          })
          this.drawn++
        } else {
          this.panic++
          if (this.panic > 100000) {
            console.log('panic at', this.drawn)

            break
          }
        }
      }
    }
  }
}
