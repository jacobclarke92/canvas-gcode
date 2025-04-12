import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { relaxSites, sortEdges } from '../utils/voronoiUtils'
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
    // plotBounds(this)

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
      const sites = relaxSites({
        diagram: this.diagram,
        apoptosisMitosis: this.vars.apoptosisMitosis,
        loosenStrength: this.vars.loosenStrength,
        loosenDistCutoff: this.vars.loosenDistCutoff,
      })
      this.compute(sites)
    }

    this.render()

    penUp(this)
  }

  compute(sites: Site[]) {
    this.sites = sites
    this.voronoi.recycle(this.diagram)
    this.diagram = this.voronoi.compute(sites, this.boundingBox)
  }

  iEdge = 0
  edges: Edge[] = []
  render(): void {
    if (!this.diagram) return

    this.edges = sortEdges(this.diagram.edges)
    this.iEdge = this.edges.length
    let edge: Edge
    this.ctx.beginPath()
    while (this.iEdge--) {
      edge = this.edges[this.iEdge]
      this.ctx.moveTo(edge.vertex1.x, edge.vertex1.y)
      this.ctx.lineTo(edge.vertex2.x, edge.vertex2.y)
    }
    this.ctx.stroke()
    this.ctx.endPath()

    if (this.vs.showDebugDots.value)
      this.sites.forEach((site) => debugDot(this.ctx, new Point(site.x, site.y)))
  }

  // draw(increment: number): void {
  //   if (increment % 50 !== 0) return
  //   //
  //   this.iEdge--
  //   if (this.iEdge < 0) return

  //   const edge = this.edges[this.iEdge]
  //   if (!edge) return
  //   this.ctx.beginPath()
  //   this.ctx.moveTo(edge.vertex1.x, edge.vertex1.y)
  //   this.ctx.lineTo(edge.vertex2.x, edge.vertex2.y)
  //   this.ctx.stroke()
  //   this.ctx.closePath()
  // }
}
