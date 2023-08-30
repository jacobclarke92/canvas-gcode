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

import { Clipper } from './Clipper'
import { ClipperBase } from './ClipperBase'
import { ClipperOffset } from './ClipperOffset'
import { DoublePoint } from './DoublePoint'
import { ClipType, Direction, EdgeSide, EndType, JoinType, PolyFillType, PolyType } from './enums'
import { IntersectNode, MyIntersectNodeSort } from './IntersectNode'
import { IntPoint } from './IntPoint'
import { IntRect } from './IntRect'
import { Join, LocalMinima, Maxima, OutPt, OutRec, Scanbeam } from './Misc'
import { Path, Paths } from './Path'
import { PolyNode, PolyTree } from './PolyNode'
import { TEdge } from './TEdge'

// UseLines: Enables open path clipping. Adds a very minor cost to performance.
const USE_LINES = true

// ClipperLib.use_xyz: adds a Z member to IntPoint. Adds a minor cost to performance.
const USE_XYZ = false

// Browser test to speedup performance critical functions
const nav = navigator.userAgent.toString().toLowerCase()
const browser = {
  chrome: nav.indexOf('chrome') != -1 && nav.indexOf('chromium') == -1,
  chromium: nav.indexOf('chromium') != -1,
  safari: nav.indexOf('safari') != -1 && nav.indexOf('chrome') == -1 && nav.indexOf('chromium') == -1,
  firefox: nav.indexOf('firefox') != -1,
  firefox17: nav.indexOf('firefox/17') != -1,
  firefox15: nav.indexOf('firefox/15') != -1,
  firefox3: nav.indexOf('firefox/3') != -1,
  opera: nav.indexOf('opera') != -1,
  msie10: nav.indexOf('msie 10') != -1,
  msie9: nav.indexOf('msie 9') != -1,
  msie8: nav.indexOf('msie 8') != -1,
  msie7: nav.indexOf('msie 7') != -1,
  msie: nav.indexOf('msie ') != -1,
} as const

export const ClipperLib = {
  use_lines: USE_LINES,
  use_xyz: USE_XYZ,
  Path,
  Paths,
  DoublePoint,
  PolyNode,
  PolyTree,
  Math_Abs_Int64: (a: number) => Math.abs(a),
  Math_Abs_Int32: (a: number) => Math.abs(a),
  Math_Abs_Double: (a: number) => Math.abs(a),
  Math_Max_Int32_Int32: (a: number, b: number) => Math.max(a, b),
  // http://jsperf.com/truncate-float-to-integer/2
  Cast_Int32: (a: number) => (browser.msie || browser.opera || browser.safari ? a | 0 : ~~a),
  PI: 3.141592653589793,
  PI2: 2 * 3.141592653589793,
  Clear: (a: dunnoyet) => {
    a.length = 0
  },
  // This originally had a bunch of browser specific optimizations but i just opted for the chrome one
  // http://jsperf.com/truncate-float-to-integer
  Cast_Int64: (a: number) => {
    if (a < -2147483648 || a > 2147483647) return a < 0 ? Math.ceil(a) : Math.floor(a)
    else return ~~a
  },
  IntPoint,
  IntRect,
  ClipType,
  PolyType,
  PolyFillType,
  JoinType,
  EndType,
  EdgeSide,
  Direction,
  TEdge,
  IntersectNode,
  MyIntersectNodeSort,
  LocalMinima,
  Scanbeam,
  Maxima,
  OutRec,
  OutPt,
  Join,
  ClipperBase,
  Clipper,
  ClipperOffset,
  Error: (message: string) => {
    try {
      throw new Error(message)
    } catch (err) {
      alert(err.message)
    }
  },
  JS: {},
}

// ---------------------------------------------

// JS extension by Timo 2013
// ClipperLib.JS = {}

ClipperLib.JS.AreaOfPolygon = function (poly, scale) {
  if (!scale) scale = 1
  return ClipperLib.Clipper.Area(poly) / (scale * scale)
}

ClipperLib.JS.AreaOfPolygons = function (poly, scale) {
  if (!scale) scale = 1
  var area = 0
  for (var i = 0; i < poly.length; i++) {
    area += ClipperLib.Clipper.Area(poly[i])
  }
  return area / (scale * scale)
}

ClipperLib.JS.BoundsOfPath = function (path, scale) {
  return ClipperLib.JS.BoundsOfPaths([path], scale)
}

ClipperLib.JS.BoundsOfPaths = function (paths, scale) {
  if (!scale) scale = 1
  var bounds = ClipperLib.Clipper.GetBounds(paths)
  bounds.left /= scale
  bounds.bottom /= scale
  bounds.right /= scale
  bounds.top /= scale
  return bounds
}

// Clean() joins vertices that are too near each other
// and causes distortion to offsetted polygons without cleaning
ClipperLib.JS.Clean = function (polygon, delta) {
  if (!(polygon instanceof Array)) return []
  var isPolygons = polygon[0] instanceof Array
  var polygon = ClipperLib.JS.Clone(polygon)
  if (typeof delta !== 'number' || delta === null) {
    ClipperLib.Error('Delta is not a number in Clean().')
    return polygon
  }
  if (polygon.length === 0 || (polygon.length === 1 && polygon[0].length === 0) || delta < 0) return polygon
  if (!isPolygons) polygon = [polygon]
  var k_length = polygon.length
  var len, poly, result, d, p, j, i
  var results = []
  for (var k = 0; k < k_length; k++) {
    poly = polygon[k]
    len = poly.length
    if (len === 0) continue
    else if (len < 3) {
      result = poly
      results.push(result)
      continue
    }
    result = poly
    d = delta * delta
    //d = Math.floor(c_delta * c_delta);
    p = poly[0]
    j = 1
    for (i = 1; i < len; i++) {
      if ((poly[i].X - p.X) * (poly[i].X - p.X) + (poly[i].Y - p.Y) * (poly[i].Y - p.Y) <= d) continue
      result[j] = poly[i]
      p = poly[i]
      j++
    }
    p = poly[j - 1]
    if ((poly[0].X - p.X) * (poly[0].X - p.X) + (poly[0].Y - p.Y) * (poly[0].Y - p.Y) <= d) j--
    if (j < len) result.splice(j, len - j)
    if (result.length) results.push(result)
  }
  if (!isPolygons && results.length) results = results[0]
  else if (!isPolygons && results.length === 0) results = []
  else if (isPolygons && results.length === 0) results = [[]]
  return results
}
// Make deep copy of Polygons or Polygon
// so that also IntPoint objects are cloned and not only referenced
// This should be the fastest way
ClipperLib.JS.Clone = function (polygon) {
  if (!(polygon instanceof Array)) return []
  if (polygon.length === 0) return []
  else if (polygon.length === 1 && polygon[0].length === 0) return [[]]
  var isPolygons = polygon[0] instanceof Array
  if (!isPolygons) polygon = [polygon]
  var len = polygon.length,
    plen,
    i,
    j,
    result
  var results = new Array(len)
  for (i = 0; i < len; i++) {
    plen = polygon[i].length
    result = new Array(plen)
    for (j = 0; j < plen; j++) {
      result[j] = {
        X: polygon[i][j].X,
        Y: polygon[i][j].Y,
      }
    }
    results[i] = result
  }
  if (!isPolygons) results = results[0]
  return results
}

// Removes points that doesn't affect much to the visual appearance.
// If middle point is at or under certain distance (tolerance) of the line segment between
// start and end point, the middle point is removed.
ClipperLib.JS.Lighten = function (polygon, tolerance) {
  if (!(polygon instanceof Array)) return []
  if (typeof tolerance !== 'number' || tolerance === null) {
    ClipperLib.Error('Tolerance is not a number in Lighten().')
    return ClipperLib.JS.Clone(polygon)
  }
  if (polygon.length === 0 || (polygon.length === 1 && polygon[0].length === 0) || tolerance < 0) {
    return ClipperLib.JS.Clone(polygon)
  }
  var isPolygons = polygon[0] instanceof Array
  if (!isPolygons) polygon = [polygon]
  var i, j, poly, k, poly2, plen, A, B, P, d, rem, addlast
  var bxax, byay, l, ax, ay
  var len = polygon.length
  var toleranceSq = tolerance * tolerance
  var results = []
  for (i = 0; i < len; i++) {
    poly = polygon[i]
    plen = poly.length
    if (plen === 0) continue
    for (
      k = 0;
      k < 1000000;
      k++ // could be forever loop, but wiser to restrict max repeat count
    ) {
      poly2 = []
      plen = poly.length
      // the first have to added to the end, if first and last are not the same
      // this way we ensure that also the actual last point can be removed if needed
      if (poly[plen - 1].X !== poly[0].X || poly[plen - 1].Y !== poly[0].Y) {
        addlast = 1
        poly.push({
          X: poly[0].X,
          Y: poly[0].Y,
        })
        plen = poly.length
      } else addlast = 0
      rem = [] // Indexes of removed points
      for (j = 0; j < plen - 2; j++) {
        A = poly[j] // Start point of line segment
        P = poly[j + 1] // Middle point. This is the one to be removed.
        B = poly[j + 2] // End point of line segment
        ax = A.X
        ay = A.Y
        bxax = B.X - ax
        byay = B.Y - ay
        if (bxax !== 0 || byay !== 0) {
          // To avoid Nan, when A==P && P==B. And to avoid peaks (A==B && A!=P), which have lenght, but not area.
          l = ((P.X - ax) * bxax + (P.Y - ay) * byay) / (bxax * bxax + byay * byay)
          if (l > 1) {
            ax = B.X
            ay = B.Y
          } else if (l > 0) {
            ax += bxax * l
            ay += byay * l
          }
        }
        bxax = P.X - ax
        byay = P.Y - ay
        d = bxax * bxax + byay * byay
        if (d <= toleranceSq) {
          rem[j + 1] = 1
          j++ // when removed, transfer the pointer to the next one
        }
      }
      // add all unremoved points to poly2
      poly2.push({
        X: poly[0].X,
        Y: poly[0].Y,
      })
      for (j = 1; j < plen - 1; j++)
        if (!rem[j])
          poly2.push({
            X: poly[j].X,
            Y: poly[j].Y,
          })
      poly2.push({
        X: poly[plen - 1].X,
        Y: poly[plen - 1].Y,
      })
      // if the first point was added to the end, remove it
      if (addlast) poly.pop()
      // break, if there was not anymore removed points
      if (!rem.length) break
      // else continue looping using poly2, to check if there are points to remove
      else poly = poly2
    }
    plen = poly2.length
    // remove duplicate from end, if needed
    if (poly2[plen - 1].X === poly2[0].X && poly2[plen - 1].Y === poly2[0].Y) {
      poly2.pop()
    }
    if (poly2.length > 2)
      // to avoid two-point-polygons
      results.push(poly2)
  }
  if (!isPolygons) {
    results = results[0]
  }
  if (typeof results === 'undefined') {
    results = []
  }
  return results
}

ClipperLib.JS.PerimeterOfPath = function (path, closed, scale) {
  if (typeof path === 'undefined') return 0
  var sqrt = Math.sqrt
  var perimeter = 0.0
  var p1,
    p2,
    p1x = 0.0,
    p1y = 0.0,
    p2x = 0.0,
    p2y = 0.0
  var j = path.length
  if (j < 2) return 0
  if (closed) {
    path[j] = path[0]
    j++
  }
  while (--j) {
    p1 = path[j]
    p1x = p1.X
    p1y = p1.Y
    p2 = path[j - 1]
    p2x = p2.X
    p2y = p2.Y
    perimeter += sqrt((p1x - p2x) * (p1x - p2x) + (p1y - p2y) * (p1y - p2y))
  }
  if (closed) path.pop()
  return perimeter / scale
}

ClipperLib.JS.PerimeterOfPaths = function (paths, closed, scale) {
  if (!scale) scale = 1
  var perimeter = 0
  for (var i = 0; i < paths.length; i++) {
    perimeter += ClipperLib.JS.PerimeterOfPath(paths[i], closed, scale)
  }
  return perimeter
}

ClipperLib.JS.ScaleDownPath = function (path, scale) {
  var i, p
  if (!scale) scale = 1
  i = path.length
  while (i--) {
    p = path[i]
    p.X = p.X / scale
    p.Y = p.Y / scale
  }
}

ClipperLib.JS.ScaleDownPaths = function (paths, scale) {
  var i, j, p
  if (!scale) scale = 1
  i = paths.length
  while (i--) {
    j = paths[i].length
    while (j--) {
      p = paths[i][j]
      p.X = p.X / scale
      p.Y = p.Y / scale
    }
  }
}

ClipperLib.JS.ScaleUpPath = function (path, scale) {
  var i,
    p,
    round = Math.round
  if (!scale) scale = 1
  i = path.length
  while (i--) {
    p = path[i]
    p.X = round(p.X * scale)
    p.Y = round(p.Y * scale)
  }
}

ClipperLib.JS.ScaleUpPaths = function (paths, scale) {
  var i,
    j,
    p,
    round = Math.round
  if (!scale) scale = 1
  i = paths.length
  while (i--) {
    j = paths[i].length
    while (j--) {
      p = paths[i][j]
      p.X = round(p.X * scale)
      p.Y = round(p.Y * scale)
    }
  }
}

/**
 * @constructor
 */
ClipperLib.ExPolygons = function () {
  return []
}
/**
 * @constructor
 */
ClipperLib.ExPolygon = function () {
  this.outer = null
  this.holes = null
}

ClipperLib.JS.AddOuterPolyNodeToExPolygons = function (polynode, expolygons) {
  var ep = new ClipperLib.ExPolygon()
  ep.outer = polynode.Contour()
  var childs = polynode.Childs()
  var ilen = childs.length
  ep.holes = new Array(ilen)
  var node, n, i, j, childs2, jlen
  for (i = 0; i < ilen; i++) {
    node = childs[i]
    ep.holes[i] = node.Contour()
    //Add outer polygons contained by (nested within) holes ...
    for (j = 0, childs2 = node.Childs(), jlen = childs2.length; j < jlen; j++) {
      n = childs2[j]
      ClipperLib.JS.AddOuterPolyNodeToExPolygons(n, expolygons)
    }
  }
  expolygons.push(ep)
}

ClipperLib.JS.ExPolygonsToPaths = function (expolygons) {
  var a, i, alen, ilen
  var paths = new ClipperLib.Paths()
  for (a = 0, alen = expolygons.length; a < alen; a++) {
    paths.push(expolygons[a].outer)
    for (i = 0, ilen = expolygons[a].holes.length; i < ilen; i++) {
      paths.push(expolygons[a].holes[i])
    }
  }
  return paths
}
ClipperLib.JS.PolyTreeToExPolygons = function (polytree) {
  var expolygons = new ClipperLib.ExPolygons()
  var node, i, childs, ilen
  for (i = 0, childs = polytree.Childs(), ilen = childs.length; i < ilen; i++) {
    node = childs[i]
    ClipperLib.JS.AddOuterPolyNodeToExPolygons(node, expolygons)
  }
  return expolygons
}
