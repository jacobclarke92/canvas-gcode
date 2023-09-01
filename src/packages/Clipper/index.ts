/*******************************************************************************
 *                                                                              *
 * Author    :  Angus Johnson                                                   *
 * Version   :  6.4.2                                                           *
 * Date      :  27 February 2017                                                *
 * Website   :  http://www.angusj.com                                           *
 * Copyright :  Angus Johnson 2010-2017                                         *
 *                                                                              *
 * License:                                                                     *
 * Use, modification & distribution is subject to Boost Software License Ver 1. *
 * http://www.boost.org/LICENSE_1_0.txt                                         *
 *                                                                              *
 * Attributions:                                                                *
 * The code in this library is an extension of Bala Vatti's clipping algorithm: *
 * "A generic solution to polygon clipping"                                     *
 * Communications of the ACM, Vol 35, Issue 7 (July 1992) pp 56-63.             *
 * http://portal.acm.org/citation.cfm?id=129906                                 *
 *                                                                              *
 * Computer graphics and geometric modeling: implementation and algorithms      *
 * By Max K. Agoston                                                            *
 * Springer; 1 edition (January 4, 2005)                                        *
 * http://books.google.com/books?q=vatti+clipping+agoston                       *
 *                                                                              *
 * See also:                                                                    *
 * "Polygon Offsetting by Computing Winding Numbers"                            *
 * Paper no. DETC2005-85513 pp. 565-575                                         *
 * ASME 2005 International Design Engineering Technical Conferences             *
 * and Computers and Information in Engineering Conference (IDETC/CIE2005)      *
 * September 24-28, 2005 , Long Beach, California, USA                          *
 * http://www.me.berkeley.edu/~mcmains/pubs/DAC05OffsetPolygon.pdf              *
 *                                                                              *
 *******************************************************************************/
/*******************************************************************************
 *                                                                              *
 * Author    :  Timo                                                            *
 * Version   :  6.4.2.2                                                         *
 * Date      :  8 September 2017                                                 *
 *                                                                              *
 * This is a translation of the C# Clipper library to Javascript.               *
 * Int128 struct of C# is implemented using JSBN of Tom Wu.                     *
 * Because Javascript lacks support for 64-bit integers, the space              *
 * is a little more restricted than in C# version.                              *
 *                                                                              *
 * C# version has support for coordinate space:                                 *
 * +-4611686018427387903 ( sqrt(2^127 -1)/2 )                                   *
 * while Javascript version has support for space:                              *
 * +-4503599627370495 ( sqrt(2^106 -1)/2 )                                      *
 *                                                                              *
 * Tom Wu's JSBN proved to be the fastest big integer library:                  *
 * http://jsperf.com/big-integer-library-test                                   *
 *                                                                              *
 * This class can be made simpler when (if ever) 64-bit integer support comes   *
 * or floating point Clipper is released.                                       *
 *                                                                              *
 *******************************************************************************/
/*******************************************************************************
 *                                                                              *
 * Basic JavaScript BN library - subset useful for RSA encryption.              *
 * http://www-cs-students.stanford.edu/~tjw/jsbn/                               *
 * Copyright (c) 2005  Tom Wu                                                   *
 * All Rights Reserved.                                                         *
 * See "LICENSE" for details:                                                   *
 * http://www-cs-students.stanford.edu/~tjw/jsbn/LICENSE                        *
 *                                                                              *
 *******************************************************************************/

import { browser } from './browser'
import { Clipper } from './Clipper'
import { ClipperBase } from './ClipperBase'
import { ClipperOffset } from './ClipperOffset'
import { DoublePoint } from './DoublePoint'
import { Edge } from './Edge'
import { ClipType, Direction, EdgeSide, EndType, JoinType, PolyFillType, PolyType } from './enums'
import { IntersectNode, MyIntersectNodeSort } from './IntersectNode'
import { IntPoint } from './IntPoint'
import { IntRectangle } from './IntRectangle'
import { Join, LocalMinimum, Maxima, OuterPoint, OuterRectangle, Scanbeam } from './Misc'
import { Path, Paths } from './Path'
import { PolygonNode, PolygonTree } from './PolygonNode'

// ---------------------------------------------

// JS extension by Timo 2013
// ClipperLib.JS = {}

export const areaOfPolygon = (polygon: Path, scale?: number) =>
  typeof scale !== 'number' ? 1 : Clipper.area(polygon) / (scale * scale)

export const areaOfPolygons = (polygons: Paths, scale?: number) =>
  typeof scale !== 'number' ? 0 : polygons.reduce((area, polygon) => area + areaOfPolygon(polygon, scale), 0)

export const boundsOfPath = (path: Path, scale?: number) => boundsOfPaths([path], scale)

export const boundsOfPaths = (paths: Paths, scale?: number) => {
  if (!scale) scale = 1
  const bounds = Clipper.getBounds(paths)
  bounds.left /= scale
  bounds.bottom /= scale
  bounds.right /= scale
  bounds.top /= scale
  return bounds
}

// Clean() joins vertices that are too near each other
// and causes distortion to offsetted polygons without cleaning
export function clean(polygonOrPolygons: Path): Path
export function clean(polygonOrPolygons: Paths): Paths
export function clean(polygonOrPolygons: Path | Paths, delta?: number) {
  if (typeof delta !== 'number') throw new Error('Delta is not a number in Clean().')
  if (!(polygonOrPolygons instanceof Array)) throw new Error('Polygon is not a Path in Clean().')
  const isPolygons = polygonOrPolygons[0] instanceof Array
  const polygons = isPolygons ? clone(polygonOrPolygons as Paths) : new Paths([clone(polygonOrPolygons as Path)])
  if (polygons.length === 0 || (polygons.length === 1 && polygons[0].length === 0) || delta < 0)
    return polygonOrPolygons

  let len: number, poly: Path, result: Path, d: number, p: IntPoint, j: number, i: number
  const results = new Paths()
  for (let k = 0; k < polygons.length; k++) {
    poly = polygons[k]
    len = poly.length
    if (len === 0) continue
    else if (len < 3) {
      result = poly
      results.push(result)
      continue
    }
    result = poly
    d = delta * delta
    // d = Math.floor(c_delta * c_delta);
    p = poly[0]
    j = 1
    for (i = 1; i < len; i++) {
      if ((poly[i].x - p.x) * (poly[i].x - p.x) + (poly[i].y - p.y) * (poly[i].y - p.y) <= d) continue
      result[j] = poly[i]
      p = poly[i]
      j++
    }
    p = poly[j - 1]
    if ((poly[0].x - p.x) * (poly[0].x - p.x) + (poly[0].y - p.y) * (poly[0].y - p.y) <= d) j--
    if (j < len) result.splice(j, len - j)
    if (result.length) results.push(result)
  }
  if (!isPolygons) return results[0]
  return results
}

// Make deep copy of Polygons or Polygon
// so that also IntPoint objects are cloned and not only referenced
// This should be the fastest way

export function clone(polygonOrPolygons: Path): Path
export function clone(polygonOrPolygons: Paths): Paths
export function clone(polygonOrPolygons: Paths | Path) {
  if (!(polygonOrPolygons instanceof Array)) throw new Error('clone() only works with Path or Paths.')
  if (polygonOrPolygons.length === 0) return new Path()
  const isPolygons = polygonOrPolygons[0] instanceof Array
  const polygons = isPolygons ? (polygonOrPolygons as Paths) : new Paths([polygonOrPolygons as Path])
  if (polygons.length === 1 && polygons[0].length === 0) return new Paths()
  let polygonPathLength: number, result: Path

  const results = new Paths(polygons.length)
  for (let i = 0; i < polygons.length; i++) {
    polygonPathLength = polygons[i].length
    result = new Path(polygonPathLength)
    for (let j = 0; j < polygonPathLength; j++) {
      result[j] = new IntPoint(polygons[i][j].x, polygons[i][j].y)
    }
    results[i] = result
  }
  if (!isPolygons) return results[0]
  return results
}

// Removes points that doesn't affect much to the visual appearance.
// If middle point is at or under certain distance (tolerance) of the line segment between
// start and end point, the middle point is removed.
export function lighten(polygon: Path, tolerance: number): Path
export function lighten(polygons: Paths, tolerance: number): Paths
export function lighten(polygonOrPolygons: Path | Paths, tolerance: number) {
  if (!(polygonOrPolygons instanceof Array)) throw new Error('lighten provided neither Path or Paths')
  if (typeof tolerance !== 'number') throw new Error('Tolerance is not a number in Lighten().')
  if (polygonOrPolygons.length === 0) return new Path()
  const isPolygons = polygonOrPolygons[0] instanceof Array
  const polygons = isPolygons ? (polygonOrPolygons as Paths) : new Paths([polygonOrPolygons as Path])
  if (polygons.length === 1 && polygons[0].length === 0) return new Paths()

  let i: number,
    j: number,
    polygon: Path,
    k: number,
    polygon2: Path,
    pLen: number,
    A: IntPoint,
    B: IntPoint,
    P: IntPoint,
    d: number,
    rem: number[],
    addLast: number
  let bxax: number, byay: number, l: number, ax: number, ay: number
  const len = polygons.length
  const toleranceSq = tolerance * tolerance
  const results = new Paths()
  for (i = 0; i < len; i++) {
    polygon = polygons[i]
    pLen = polygon.length
    if (pLen === 0) continue
    for (
      k = 0;
      k < 1000000;
      k++ // could be forever loop, but wiser to restrict max repeat count
    ) {
      polygon2 = new Path()
      pLen = polygon.length
      // the first have to added to the end, if first and last are not the same
      // this way we ensure that also the actual last point can be removed if needed
      if (polygon[pLen - 1].x !== polygon[0].x || polygon[pLen - 1].y !== polygon[0].y) {
        addLast = 1
        polygon.push({
          X: polygon[0].x,
          Y: polygon[0].y,
        })
        pLen = polygon.length
      } else addLast = 0
      rem = [] // Indexes of removed points
      for (j = 0; j < pLen - 2; j++) {
        A = polygon[j] // Start point of line segment
        P = polygon[j + 1] // Middle point. This is the one to be removed.
        B = polygon[j + 2] // End point of line segment
        ax = A.x
        ay = A.y
        bxax = B.x - ax
        byay = B.y - ay
        if (bxax !== 0 || byay !== 0) {
          // To avoid Nan, when A==P && P==B. And to avoid peaks (A==B && A!=P), which have lenght, but not area.
          l = ((P.x - ax) * bxax + (P.y - ay) * byay) / (bxax * bxax + byay * byay)
          if (l > 1) {
            ax = B.x
            ay = B.y
          } else if (l > 0) {
            ax += bxax * l
            ay += byay * l
          }
        }
        bxax = P.x - ax
        byay = P.y - ay
        d = bxax * bxax + byay * byay
        if (d <= toleranceSq) {
          rem[j + 1] = 1
          j++ // when removed, transfer the pointer to the next one
        }
      }
      // add all unremoved points to poly2
      polygon2.push(new IntPoint(polygon[0].x, polygon[0].y))
      for (j = 1; j < pLen - 1; j++) if (!rem[j]) polygon2.push(new IntPoint(polygon[j].x, polygon[j].y))
      polygon2.push(new IntPoint(polygon[pLen - 1].x, polygon[pLen - 1].y))
      // if the first point was added to the end, remove it
      if (addLast) polygon.pop()
      // break, if there was not anymore removed points
      if (!rem.length) break
      // else continue looping using poly2, to check if there are points to remove
      else polygon = polygon2
    }
    pLen = polygon2.length
    // remove duplicate from end, if needed
    if (polygon2[pLen - 1].x === polygon2[0].x && polygon2[pLen - 1].y === polygon2[0].y) {
      polygon2.pop()
    }
    if (polygon2.length > 2)
      // to avoid two-point-polygons
      results.push(polygon2)
  }
  if (!isPolygons) results[0]
  return results
}

export function perimeterOfPath(path: Path, closed: boolean, scale?: number) {
  if (typeof path === 'undefined') return 0
  const sqrt = Math.sqrt
  let perimeter = 0.0
  let p1: IntPoint,
    p2: IntPoint,
    p1x = 0.0,
    p1y = 0.0,
    p2x = 0.0,
    p2y = 0.0
  let j = path.length
  if (j < 2) return 0
  if (closed) {
    path[j] = path[0]
    j++
  }
  while (--j) {
    p1 = path[j]
    p1x = p1.x
    p1y = p1.y
    p2 = path[j - 1]
    p2x = p2.x
    p2y = p2.y
    perimeter += sqrt((p1x - p2x) * (p1x - p2x) + (p1y - p2y) * (p1y - p2y))
  }
  if (closed) path.pop()
  return perimeter / scale
}

export function perimeterOfPaths(paths: Paths, closed: boolean, scale = 1) {
  let perimeter = 0
  for (let i = 0; i < paths.length; i++) {
    perimeter += perimeterOfPath(paths[i], closed, scale)
  }
  return perimeter
}

export function scaleDownPath(path: Path, scale = 1) {
  let i: number, p: IntPoint
  i = path.length
  while (i--) {
    p = path[i]
    p.x = p.x / scale
    p.y = p.y / scale
  }
}

export function scaleDownPaths(paths: Paths, scale = 1) {
  let i: number, j: number, p: IntPoint
  i = paths.length
  while (i--) {
    j = paths[i].length
    while (j--) {
      p = paths[i][j]
      p.x = p.x / scale
      p.y = p.y / scale
    }
  }
}

export function scaleUpPath(path: Path, scale = 1) {
  let i: number, p: IntPoint
  i = path.length
  while (i--) {
    p = path[i]
    p.x = Math.round(p.x * scale)
    p.y = Math.round(p.y * scale)
  }
}

export function scaleUpPaths(paths: Paths, scale = 1) {
  let i: number, j: number, p: IntPoint
  i = paths.length
  while (i--) {
    j = paths[i].length
    while (j--) {
      p = paths[i][j]
      p.x = Math.round(p.x * scale)
      p.y = Math.round(p.y * scale)
    }
  }
}

/*
ClipperLib.ExPolygons = () => {
  return []
}

ClipperLib.ExPolygon = () => {
  this.outer = null
  this.holes = null
}

export function AddOuterPolyNodeToExPolygons(polynode, expolygons) {
  const ep = new ClipperLib.ExPolygon()
  ep.outer = polynode.Contour()
  const childs = polynode.Childs()
  const ilen = childs.length
  ep.holes = new Array(ilen)
  let node, n, i, j, childs2, jlen
  for (i = 0; i < ilen; i++) {
    node = childs[i]
    ep.holes[i] = node.Contour()
    //Add outer polygons contained by (nested within) holes ...
    for (j = 0, childs2 = node.Childs(), jlen = childs2.length; j < jlen; j++) {
      n = childs2[j]
      export function AddOuterPolyNodeToExPolygons expoly )
    }
  }
  expolygons.push(ep)
}

export function ExPolygonsToPaths(expolygons) {
  let a, i, alen, ilen
  const paths = new ClipperLib.Paths()
  for (a = 0, alen = expolygons.length; a < alen; a++) {
    paths.push(expolygons[a].outer)
    for (i = 0, ilen = expolygons[a].holes.length; i < ilen; i++) {
      paths.push(expolygons[a].holes[i])
    }
  }
  return paths
}
export function PolyTreeToExPolygons(polytree) {
  const expolygons = new ClipperLib.ExPolygons()
  let node, i, childs, ilen
  for (i = 0, childs = polytree.Childs(), ilen = childs.length; i < ilen; i++) {
    node = childs[i]
    export function AddOuterPolyNodeToExPolygonsde, expoly )
  }
  return expolygons
}
*/

export const ClipperLib = {
  use_lines: true,
  USE_XYZ: false,
  Path,
  Paths,
  DoublePoint,
  PolygonNode,
  PolygonTree,
  mathAbsInt64: (a: number) => Math.abs(a),
  mathAbsInt32: (a: number) => Math.abs(a),
  mathAbsDouble: (a: number) => Math.abs(a),
  mathMaxInt32Int32: (a: number, b: number) => Math.max(a, b),
  // http://jsperf.com/truncate-float-to-integer/2
  castInt32: (a: number) => (browser.msie || browser.opera || browser.safari ? a | 0 : ~~a),
  PI: 3.141592653589793,
  PI2: 2 * 3.141592653589793,
  clear: <T extends Array<any>>(a: T) => {
    a.length = 0
  },
  // Jacob: This originally had a bunch of browser specific optimizations but i just opted for the chrome one
  // http://jsperf.com/truncate-float-to-integer
  castInt64: (a: number) => {
    if (a < -2147483648 || a > 2147483647) return a < 0 ? Math.ceil(a) : Math.floor(a)
    else return ~~a
  },
  IntPoint,
  IntRectangle,
  ClipType,
  PolyType,
  PolyFillType,
  JoinType,
  EndType,
  EdgeSide,
  Direction,
  Edge,
  IntersectNode,
  MyIntersectNodeSort,
  LocalMinimum,
  Scanbeam,
  Maxima,
  OuterRectangle,
  OuterPoint,
  Join,
  ClipperBase,
  Clipper,
  ClipperOffset,
  JS: {
    areaOfPolygon,
    areaOfPolygons,
    boundsOfPath,
    boundsOfPaths,
    clean,
    clone,
    lighten,
    perimeterOfPath,
    perimeterOfPaths,
    scaleDownPath,
    scaleDownPaths,
    scaleUpPath,
    scaleUpPaths,
  },
}

export default ClipperLib
