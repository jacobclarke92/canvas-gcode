import {
  deg1,
  deg2,
  deg2p5,
  deg5,
  deg10,
  deg30,
  deg90,
  deg180,
  deg270,
  deg360,
} from '../constants/angles'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { smallestSignedAngleDiff } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randBool, randFloat, randInt } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

class Quadrant {
  pts: Point[]
  constructor() {
    this.pts = []
  }
}

class Quadrants {
  quadrants: Quadrant[][]
  cols: number
  rows: number
  constructor({ size, width, height }: { size: number; width: number; height: number }) {
    this.quadrants = []
    this.cols = Math.ceil(width / size)
    this.rows = Math.ceil(height / size)
    for (let y = 0; y < this.rows; y++) {
      this.quadrants[y] = []
      for (let x = 0; x < this.cols; x++) {
        this.quadrants[y][x] = new Quadrant()
      }
    }
  }
  getQuadrantForPt(pt: Point): [quadrant: Quadrant | null, col: number, row: number] {
    const x = Math.floor(pt.x / this.cols)
    const y = Math.floor(pt.y / this.rows)
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return [null, x, y]
    return [this.quadrants[y][x], x, y]
  }
  registerPt(pt: Point) {
    const [q] = this.getQuadrantForPt(pt)
    if (q) q.pts.push(pt)
  }
  getPtsInQuadrantAndNeighbors(pt: Point) {
    const [q, col, row] = this.getQuadrantForPt(pt)
    if (!q) return []
    const pts: Point[] = [...q.pts]
    for (
      let rowOffset = Math.max(0, row - 1);
      rowOffset <= Math.min(this.rows, row + 1);
      rowOffset++
    ) {
      for (
        let colOffset = Math.max(0, col - 1);
        colOffset <= Math.min(this.cols, col + 1);
        colOffset++
      ) {
        if (colOffset === col && rowOffset === row) continue
        const neighborQ = this.quadrants[row + rowOffset]?.[col + colOffset]
        if (neighborQ) pts.push(...neighborQ.pts)
      }
    }
    return pts
  }
}

export default class Cranial extends Sketch {
  static sketchState: SketchState = 'unfinished'
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('seed', { name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('initialSpawns', { name: 'initialSpawns', initialValue: 3, min: 1, max: 12, step: 1 }) // prettier-ignore
    this.addVar('maxTurnDeg', { name: 'maxTurnDeg', initialValue: deg5, min: deg1, max: deg90, step: deg1 }) // prettier-ignore
    this.addVar('attractionForce', { name: 'attractionForce', initialValue: 0.5, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('repulsionForce', { name: 'repulsionForce', initialValue: 0.5, min: 0, max: 1, step: 0.01 }) // prettier-ignore
    this.addVar('visionRadius', { name: 'visionRadius', initialValue: 3, min: 0.1, max: 20, step: 0.1 }) // prettier-ignore
    // TODO: split after a certain number of points
  }

  mode: 'plan' | 'draw' = 'plan'
  quadrants: Quadrants | null = null
  lastPts: Point[] = []

  initDraw(): void {
    const { seed, visionRadius, initialSpawns } = this.vars
    seedRandom(seed)
    seedNoise(seed)

    this.mode = 'plan'
    this.quadrants = new Quadrants({
      size: visionRadius * 2,
      width: this.cw,
      height: this.ch,
    })
    this.lastPts = []

    const angleSeg = deg360 / initialSpawns
    const starterPts = 10
    for (let n = 1; n < starterPts + 1; n++) {
      for (let i = 0; i < initialSpawns; i++) {
        const angle = angleSeg * n
        const pt = new Point(this.cp.x + Math.cos(angle) * 1, this.cp.y + Math.sin(angle) * 1)
        this.quadrants.registerPt(pt)
        if (n === starterPts) this.lastPts.push(pt)
      }
    }

    /**
     * TODO:
     Will probably need to add another class for pts (Vectors?) to keep track of current heading
     Vectors should avoid other points within a smaller vision cone
     While also attracting to other points within a larger vision cone
     Aim is to make a brain-esque shape
     */
  }

  draw(): void {
    //
  }
}
