import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type { BoundingBox, Cell, Diagram, Edge, HalfEdge, Site, Vertex } from '../Voronoi'
import { Voronoi } from '../Voronoi'

export default class VoronoiBoi extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('seed', {
      initialValue: 3975,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 0,
      min: 0,
      max: 120,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('points', {
      initialValue: 150,
      min: 0,
      max: 5000,
      step: 1,
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

    const { points, gutter } = this.vars
    for (let i = 0; i < points; i++) {
      this.sites.push({
        x: gutter + randFloatRange(this.cw - gutter * 2),
        y: gutter + randFloatRange(this.ch - gutter * 2),
      })
    }

    this.compute(this.sites)

    // setInterval(() => this.relaxSites(), 100)
  }

  /*
relaxSites() {
    if (!this.diagram) return
    var cells = this.diagram.cells,
        iCell = cells.length,
        cell,
        site, sites = [],
        again = false,
        rn, dist;
    var p = 1 / iCell * 0.1;
    while (iCell--) {
        cell = cells[iCell];
        rn = Math.random();
        // probability of apoptosis
        if (rn < p) {
            continue;
            }
        site = this.cellCentroid(cell);
        dist = this.distance(site, cell.site);
        again = again || dist > 1;
        // don't relax too fast
        if (dist > 2) {
            site.x = (site.x+cell.site.x)/2;
            site.y = (site.y+cell.site.y)/2;
            }
        // probability of mytosis
        if (rn > (1-p)) {
            dist /= 2;
            sites.push({
                x: site.x+(site.x-cell.site.x)/dist,
                y: site.y+(site.y-cell.site.y)/dist,
                });
            }
        sites.push(site);
        }
    this.compute(sites);
    if (again) {
        var me = this;
        this.timeout = setTimeout(function(){
            me.relaxSites();
            }, this.timeoutDelay);
    }
}
*/

  /*
  distance(a, b) {
    var dx = a.x-b.x,
        dy = a.y-b.y;
    return Math.sqrt(dx*dx+dy*dy);
  }
  */

  /*
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
*/

  /*
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
*/

  compute(sites: Site[]) {
    this.sites = sites
    this.voronoi.recycle(this.diagram)
    this.diagram = this.voronoi.compute(sites, this.boundingBox)

    this.render()
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

    // this.sites.forEach((site) => debugDot(this.ctx, new Point(site.x, site.y)))
  }

  draw(increment: number): void {
    //
  }
}
