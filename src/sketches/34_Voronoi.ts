import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type { BoundingBox, Cell, Diagram, Edge, HalfEdge, Site, Vertex } from '../Voronoi'
import { Voronoi } from '../Voronoi'
import { BooleanRange } from './tools/Range'

export default class VoronoiBoi extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutterX', {
      initialValue: 0,
      min: 0,
      max: this.cw / 2,
      step: 1,
    })
    this.addVar('gutterY', {
      initialValue: 0,
      min: 0,
      max: this.ch / 2,
      step: 1,
    })
    this.vs.linkGutter = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.addVar('points', {
      initialValue: 150,
      min: 0,
      max: 5000,
      step: 1,
    })
    this.addVar('loosenIterations', {
      initialValue: 2,
      min: 0,
      max: 250,
      step: 1,
    })
    this.addVar('loosenDistCutoff', {
      initialValue: 2,
      min: 0,
      max: 12,
      step: 0.1,
    })
    this.addVar('loosenStrength', {
      initialValue: 2,
      min: 1,
      max: 10,
      step: 0.001,
    })
    this.addVar('apoptosisMitosis', {
      initialValue: 0.1,
      min: 0.0001,
      max: 50,
      step: 0.0001,
    })
    this.vs.showDebugDots = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
  }

  voronoi: Voronoi
  diagram: Diagram | null = null
  boundingBox: BoundingBox = { left: 0, width: this.cw, top: 0, height: this.ch }
  sites: Site[]

  initDraw(): void {
    console.log('init draw called')
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
    this.voronoi = new Voronoi()
    this.diagram = null
    this.sites = []

    const { points, gutterX, gutterY: _gutterY, loosenIterations } = this.vars
    const linkGutter = !!this.vs.linkGutter.value
    const gutterY = linkGutter ? gutterX : _gutterY

    for (let i = 0; i < points; i++) {
      this.sites.push({
        x: gutterX + randFloatRange(this.cw - gutterX * 2),
        y: gutterY + randFloatRange(this.ch - gutterY * 2),
      })
    }

    this.compute(this.sites)

    for (let i = 0; i < loosenIterations; i++) {
      this.relaxSites()
    }

    this.render()
  }

  compute(sites: Site[]) {
    this.sites = sites
    this.voronoi.recycle(this.diagram)
    this.diagram = this.voronoi.compute(sites, this.boundingBox)
  }

  relaxSites() {
    if (!this.diagram) return

    const { apoptosisMitosis, loosenStrength, loosenDistCutoff } = this.vars

    const cells = this.diagram.cells
    const sites: Site[] = []
    let iCell = cells.length,
      site: Site,
      cell: Cell,
      again = false,
      dist: number

    const p = (1 / cells.length) * apoptosisMitosis
    while (iCell--) {
      const rand = randFloatRange(1)
      cell = cells[iCell]

      // probability of apoptosis
      if (rand < p) continue

      site = this.cellCentroid(cell)
      dist = Point.distance(site as Point, cell.site as Point)
      again = again || dist > 1

      // don't relax too fast
      if (dist > loosenDistCutoff) {
        site.x = site.x + (cell.site.x - site.x) / loosenStrength
        site.y = site.y + (cell.site.y - site.y) / loosenStrength
      }

      // probability of mitosis
      if (rand > 1 - p) {
        dist /= 2
        sites.push({
          x: site.x + (site.x - cell.site.x) / dist,
          y: site.y + (site.y - cell.site.y) / dist,
        })
      }
      sites.push(site)
    }
    this.compute(sites)
  }

  cellArea(cell: Cell) {
    const halfEdges = cell.halfEdges
    let area = 0,
      iHalfEdge = halfEdges.length,
      halfEdge: HalfEdge,
      p1: Vertex,
      p2: Vertex

    while (iHalfEdge--) {
      halfEdge = halfEdges[iHalfEdge]
      p1 = halfEdge.getStartPoint()
      p2 = halfEdge.getEndPoint()
      area += p1.x * p2.y
      area -= p1.y * p2.x
    }
    area /= 2
    return area
  }

  cellCentroid(cell: Cell) {
    const halfEdges = cell.halfEdges
    let x = 0,
      y = 0,
      iHalfEdge = halfEdges.length,
      halfEdge: HalfEdge,
      v: number,
      p1: Vertex,
      p2: Vertex

    while (iHalfEdge--) {
      halfEdge = halfEdges[iHalfEdge]
      p1 = halfEdge.getStartPoint()
      p2 = halfEdge.getEndPoint()
      v = p1.x * p2.y - p2.x * p1.y
      x += (p1.x + p2.x) * v
      y += (p1.y + p2.y) * v
    }
    v = this.cellArea(cell) * 6
    return { x: x / v, y: y / v }
  }

  render(): void {
    if (!this.diagram) return

    this.ctx.beginPath()
    const edges = this.diagram.edges
    let iEdge = edges.length
    let edge: Edge
    let v: Vertex
    while (iEdge--) {
      edge = edges[iEdge]
      v = edge.va
      this.ctx.moveTo(v.x, v.y)
      v = edge.vb
      this.ctx.lineTo(v.x, v.y)
    }
    this.ctx.stroke()
    this.ctx.closePath()

    if (this.vs.showDebugDots.value)
      this.sites.forEach((site) => debugDot(this.ctx, new Point(site.x, site.y)))
  }

  draw(increment: number): void {
    //
  }
}
