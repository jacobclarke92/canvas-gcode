import { Int128 } from '../BigInteger'
import { ClipperLib } from '.'
import { PolyType } from './enums'
import { IntPoint } from './IntPoint'
import type { OuterPoint } from './Misc'
import { LocalMinima, OuterRectangle, Scanbeam } from './Misc'
import type { Path, Paths } from './Path'
import type { TEdge } from './TEdge'

export class ClipperBase {
  public preserveCollinear = false
  protected minimaList: LocalMinima | null = null
  protected currentLocalMinima: LocalMinima | null = null
  protected edges: TEdge[][] = []
  protected useFullRange = false
  protected hasOpenPaths = false
  protected scanbeam: Scanbeam | null = null
  protected polyOuts: OuterRectangle[] = []
  protected activeEdges: TEdge | null = null

  // Ranges are in original C# too high for Javascript (in current state 2013 september):
  // protected const double horizontal = -3.4E+38;
  // internal const cInt loRange = 0x3FFFFFFF; // = 1073741823 = sqrt(2^63 -1)/2
  // internal const cInt hiRange = 0x3FFFFFFFFFFFFFFFL; // = 4611686018427387903 = sqrt(2^127 -1)/2
  // So had to adjust them to more suitable for Javascript.
  // If JS some day supports truly 64-bit integers, then these ranges can be as in C#
  // and biginteger library can be more simpler (as then 128bit can be represented as two 64bit numbers)
  public static HORIZONTAL = -9007199254740992 as const //-2^53
  public static SKIP = -2 as const
  public static UNASSIGNED = -1 as const
  public static TOLERANCE = 1e-20 as const
  public static LOW_RANGE = 47453132 as const // sqrt(2^53 -1)/2
  public static HIGH_RANGE = 4503599627370495 as const // sqrt(2^106 -1)/2

  public static isNearZero(val: number) {
    return val > -ClipperBase.TOLERANCE && val < ClipperBase.TOLERANCE
  }
  public static isHorizontal(e: TEdge) {
    return e.delta.y === 0
  }

  public pointIsVertex(pt: IntPoint, pp: OuterPoint) {
    let pp2 = pp
    do {
      if (IntPoint.op_Equality(pp2.point, pt)) return true
      pp2 = pp2.next
    } while (pp2 !== pp)
    return false
  }

  public isPointOnLineSegment(pt: IntPoint, linePt1: IntPoint, linePt2: IntPoint, UseFullRange: boolean) {
    if (UseFullRange)
      return (
        (pt.x === linePt1.x && pt.y === linePt1.y) ||
        (pt.x === linePt2.x && pt.y === linePt2.y) ||
        (pt.x > linePt1.x === pt.x < linePt2.x &&
          pt.y > linePt1.y === pt.y < linePt2.y &&
          Int128.op_Equality(
            Int128.Int128Mul(pt.x - linePt1.x, linePt2.y - linePt1.y),
            Int128.Int128Mul(linePt2.x - linePt1.x, pt.y - linePt1.y)
          ))
      )
    else
      return (
        (pt.x === linePt1.x && pt.y === linePt1.y) ||
        (pt.x === linePt2.x && pt.y === linePt2.y) ||
        (pt.x > linePt1.x === pt.x < linePt2.x &&
          pt.y > linePt1.y === pt.y < linePt2.y &&
          (pt.x - linePt1.x) * (linePt2.y - linePt1.y) === (linePt2.x - linePt1.x) * (pt.y - linePt1.y))
      )
  }

  public isPointOnPolygon(pt: IntPoint, pp: OuterPoint, UseFullRange: boolean) {
    let pp2 = pp
    while (true) {
      if (this.isPointOnLineSegment(pt, pp2.point, pp2.next.point, UseFullRange)) return true
      pp2 = pp2.next
      if (pp2 === pp) break
    }
    return false
  }

  public static slopesEqual(
    ...args:
      | [e1: TEdge, e2: TEdge, UseFullRange: boolean]
      | [pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, UseFullRange: boolean]
      | [pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, pt4: IntPoint, UseFullRange: boolean]
  ) {
    if (args.length === 3) {
      const [e1, e2, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(Int128.Int128Mul(e1.delta.y, e2.delta.x), Int128.Int128Mul(e1.delta.x, e2.delta.y))
      else return ClipperLib.castInt64(e1.delta.y * e2.delta.x) === ClipperLib.castInt64(e1.delta.x * e2.delta.y)
    } else if (args.length === 4) {
      const [pt1, pt2, pt3, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(
          Int128.Int128Mul(pt1.y - pt2.y, pt2.x - pt3.x),
          Int128.Int128Mul(pt1.x - pt2.x, pt2.y - pt3.y)
        )
      else
        return (
          ClipperLib.castInt64((pt1.y - pt2.y) * (pt2.x - pt3.x)) -
            ClipperLib.castInt64((pt1.x - pt2.x) * (pt2.y - pt3.y)) ===
          0
        )
    } else {
      const [pt1, pt2, pt3, pt4, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(
          Int128.Int128Mul(pt1.y - pt2.y, pt3.x - pt4.x),
          Int128.Int128Mul(pt1.x - pt2.x, pt3.y - pt4.y)
        )
      else
        return (
          ClipperLib.castInt64((pt1.y - pt2.y) * (pt3.x - pt4.x)) -
            ClipperLib.castInt64((pt1.x - pt2.x) * (pt3.y - pt4.y)) ===
          0
        )
    }
  }

  public clear() {
    this.disposeLocalMinimaList()
    for (let i = 0, len = this.edges.length; i < len; ++i) {
      for (let j = 0, jlen = this.edges[i].length; j < jlen; ++j) this.edges[i][j] = null
      ClipperLib.clear(this.edges[i])
    }
    ClipperLib.clear(this.edges)
    this.useFullRange = false
    this.hasOpenPaths = false
  }

  public disposeLocalMinimaList() {
    while (this.minimaList !== null) {
      const tmpLm = this.minimaList.next
      this.minimaList = null
      this.minimaList = tmpLm
    }
    this.currentLocalMinima = null
  }

  public rangeTest(point: IntPoint, $useFullRange: { value: boolean }) {
    if ($useFullRange.value) {
      if (
        point.x > ClipperBase.HIGH_RANGE ||
        point.y > ClipperBase.HIGH_RANGE ||
        -point.x > ClipperBase.HIGH_RANGE ||
        -point.y > ClipperBase.HIGH_RANGE
      )
        ClipperLib.Error('Coordinate outside allowed range in RangeTest().')
    } else if (
      point.x > ClipperBase.LOW_RANGE ||
      point.y > ClipperBase.LOW_RANGE ||
      -point.x > ClipperBase.LOW_RANGE ||
      -point.y > ClipperBase.LOW_RANGE
    ) {
      $useFullRange.value = true
      this.rangeTest(point, $useFullRange)
    }
  }

  public initEdge(
    ...args: [e: TEdge, eNext: TEdge | null, ePrev: TEdge | null, pt: IntPoint] | [e: TEdge, polyType: PolyType]
  ) {
    if (args.length === 2) {
      const [e, polyType] = args
      if (e.current.y >= e.next.current.y) {
        //e.Bot = e.Curr;
        e.bottom.x = e.current.x
        e.bottom.y = e.current.y
        if (ClipperLib.USE_XYZ) e.bottom.z = e.current.z
        //e.Top = e.Next.Curr;
        e.top.x = e.next.current.x
        e.top.y = e.next.current.y
        if (ClipperLib.USE_XYZ) e.top.z = e.next.current.z
      } else {
        //e.Top = e.Curr;
        e.top.x = e.current.x
        e.top.y = e.current.y
        if (ClipperLib.USE_XYZ) e.top.z = e.current.z
        //e.Bot = e.Next.Curr;
        e.bottom.x = e.next.current.x
        e.bottom.y = e.next.current.y
        if (ClipperLib.USE_XYZ) e.bottom.z = e.next.current.z
      }
      this.setDx(e)
      e.polyType = polyType
    } else {
      const [e, nextEdge, prevEdge, pt] = args
      e.next = nextEdge
      e.prev = prevEdge
      //e.Curr = pt;
      e.current.x = pt.x
      e.current.y = pt.y
      if (ClipperLib.USE_XYZ) e.current.z = pt.z
      e.outIndex = -1
    }
  }

  public findNextLocMin(edge: TEdge) {
    let edge2
    for (;;) {
      while (IntPoint.op_Inequality(edge.bottom, edge.prev.bottom) || IntPoint.op_Equality(edge.current, edge.top))
        edge = edge.next
      if (edge.dx !== ClipperBase.HORIZONTAL && edge.prev.dx !== ClipperBase.HORIZONTAL) break
      while (edge.prev.dx === ClipperBase.HORIZONTAL) edge = edge.prev
      edge2 = edge
      while (edge.dx === ClipperBase.HORIZONTAL) edge = edge.next
      if (edge.top.y === edge.prev.bottom.y) continue
      // ie just an intermediate horz.
      if (edge2.prev.bottom.x < edge.bottom.x) edge = edge2
      break
    }
    return edge
  }

  public processBoundary(edge: TEdge, leftBoundIsForward: boolean) {
    let startEdge: TEdge
    let result = edge
    let horizontal: TEdge

    if (result.outIndex === ClipperBase.SKIP) {
      // check if there are edges beyond the skip edge in the bound and if so
      // create another LocMin and calling ProcessBound once more ...
      edge = result
      if (leftBoundIsForward) {
        while (edge.top.y === edge.next.bottom.y) edge = edge.next
        while (edge !== result && edge.dx === ClipperBase.HORIZONTAL) edge = edge.prev
      } else {
        while (edge.top.y === edge.prev.bottom.y) edge = edge.prev
        while (edge !== result && edge.dx === ClipperBase.HORIZONTAL) edge = edge.next
      }
      if (edge === result) {
        if (leftBoundIsForward) result = edge.next
        else result = edge.prev
      } else {
        // there are more edges in the bound beyond result starting with E
        if (leftBoundIsForward) edge = result.next
        else edge = result.prev
        const locMin = new LocalMinima()
        locMin.next = null
        locMin.y = edge.bottom.y
        locMin.leftBoundary = null
        locMin.rightBoundary = edge
        edge.windDelta = 0
        result = this.processBoundary(edge, leftBoundIsForward)
        this.insertLocalMinima(locMin)
      }
      return result
    }

    if (edge.dx === ClipperBase.HORIZONTAL) {
      //We need to be careful with open paths because this may not be a
      //true local minima (ie E may be following a skip edge).
      //Also, consecutive horz. edges may start heading left before going right.
      if (leftBoundIsForward) startEdge = edge.prev
      else startEdge = edge.next

      if (startEdge.dx === ClipperBase.HORIZONTAL) {
        //ie an adjoining horizontal skip edge
        if (startEdge.bottom.x !== edge.bottom.x && startEdge.top.x !== edge.bottom.x) this.reverseHorizontal(edge)
      } else if (startEdge.bottom.x !== edge.bottom.x) this.reverseHorizontal(edge)
    }

    startEdge = edge
    if (leftBoundIsForward) {
      while (result.top.y === result.next.bottom.y && result.next.outIndex !== ClipperBase.SKIP) result = result.next
      if (result.dx === ClipperBase.HORIZONTAL && result.next.outIndex !== ClipperBase.SKIP) {
        //nb: at the top of a bound, horizontals are added to the bound
        //only when the preceding edge attaches to the horizontal's left vertex
        //unless a Skip edge is encountered when that becomes the top divide
        horizontal = result
        while (horizontal.prev.dx === ClipperBase.HORIZONTAL) horizontal = horizontal.prev
        if (horizontal.prev.top.x > result.next.top.x) result = horizontal.prev
      }
      while (edge !== result) {
        edge.nextInLML = edge.next
        if (edge.dx === ClipperBase.HORIZONTAL && edge !== startEdge && edge.bottom.x !== edge.prev.top.x)
          this.reverseHorizontal(edge)
        edge = edge.next
      }
      if (edge.dx === ClipperBase.HORIZONTAL && edge !== startEdge && edge.bottom.x !== edge.prev.top.x)
        this.reverseHorizontal(edge)
      result = result.next
      //move to the edge just beyond current bound
    } else {
      while (result.top.y === result.prev.bottom.y && result.prev.outIndex !== ClipperBase.SKIP) result = result.prev
      if (result.dx === ClipperBase.HORIZONTAL && result.prev.outIndex !== ClipperBase.SKIP) {
        horizontal = result
        while (horizontal.next.dx === ClipperBase.HORIZONTAL) horizontal = horizontal.next
        if (horizontal.next.top.x === result.prev.top.x || horizontal.next.top.x > result.prev.top.x) {
          result = horizontal.next
        }
      }
      while (edge !== result) {
        edge.nextInLML = edge.prev
        if (edge.dx === ClipperBase.HORIZONTAL && edge !== startEdge && edge.bottom.x !== edge.next.top.x)
          this.reverseHorizontal(edge)
        edge = edge.prev
      }
      if (edge.dx === ClipperBase.HORIZONTAL && edge !== startEdge && edge.bottom.x !== edge.next.top.x)
        this.reverseHorizontal(edge)
      result = result.prev
      //move to the edge just beyond current bound
    }

    return result
  }

  public addPath(path: Path, polyType: PolyType, isClosed: boolean) {
    if (ClipperLib.use_lines) {
      if (!isClosed && polyType === PolyType.clip) ClipperLib.Error('AddPath: Open paths must be subject.')
    } else {
      if (!isClosed) ClipperLib.Error('AddPath: Open paths have been disabled.')
    }
    let highIndex = path.length - 1
    if (isClosed) while (highIndex > 0 && IntPoint.op_Equality(path[highIndex], path[0])) --highIndex
    while (highIndex > 0 && IntPoint.op_Equality(path[highIndex], path[highIndex - 1])) --highIndex
    if ((isClosed && highIndex < 2) || (!isClosed && highIndex < 1)) return false
    //create a new edge array ...
    const edges: TEdge[] = []
    for (let i = 0; i <= highIndex; i++) edges.push(new ClipperLib.TEdge())
    let isFlat = true
    //1. Basic (first) edge initialization ...

    //edges[1].Curr = pg[1];
    edges[1].current.x = path[1].x
    edges[1].current.y = path[1].y
    if (ClipperLib.USE_XYZ) edges[1].current.z = path[1].z

    const $useFullRange = {
      value: this.useFullRange,
    }

    this.rangeTest(path[0], $useFullRange)
    this.useFullRange = $useFullRange.value

    $useFullRange.value = this.useFullRange
    this.rangeTest(path[highIndex], $useFullRange)
    this.useFullRange = $useFullRange.value

    this.initEdge(edges[0], edges[1], edges[highIndex], path[0])
    this.initEdge(edges[highIndex], edges[0], edges[highIndex - 1], path[highIndex])
    for (let i = highIndex - 1; i >= 1; --i) {
      $useFullRange.value = this.useFullRange
      this.rangeTest(path[i], $useFullRange)
      this.useFullRange = $useFullRange.value

      this.initEdge(edges[i], edges[i + 1], edges[i - 1], path[i])
    }

    let eStart = edges[0]
    //2. Remove duplicate vertices, and (when closed) collinear edges ...
    let E = eStart,
      eLoopStop = eStart
    for (;;) {
      //console.log(E.Next, eStart);
      //nb: allows matching start and end points when not Closed ...
      if (E.current === E.next.current && (isClosed || E.next !== eStart)) {
        if (E === E.next) break
        if (E === eStart) eStart = E.next
        E = this.removeEdge(E)
        eLoopStop = E
        continue
      }
      if (E.prev === E.next) break
      else if (
        isClosed &&
        ClipperBase.slopesEqual(E.prev.current, E.current, E.next.current, this.useFullRange) &&
        (!this.preserveCollinear || !this.pt2IsBetweenPt1AndPt3(E.prev.current, E.current, E.next.current))
      ) {
        //Collinear edges are allowed for open paths but in closed paths
        //the default is to merge adjacent collinear edges into a single edge.
        //However, if the PreserveCollinear property is enabled, only overlapping
        //collinear edges (ie spikes) will be removed from closed paths.
        if (E === eStart) eStart = E.next
        E = this.removeEdge(E)
        E = E.prev
        eLoopStop = E
        continue
      }
      E = E.next
      if (E === eLoopStop || (!isClosed && E.next === eStart)) break
    }
    if ((!isClosed && E === E.next) || (isClosed && E.prev === E.next)) return false
    if (!isClosed) {
      this.hasOpenPaths = true
      eStart.prev.outIndex = ClipperBase.SKIP
    }
    //3. Do second stage of edge initialization ...
    E = eStart
    do {
      this.initEdge(E, polyType)
      E = E.next
      if (isFlat && E.current.y !== eStart.current.y) isFlat = false
    } while (E !== eStart)
    //4. Finally, add edge bounds to LocalMinima list ...
    //Totally flat paths must be handled differently when adding them
    //to LocalMinima list to avoid endless loops etc ...
    if (isFlat) {
      if (isClosed) return false

      E.prev.outIndex = ClipperBase.SKIP

      const locMin = new ClipperLib.LocalMinima()
      locMin.next = null
      locMin.y = E.bottom.y
      locMin.leftBoundary = null
      locMin.rightBoundary = E
      locMin.rightBoundary.side = ClipperLib.EdgeSide.right
      locMin.rightBoundary.windDelta = 0

      for (;;) {
        if (E.bottom.x !== E.prev.top.x) this.reverseHorizontal(E)
        if (E.next.outIndex === ClipperBase.SKIP) break
        E.nextInLML = E.next
        E = E.next
      }
      this.insertLocalMinima(locMin)
      this.edges.push(edges)
      return true
    }
    this.edges.push(edges)
    let leftBoundIsForward: boolean
    let EMin: TEdge | null = null

    //workaround to avoid an endless loop in the while loop below when
    //open paths have matching start and end points ...
    if (IntPoint.op_Equality(E.prev.bottom, E.prev.top)) E = E.next

    for (;;) {
      E = this.findNextLocMin(E)
      if (E === EMin) break
      else if (EMin === null) EMin = E
      //E and E.Prev now share a local minima (left aligned if horizontal).
      //Compare their slopes to find which starts which bound ...
      const locMin = new ClipperLib.LocalMinima()
      locMin.next = null
      locMin.y = E.bottom.y
      if (E.dx < E.prev.dx) {
        locMin.leftBoundary = E.prev
        locMin.rightBoundary = E
        leftBoundIsForward = false
        //Q.nextInLML = Q.prev
      } else {
        locMin.leftBoundary = E
        locMin.rightBoundary = E.prev
        leftBoundIsForward = true
        //Q.nextInLML = Q.next
      }
      locMin.leftBoundary.side = ClipperLib.EdgeSide.left
      locMin.rightBoundary.side = ClipperLib.EdgeSide.right

      if (!isClosed) locMin.leftBoundary.windDelta = 0
      else if (locMin.leftBoundary.next === locMin.rightBoundary) locMin.leftBoundary.windDelta = -1
      else locMin.leftBoundary.windDelta = 1

      locMin.rightBoundary.windDelta = -locMin.leftBoundary.windDelta as 1 | 0 | -1
      E = this.processBoundary(locMin.leftBoundary, leftBoundIsForward)

      if (E.outIndex === ClipperBase.SKIP) E = this.processBoundary(E, leftBoundIsForward)

      let E2 = this.processBoundary(locMin.rightBoundary, !leftBoundIsForward)
      if (E2.outIndex === ClipperBase.SKIP) E2 = this.processBoundary(E2, !leftBoundIsForward)

      if (locMin.leftBoundary.outIndex === ClipperBase.SKIP) locMin.leftBoundary = null
      else if (locMin.rightBoundary.outIndex === ClipperBase.SKIP) locMin.rightBoundary = null

      this.insertLocalMinima(locMin)
      if (!leftBoundIsForward) E = E2
    }
    return true
  }

  public addPaths(paths: Paths, polyType: PolyType, isClosed: boolean) {
    //  console.log("-------------------------------------------");
    //  console.log(JSON.stringify(ppg));
    let result = false
    for (let i = 0, len = paths.length; i < len; ++i) {
      if (this.addPath(paths[i], polyType, isClosed)) result = true
    }
    return result
  }

  public pt2IsBetweenPt1AndPt3(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint) {
    if (IntPoint.op_Equality(pt1, pt3) || IntPoint.op_Equality(pt1, pt2) || IntPoint.op_Equality(pt3, pt2))
      // if ((pt1 == pt3) || (pt1 == pt2) || (pt3 == pt2))
      return false
    else if (pt1.x !== pt3.x) return pt2.x > pt1.x === pt2.x < pt3.x
    else return pt2.y > pt1.y === pt2.y < pt3.y
  }

  public removeEdge(edge: TEdge) {
    // removes e from double_linked_list (but without removing from memory)
    edge.prev.next = edge.next
    edge.next.prev = edge.prev
    const result = edge.next
    edge.prev = null // flag as removed (see ClipperBase.Clear)
    return result
  }

  public setDx(edge: TEdge) {
    edge.delta.x = edge.top.x - edge.bottom.x
    edge.delta.y = edge.top.y - edge.bottom.y
    if (edge.delta.y === 0) edge.dx = ClipperBase.HORIZONTAL
    else edge.dx = edge.delta.x / edge.delta.y
  }

  public insertLocalMinima(newLocalMinima: LocalMinima) {
    if (this.minimaList === null) {
      this.minimaList = newLocalMinima
    } else if (newLocalMinima.y >= this.minimaList.y) {
      newLocalMinima.next = this.minimaList
      this.minimaList = newLocalMinima
    } else {
      let tmpLm = this.minimaList
      while (tmpLm.next !== null && newLocalMinima.y < tmpLm.next.y) tmpLm = tmpLm.next
      newLocalMinima.next = tmpLm.next
      tmpLm.next = newLocalMinima
    }
  }

  public popLocalMinima(y: number, currentLocalMinima: LocalMinima) {
    currentLocalMinima.v = this.currentLocalMinima
    if (this.currentLocalMinima !== null && this.currentLocalMinima.y === y) {
      this.currentLocalMinima = this.currentLocalMinima.next
      return true
    }
    return false
  }

  public reverseHorizontal(edge: TEdge) {
    // swap horizontal edges' top and bottom x's so they follow the natural
    // progression of the bounds - ie so their xbots will align with the
    // adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
    let tmp = edge.top.x
    edge.top.x = edge.bottom.x
    edge.bottom.x = tmp
    if (ClipperLib.USE_XYZ) {
      tmp = edge.top.z
      edge.top.z = edge.bottom.z
      edge.bottom.z = tmp
    }
  }

  public reset() {
    this.currentLocalMinima = this.minimaList
    if (this.currentLocalMinima === null)
      //ie nothing to process
      return
    //reset all edges ...
    this.scanbeam = null
    let lm = this.minimaList
    while (lm !== null) {
      this.insertScanbeam(lm.y)
      let e = lm.leftBoundary
      if (e !== null) {
        //e.Curr = e.Bot;
        e.current.x = e.bottom.x
        e.current.y = e.bottom.y
        if (ClipperLib.USE_XYZ) e.current.z = e.bottom.z
        e.outIndex = ClipperBase.UNASSIGNED
      }
      e = lm.rightBoundary
      if (e !== null) {
        //e.Curr = e.Bot;
        e.current.x = e.bottom.x
        e.current.y = e.bottom.y
        if (ClipperLib.USE_XYZ) e.current.z = e.bottom.z
        e.outIndex = ClipperBase.UNASSIGNED
      }
      lm = lm.next
    }
    this.activeEdges = null
  }

  public insertScanbeam(y: number) {
    // single-linked list: sorted descending, ignoring dups.
    if (this.scanbeam === null) {
      this.scanbeam = new Scanbeam()
      this.scanbeam.Next = null
      this.scanbeam.y = y
    } else if (y > this.scanbeam.y) {
      const newSb = new Scanbeam()
      newSb.y = y
      newSb.Next = this.scanbeam
      this.scanbeam = newSb
    } else {
      let sb2 = this.scanbeam
      while (sb2.Next !== null && y <= sb2.Next.y) {
        sb2 = sb2.Next
      }
      if (y === sb2.y) {
        return
      } //ie ignores duplicates
      const newSb1 = new Scanbeam()
      newSb1.y = y
      newSb1.Next = sb2.Next
      sb2.Next = newSb1
    }
  }

  public popScanbeam(scanbeam: Scanbeam) {
    if (this.scanbeam === null) {
      scanbeam.v = 0
      return false
    }
    scanbeam.v = this.scanbeam.y
    this.scanbeam = this.scanbeam.Next
    return true
  }

  public localMinimaPending() {
    return this.currentLocalMinima !== null
  }

  public createOuterRectangle() {
    const result = new OuterRectangle()
    result.index = ClipperBase.UNASSIGNED
    result.isHole = false
    result.isOpen = false
    result.firstLeft = null
    result.points = null
    result.bottomPoint = null
    result.polyNode = null
    this.polyOuts.push(result)
    result.index = this.polyOuts.length - 1
    return result
  }

  public disposeOuterRectangle(index: number) {
    let outerRectangle = this.polyOuts[index]
    outerRectangle.points = null
    outerRectangle = null
    this.polyOuts[index] = null
  }

  public updateEdgeIntoAEL(e: TEdge) {
    if (e.nextInLML === null) {
      ClipperLib.Error('UpdateEdgeIntoAEL: invalid call')
    }
    const prevAEL = e.prevInAEL
    const nextAEL = e.nextInAEL
    e.nextInLML.outIndex = e.outIndex
    if (prevAEL !== null) {
      prevAEL.nextInAEL = e.nextInLML
    } else {
      this.activeEdges = e.nextInLML
    }
    if (nextAEL !== null) {
      nextAEL.prevInAEL = e.nextInLML
    }
    e.nextInLML.side = e.side
    e.nextInLML.windDelta = e.windDelta
    e.nextInLML.windCount = e.windCount
    e.nextInLML.windCount2 = e.windCount2
    e = e.nextInLML
    e.current.x = e.bottom.x
    e.current.y = e.bottom.y
    e.prevInAEL = prevAEL
    e.nextInAEL = nextAEL
    if (!ClipperBase.isHorizontal(e)) {
      this.insertScanbeam(e.top.y)
    }
    return e
  }

  public swapPositionsInAEL(edge1: TEdge, edge2: TEdge) {
    // check that one or other edge hasn't already been removed from AEL ...
    if (edge1.nextInAEL === edge1.prevInAEL || edge2.nextInAEL === edge2.prevInAEL) {
      return
    }

    if (edge1.nextInAEL === edge2) {
      const next = edge2.nextInAEL
      if (next !== null) {
        next.prevInAEL = edge1
      }
      const prev = edge1.prevInAEL
      if (prev !== null) {
        prev.nextInAEL = edge2
      }
      edge2.prevInAEL = prev
      edge2.nextInAEL = edge1
      edge1.prevInAEL = edge2
      edge1.nextInAEL = next
    } else if (edge2.nextInAEL === edge1) {
      const next = edge1.nextInAEL
      if (next !== null) {
        next.prevInAEL = edge2
      }
      const prev = edge2.prevInAEL
      if (prev !== null) {
        prev.nextInAEL = edge1
      }
      edge1.prevInAEL = prev
      edge1.nextInAEL = edge2
      edge2.prevInAEL = edge1
      edge2.nextInAEL = next
    } else {
      const next = edge1.nextInAEL
      const prev = edge1.prevInAEL
      edge1.nextInAEL = edge2.nextInAEL
      if (edge1.nextInAEL !== null) {
        edge1.nextInAEL.prevInAEL = edge1
      }
      edge1.prevInAEL = edge2.prevInAEL
      if (edge1.prevInAEL !== null) {
        edge1.prevInAEL.nextInAEL = edge1
      }
      edge2.nextInAEL = next
      if (edge2.nextInAEL !== null) {
        edge2.nextInAEL.prevInAEL = edge2
      }
      edge2.prevInAEL = prev
      if (edge2.prevInAEL !== null) {
        edge2.prevInAEL.nextInAEL = edge2
      }
    }

    if (edge1.prevInAEL === null) {
      this.activeEdges = edge1
    } else {
      if (edge2.prevInAEL === null) {
        this.activeEdges = edge2
      }
    }
  }

  public deleteFromAEL(e: TEdge) {
    const prevAEL = e.prevInAEL
    const nextAEL = e.nextInAEL
    if (prevAEL === null && nextAEL === null && e !== this.activeEdges) {
      return
    }
    // already deleted
    if (prevAEL !== null) {
      prevAEL.nextInAEL = nextAEL
    } else {
      this.activeEdges = nextAEL
    }
    if (nextAEL !== null) {
      nextAEL.prevInAEL = prevAEL
    }
    e.nextInAEL = null
    e.prevInAEL = null
  }
}
