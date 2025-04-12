import Point from '../Point'
import type { Cell, Diagram, Edge, HalfEdge, Site, Vertex } from '../Voronoi'
import { randFloatRange } from './numberUtils'

export const sortEdges = (edges: Edge[]): Edge[] => {
  // Create a graph representation
  const graph = new Map<Vertex, Set<Edge>>()

  for (const edge of edges) {
    if (!graph.has(edge.vertex1)) graph.set(edge.vertex1, new Set())
    if (!graph.has(edge.vertex2)) graph.set(edge.vertex2, new Set())
    graph.get(edge.vertex1)!.add(edge)
    graph.get(edge.vertex2)!.add(edge)
  }

  const sortedEdges: Edge[] = []
  const visited = new Set<Edge>()

  function dfs(currentVertex: Vertex) {
    const adjacentEdges = graph.get(currentVertex)!
    for (const edge of adjacentEdges) {
      if (!visited.has(edge)) {
        visited.add(edge)
        sortedEdges.push(edge)
        const nextVertex = edge.vertex1 === currentVertex ? edge.vertex2 : edge.vertex1
        dfs(nextVertex)
      }
    }
  }

  // Start DFS from the first vertex of the first edge
  if (edges.length > 0) {
    dfs(edges[0].vertex1)
  }

  // Handle any disconnected components
  for (const edge of edges) {
    if (!visited.has(edge)) {
      visited.add(edge)
      sortedEdges.push(edge)
      dfs(edge.vertex1)
      dfs(edge.vertex2)
    }
  }

  return sortedEdges
}

export const relaxSites = ({
  diagram,
  apoptosisMitosis,
  loosenStrength,
  loosenDistCutoff,
}: {
  diagram: Diagram
  apoptosisMitosis: number
  loosenStrength: number
  loosenDistCutoff: number
}) => {
  const cells = diagram.cells
  const sites: Site[] = []
  let iCell = cells.length,
    site: Site,
    cell: Cell,
    again = false,
    dist: number

  console.log('cells', cells.length)

  const p = (1 / cells.length) * apoptosisMitosis
  while (iCell--) {
    const rand = randFloatRange(1)
    cell = cells[iCell]

    // probability of apoptosis
    if (rand < p) continue

    site = cellCentroid(cell)
    dist = Point.distance(site as Point, cell.site as Point)
    again = again || dist > 1

    if (isNaN(dist)) {
      console.error('dist', dist, site, cell.site)
      continue
    }

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

  return sites
}

export const cellArea = (cell: Cell) => {
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

export const cellCentroid = (cell: Cell) => {
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
  v = cellArea(cell) * 6

  if (v === 0) {
    console.error('v', v, cell)
    return { x: 0, y: 0 }
  }

  return { x: x / v, y: y / v }
}
