import { ClipperLib } from '.'
import { browser } from './browser'
import { ClipperBase } from './ClipperBase'
import { ClipType, Direction, EdgeSide, NodeType, PolyFillType as PolygonFillType, PolyType } from './enums'
import { IntersectNode, MyIntersectNodeSort } from './IntersectNode'
import { IntPoint } from './IntPoint'
import { IntRectangle } from './IntRectangle'
import type { OuterRectangle } from './Misc'
import { Join, LocalMinima, Maxima, OuterPoint, Scanbeam } from './Misc'
import { Path, Paths } from './Path'
import { PolygonNode, PolygonTree } from './PolygonNode'
import { TEdge } from './TEdge'
import type { HorizontalEdgeProps, OverlapProps } from './types'

export class Clipper extends ClipperBase {
  public static ioReverseSolution = 1
  public static ioStrictlySimple = 2
  public static ioPreserveCollinear = 4

  public outerPolygons: OuterRectangle[] = []
  public scanbeam: Scanbeam | null = null
  protected clipType = ClipType.intersection
  protected maxima: Maxima | null = null
  public activeEdges: TEdge | null = null
  protected sortedEdges: TEdge | null = null
  protected intersectList: IntersectNode[] = []
  protected intersectNodeComparer = MyIntersectNodeSort.compare
  protected executeLocked = false
  protected clipFillType = PolygonFillType.evenOdd
  protected subjectFillType = PolygonFillType.evenOdd
  protected joins: Join[] = []
  protected ghostJoins: Join[] = []
  protected usingPolygonTree = false
  public reverseSolution = false
  public strictlySimple = false
  public preserveCollinear = false

  public zFillFunction: null | ((vert1: IntPoint, vert2: IntPoint, ref: unknown, intersectPt: IntPoint) => void)

  // Round speedtest: http://jsperf.com/fastest-round
  public static round: (a: number) => number = browser.msie
    ? (a) => (a < 0 ? Math.ceil(a - 0.5) : Math.round(a))
    : browser.chromium
    ? (a) => (a < 0 ? -Math.round(Math.abs(a)) : Math.round(a))
    : browser.safari
    ? (a) =>
        a < 0
          ? a - 0.5 < -2147483648
            ? Math.ceil(a - 0.5)
            : (a - 0.5) | 0
          : a + 0.5 > 2147483647
          ? Math.floor(a + 0.5)
          : (a + 0.5) | 0
    : (a) => (a < 0 ? Math.ceil(a - 0.5) : Math.floor(a + 0.5))

  constructor(InitOptions = 0) {
    super()
    this.reverseSolution = (1 & InitOptions) !== 0
    this.strictlySimple = (2 & InitOptions) !== 0
    this.preserveCollinear = (4 & InitOptions) !== 0
    if (ClipperLib.USE_XYZ) {
      this.zFillFunction = null // function (IntPoint vert1, IntPoint vert2, ref IntPoint intersectPt);
    } else {
      // TODO: ????
      this.zFillFunction = null
    }
  }

  public clear() {
    if (this.edges.length === 0) return
    //avoids problems with ClipperBase destructor
    this.disposeAllPolyPoints()
    super.clear()
  }

  public insertMaxima(x: number) {
    //double-linked list: sorted ascending, ignoring dups.
    const newMaxima = new Maxima()
    newMaxima.x = x
    if (this.maxima === null) {
      this.maxima = newMaxima
      this.maxima.next = null
      this.maxima.prev = null
    } else if (x < this.maxima.x) {
      newMaxima.next = this.maxima
      newMaxima.prev = null
      this.maxima = newMaxima
    } else {
      let maxima = this.maxima
      while (maxima.next !== null && x >= maxima.next.x) {
        maxima = maxima.next
      }
      if (x === maxima.x) {
        return
      }
      // ie ignores duplicates (& CG to clean up newMax)
      // insert newMax between m and m.Next ...
      newMaxima.next = maxima.next
      newMaxima.prev = maxima
      if (maxima.next !== null) maxima.next.prev = newMaxima
      maxima.next = newMaxima
    }
  }

  public execute(
    ...args:
      | [
          clipType: ClipType,
          solution: PolygonTree | Paths,
          subjectFillType: PolygonFillType,
          clipFillType: PolygonFillType
        ]
      | [clipType: ClipType, solution: PolygonTree | Paths]
  ): boolean {
    if (args.length === 4 && !(args[1] instanceof PolygonTree)) {
      if (this.executeLocked) return false
      if (this.hasOpenPaths) ClipperLib.Error('Error: PolyTree struct is needed for open path clipping.')

      const [clipType, solution, subjectFillType, clipFillType] = args
      this.executeLocked = true
      ClipperLib.clear(solution)

      this.subjectFillType = subjectFillType
      this.clipFillType = clipFillType
      this.clipType = clipType
      this.usingPolygonTree = false

      let succeeded = false
      try {
        succeeded = this.executeInternal()
        // build the return polygons ...
        if (succeeded) this.buildResult(solution)
      } finally {
        this.disposeAllPolyPoints()
        this.executeLocked = false
      }
      return succeeded
    } else if (args.length === 4 && args[1] instanceof PolygonTree) {
      if (this.executeLocked) return false

      const [clipType, polygonTree, subjectFillType, clipFillType] = args

      this.executeLocked = true
      this.subjectFillType = subjectFillType
      this.clipFillType = clipFillType
      this.clipType = clipType
      this.usingPolygonTree = true

      let succeeded = false
      try {
        succeeded = this.executeInternal()
        //build the return polygons ...
        if (succeeded) this.buildResult(polygonTree)
      } finally {
        this.disposeAllPolyPoints()
        this.executeLocked = false
      }
      return succeeded
    } else if (args.length === 2 && !(args[1] instanceof PolygonTree)) {
      const [clipType, solution] = args
      return this.execute(clipType, solution, PolygonFillType.evenOdd, PolygonFillType.evenOdd)
    } else if (args.length === 2 && args[1] instanceof PolygonTree) {
      const [clipType, polygonTree] = args
      return this.execute(clipType, polygonTree, PolygonFillType.evenOdd, PolygonFillType.evenOdd)
    }
  }

  public fixHoleLinkage(outerRectangle: OuterRectangle) {
    // skip if an outermost polygon or already already points to the correct FirstLeft ...
    if (
      outerRectangle.firstLeft === null ||
      (outerRectangle.isHole !== outerRectangle.firstLeft.isHole && outerRectangle.firstLeft.points !== null)
    )
      return
    let outerRectangleFirstLeft = outerRectangle.firstLeft
    while (
      outerRectangleFirstLeft !== null &&
      (outerRectangleFirstLeft.isHole === outerRectangle.isHole || outerRectangleFirstLeft.points === null)
    )
      outerRectangleFirstLeft = outerRectangleFirstLeft.firstLeft
    outerRectangle.firstLeft = outerRectangleFirstLeft
  }

  public executeInternal() {
    try {
      this.reset()
      this.sortedEdges = null
      this.maxima = null

      const bottomY = new Scanbeam()
      const topY = new Scanbeam()

      if (!this.popScanbeam(bottomY)) {
        return false
      }
      this.insertLocalMinimaIntoAEL(bottomY.v)
      while (this.popScanbeam(topY) || this.localMinimaPending()) {
        this.processHorizontals()
        this.ghostJoins.length = 0
        if (!this.processIntersections(topY.v)) {
          return false
        }
        this.processEdgesAtTopOfScanbeam(topY.v)
        bottomY.v = topY.v
        this.insertLocalMinimaIntoAEL(bottomY.v)
      }

      // fix orientations ...
      for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
        const outerRectangle = this.outerPolygons[i]
        if (outerRectangle.points === null || outerRectangle.isOpen) continue
        // Jacob: fixed error here where boolean wasn't correctly being coerced to number (added + at start of each)
        if ((+outerRectangle.isHole ^ +this.reverseSolution) === +(this.area(outerRectangle.points) > 0))
          this.reversePolyPointLinks(outerRectangle.points)
      }

      this.joinCommonEdges()

      for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
        const outerRectangle = this.outerPolygons[i]
        if (outerRectangle.points === null) continue
        else if (outerRectangle.isOpen) this.fixupOutPolyline(outerRectangle)
        else this.fixupOutPolygon(outerRectangle)
      }

      if (this.strictlySimple) this.doSimplePolygons()
      return true
    } finally {
      //catch { return false; }
      this.joins.length = 0
      this.ghostJoins.length = 0
    }
  }

  public disposeAllPolyPoints() {
    for (let i = 0, len = this.outerPolygons.length; i < len; ++i) this.disposeOuterRectangle(i)
    ClipperLib.clear(this.outerPolygons)
  }

  public addJoin(outerPoint1: OuterPoint, outerPoint2: OuterPoint, offPoint: IntPoint) {
    const join = new Join()
    join.outerPoint1 = outerPoint1
    join.outerPoint2 = outerPoint2
    //j.OffPt = OffPt;
    join.offPoint.x = offPoint.x
    join.offPoint.y = offPoint.y
    if (ClipperLib.USE_XYZ) join.offPoint.z = offPoint.z
    this.joins.push(join)
  }

  public addGhostJoin(outerPoint: OuterPoint, offPoint: IntPoint) {
    const join = new Join()
    join.outerPoint1 = outerPoint
    //j.OffPt = OffPt;
    join.offPoint.x = offPoint.x
    join.offPoint.y = offPoint.y
    if (ClipperLib.USE_XYZ) join.offPoint.z = offPoint.z
    this.ghostJoins.push(join)
  }

  public setZ(pt: IntPoint, e1: TEdge, e2: TEdge) {
    if (ClipperLib.USE_XYZ) {
      if (this.zFillFunction !== null) {
        if (pt.z !== 0 || this.zFillFunction === null) return
        else if (IntPoint.op_Equality(pt, e1.bottom)) pt.z = e1.bottom.z
        else if (IntPoint.op_Equality(pt, e1.top)) pt.z = e1.top.z
        else if (IntPoint.op_Equality(pt, e2.bottom)) pt.z = e2.bottom.z
        else if (IntPoint.op_Equality(pt, e2.top)) pt.z = e2.top.z
        // TODO: look into this function
        // else this.ZFillFunction(e1.Bot, e1.Top, e2.Bot, e2.Top, pt)
      }
    }
  }

  public insertLocalMinimaIntoAEL(bottomY: number) {
    const localMinima = new LocalMinima()

    let leftBoundary: TEdge
    let rightBoundary: TEdge
    while (this.popLocalMinima(bottomY, localMinima)) {
      leftBoundary = localMinima.v.leftBoundary
      rightBoundary = localMinima.v.rightBoundary

      let Op1 = null
      if (leftBoundary === null) {
        this.insertEdgeIntoAEL(rightBoundary, null)
        this.setWindingCount(rightBoundary)
        if (this.isContributing(rightBoundary)) Op1 = this.addOuterPoint(rightBoundary, rightBoundary.bottom)
      } else if (rightBoundary === null) {
        this.insertEdgeIntoAEL(leftBoundary, null)
        this.setWindingCount(leftBoundary)
        if (this.isContributing(leftBoundary)) Op1 = this.addOuterPoint(leftBoundary, leftBoundary.bottom)
        this.insertScanbeam(leftBoundary.top.y)
      } else {
        this.insertEdgeIntoAEL(leftBoundary, null)
        this.insertEdgeIntoAEL(rightBoundary, leftBoundary)
        this.setWindingCount(leftBoundary)
        rightBoundary.windCount = leftBoundary.windCount
        rightBoundary.windCount2 = leftBoundary.windCount2
        if (this.isContributing(leftBoundary))
          Op1 = this.addLocalMinPoly(leftBoundary, rightBoundary, leftBoundary.bottom)
        this.insertScanbeam(leftBoundary.top.y)
      }
      if (rightBoundary !== null) {
        if (ClipperBase.isHorizontal(rightBoundary)) {
          if (rightBoundary.nextInLML !== null) {
            this.insertScanbeam(rightBoundary.nextInLML.top.y)
          }
          this.addEdgeToSEL(rightBoundary)
        } else {
          this.insertScanbeam(rightBoundary.top.y)
        }
      }
      if (leftBoundary === null || rightBoundary === null) continue
      // if output polygons share an Edge with a horizontal rb, they'll need joining later ...
      if (
        Op1 !== null &&
        ClipperBase.isHorizontal(rightBoundary) &&
        this.ghostJoins.length > 0 &&
        rightBoundary.windDelta !== 0
      ) {
        for (let i = 0, len = this.ghostJoins.length; i < len; i++) {
          // if the horizontal Rb and a 'ghost' horizontal overlap, then convert the 'ghost' join to a real join ready for later ...
          const j = this.ghostJoins[i]

          if (
            this.horizontalSegmentsOverlap(
              j.outerPoint1.point.x,
              j.offPoint.x,
              rightBoundary.bottom.x,
              rightBoundary.top.x
            )
          )
            this.addJoin(j.outerPoint1, Op1, j.offPoint)
        }
      }

      if (
        leftBoundary.outIndex >= 0 &&
        leftBoundary.prevInAEL !== null &&
        leftBoundary.prevInAEL.current.x === leftBoundary.bottom.x &&
        leftBoundary.prevInAEL.outIndex >= 0 &&
        ClipperBase.slopesEqual(
          leftBoundary.prevInAEL.current,
          leftBoundary.prevInAEL.top,
          leftBoundary.current,
          leftBoundary.top,
          this.useFullRange
        ) &&
        leftBoundary.windDelta !== 0 &&
        leftBoundary.prevInAEL.windDelta !== 0
      ) {
        const Op2 = this.addOuterPoint(leftBoundary.prevInAEL, leftBoundary.bottom)
        this.addJoin(Op1, Op2, leftBoundary.top)
      }
      if (leftBoundary.nextInAEL !== rightBoundary) {
        if (
          rightBoundary.outIndex >= 0 &&
          rightBoundary.prevInAEL.outIndex >= 0 &&
          ClipperBase.slopesEqual(
            rightBoundary.prevInAEL.current,
            rightBoundary.prevInAEL.top,
            rightBoundary.current,
            rightBoundary.top,
            this.useFullRange
          ) &&
          rightBoundary.windDelta !== 0 &&
          rightBoundary.prevInAEL.windDelta !== 0
        ) {
          const Op2 = this.addOuterPoint(rightBoundary.prevInAEL, rightBoundary.bottom)
          this.addJoin(Op1, Op2, rightBoundary.top)
        }
        let e = leftBoundary.nextInAEL
        if (e !== null)
          while (e !== rightBoundary) {
            // nb: For calculating winding counts etc, IntersectEdges() assumes
            // that param1 will be to the right of param2 ABOVE the intersection ...
            this.intersectEdges(rightBoundary, e, leftBoundary.current)
            //order important here
            e = e.nextInAEL
          }
      }
    }
  }

  public insertEdgeIntoAEL(edge: TEdge, startEdge: TEdge) {
    if (this.activeEdges === null) {
      edge.prevInAEL = null
      edge.nextInAEL = null
      this.activeEdges = edge
    } else if (startEdge === null && this.edge2InsertsBeforeEdge1(this.activeEdges, edge)) {
      edge.prevInAEL = null
      edge.nextInAEL = this.activeEdges
      this.activeEdges.prevInAEL = edge
      this.activeEdges = edge
    } else {
      if (startEdge === null) startEdge = this.activeEdges
      while (startEdge.nextInAEL !== null && !this.edge2InsertsBeforeEdge1(startEdge.nextInAEL, edge))
        startEdge = startEdge.nextInAEL
      edge.nextInAEL = startEdge.nextInAEL
      if (startEdge.nextInAEL !== null) startEdge.nextInAEL.prevInAEL = edge
      edge.prevInAEL = startEdge
      startEdge.nextInAEL = edge
    }
  }

  public edge2InsertsBeforeEdge1(e1: TEdge, e2: TEdge): boolean {
    if (e2.current.x === e1.current.x) {
      if (e2.top.y > e1.top.y) return e2.top.x < Clipper.topX(e1, e2.top.y)
      else return e1.top.x > Clipper.topX(e2, e1.top.y)
    } else return e2.current.x < e1.current.x
  }

  public isEvenOddFillType(edge: TEdge): boolean {
    if (edge.polyType === PolyType.subject) return this.subjectFillType === PolygonFillType.evenOdd
    else return this.clipFillType === PolygonFillType.evenOdd
  }

  public isEvenOddAltFillType(edge: TEdge): boolean {
    if (edge.polyType === PolyType.subject) return this.clipFillType === PolygonFillType.evenOdd
    else return this.subjectFillType === PolygonFillType.evenOdd
  }

  public isContributing(edge: TEdge): boolean {
    let polyFillType1: PolygonFillType, polyFillType2: PolygonFillType
    if (edge.polyType === PolyType.subject) {
      polyFillType1 = this.subjectFillType
      polyFillType2 = this.clipFillType
    } else {
      polyFillType1 = this.clipFillType
      polyFillType2 = this.subjectFillType
    }
    switch (polyFillType1) {
      case PolygonFillType.evenOdd:
        if (edge.windDelta === 0 && edge.windCount !== 1) return false
        break
      case PolygonFillType.nonZero:
        if (Math.abs(edge.windCount) !== 1) return false
        break
      case PolygonFillType.positive:
        if (edge.windCount !== 1) return false
        break
      default:
        if (edge.windCount !== -1) return false
        break
    }
    switch (this.clipType) {
      case ClipType.intersection:
        switch (polyFillType2) {
          case PolygonFillType.evenOdd:
          case PolygonFillType.nonZero:
            return edge.windCount2 !== 0
          case PolygonFillType.positive:
            return edge.windCount2 > 0
          default:
            return edge.windCount2 < 0
        }
      case ClipType.union:
        switch (polyFillType2) {
          case PolygonFillType.evenOdd:
          case PolygonFillType.nonZero:
            return edge.windCount2 === 0
          case PolygonFillType.positive:
            return edge.windCount2 <= 0
          default:
            return edge.windCount2 >= 0
        }
      case ClipType.difference:
        if (edge.polyType === PolyType.subject)
          switch (polyFillType2) {
            case PolygonFillType.evenOdd:
            case PolygonFillType.nonZero:
              return edge.windCount2 === 0
            case PolygonFillType.positive:
              return edge.windCount2 <= 0
            default:
              return edge.windCount2 >= 0
          }
        else
          switch (polyFillType2) {
            case PolygonFillType.evenOdd:
            case PolygonFillType.nonZero:
              return edge.windCount2 !== 0
            case PolygonFillType.positive:
              return edge.windCount2 > 0
            default:
              return edge.windCount2 < 0
          }
      case ClipType.xor:
        if (edge.windDelta === 0)
          switch (polyFillType2) {
            case PolygonFillType.evenOdd:
            case PolygonFillType.nonZero:
              return edge.windCount2 === 0
            case PolygonFillType.positive:
              return edge.windCount2 <= 0
            default:
              return edge.windCount2 >= 0
          }
        else return true
    }
    return true
  }

  public setWindingCount(edge: TEdge) {
    let prevEdgeInAEL = edge.prevInAEL
    // find the edge of the same polyType that immediately precedes 'edge' in AEL
    while (prevEdgeInAEL !== null && (prevEdgeInAEL.polyType !== edge.polyType || prevEdgeInAEL.windDelta === 0)) {
      prevEdgeInAEL = prevEdgeInAEL.prevInAEL
    }
    if (prevEdgeInAEL === null) {
      const polyFillType = edge.polyType === PolyType.subject ? this.subjectFillType : this.clipFillType
      if (edge.windDelta === 0) {
        edge.windCount = polyFillType === PolygonFillType.negative ? -1 : 1
      } else {
        edge.windCount = edge.windDelta
      }
      edge.windCount2 = 0
      prevEdgeInAEL = this.activeEdges
      //ie get ready to calc WindCnt2
    } else if (edge.windDelta === 0 && this.clipType !== ClipType.union) {
      edge.windCount = 1
      edge.windCount2 = prevEdgeInAEL.windCount2
      prevEdgeInAEL = prevEdgeInAEL.nextInAEL
      //ie get ready to calc WindCnt2
    } else if (this.isEvenOddFillType(edge)) {
      //EvenOdd filling ...
      if (edge.windDelta === 0) {
        //are we inside a subj polygon ...
        let Inside = true
        let e2 = prevEdgeInAEL.prevInAEL
        while (e2 !== null) {
          if (e2.polyType === prevEdgeInAEL.polyType && e2.windDelta !== 0) Inside = !Inside
          e2 = e2.prevInAEL
        }
        edge.windCount = Inside ? 0 : 1
      } else {
        edge.windCount = edge.windDelta
      }
      edge.windCount2 = prevEdgeInAEL.windCount2
      prevEdgeInAEL = prevEdgeInAEL.nextInAEL
      //ie get ready to calc WindCnt2
    } else {
      //nonZero, Positive or Negative filling ...
      if (prevEdgeInAEL.windCount * prevEdgeInAEL.windDelta < 0) {
        //prev edge is 'decreasing' WindCount (WC) toward zero
        //so we're outside the previous polygon ...
        if (Math.abs(prevEdgeInAEL.windCount) > 1) {
          //outside prev poly but still inside another.
          //when reversing direction of prev poly use the same WC
          if (prevEdgeInAEL.windDelta * edge.windDelta < 0) edge.windCount = prevEdgeInAEL.windCount
          else edge.windCount = prevEdgeInAEL.windCount + edge.windDelta
        } else edge.windCount = edge.windDelta === 0 ? 1 : edge.windDelta
      } else {
        //prev edge is 'increasing' WindCount (WC) away from zero
        //so we're inside the previous polygon ...
        if (edge.windDelta === 0)
          edge.windCount = prevEdgeInAEL.windCount < 0 ? prevEdgeInAEL.windCount - 1 : prevEdgeInAEL.windCount + 1
        else if (prevEdgeInAEL.windDelta * edge.windDelta < 0) edge.windCount = prevEdgeInAEL.windCount
        else edge.windCount = prevEdgeInAEL.windCount + edge.windDelta
      }
      edge.windCount2 = prevEdgeInAEL.windCount2
      prevEdgeInAEL = prevEdgeInAEL.nextInAEL
      //ie get ready to calc WindCnt2
    }
    //update WindCnt2 ...
    if (this.isEvenOddAltFillType(edge)) {
      //EvenOdd filling ...
      while (prevEdgeInAEL !== edge) {
        if (prevEdgeInAEL.windDelta !== 0) edge.windCount2 = edge.windCount2 === 0 ? 1 : 0
        prevEdgeInAEL = prevEdgeInAEL.nextInAEL
      }
    } else {
      //nonZero, Positive or Negative filling ...
      while (prevEdgeInAEL !== edge) {
        edge.windCount2 += prevEdgeInAEL.windDelta
        prevEdgeInAEL = prevEdgeInAEL.nextInAEL
      }
    }
  }

  public addEdgeToSEL(edge: TEdge) {
    // SEL pointers in PEdge are use to build transient lists of horizontal edges.
    // However, since we don't need to worry about processing order, all additions
    // are made to the front of the list ...
    if (this.sortedEdges === null) {
      this.sortedEdges = edge
      edge.prevInSEL = null
      edge.nextInSEL = null
    } else {
      edge.nextInSEL = this.sortedEdges
      edge.prevInSEL = null
      this.sortedEdges.prevInSEL = edge
      this.sortedEdges = edge
    }
  }

  public popEdgeFromSEL(edge: TEdge) {
    // Pop edge from front of SEL (ie SEL is a FILO list)
    edge.v = this.sortedEdges
    if (edge.v === null) return false
    const oldE = edge.v
    this.sortedEdges = edge.v.nextInSEL
    if (this.sortedEdges !== null) {
      this.sortedEdges.prevInSEL = null
    }
    oldE.nextInSEL = null
    oldE.prevInSEL = null
    return true
  }

  public copyAELToSEL() {
    let e = this.activeEdges
    this.sortedEdges = e
    while (e !== null) {
      e.prevInSEL = e.prevInAEL
      e.nextInSEL = e.nextInAEL
      e = e.nextInAEL
    }
  }

  public swapPositionsInSEL(edge1: TEdge, edge2: TEdge) {
    if (edge1.nextInSEL === null && edge1.prevInSEL === null) return
    if (edge2.nextInSEL === null && edge2.prevInSEL === null) return
    if (edge1.nextInSEL === edge2) {
      const next = edge2.nextInSEL
      if (next !== null) next.prevInSEL = edge1
      const prev = edge1.prevInSEL
      if (prev !== null) prev.nextInSEL = edge2
      edge2.prevInSEL = prev
      edge2.nextInSEL = edge1
      edge1.prevInSEL = edge2
      edge1.nextInSEL = next
    } else if (edge2.nextInSEL === edge1) {
      const next = edge1.nextInSEL
      if (next !== null) next.prevInSEL = edge2
      const prev = edge2.prevInSEL
      if (prev !== null) prev.nextInSEL = edge1
      edge1.prevInSEL = prev
      edge1.nextInSEL = edge2
      edge2.prevInSEL = edge1
      edge2.nextInSEL = next
    } else {
      const next = edge1.nextInSEL
      const prev = edge1.prevInSEL
      edge1.nextInSEL = edge2.nextInSEL
      if (edge1.nextInSEL !== null) edge1.nextInSEL.prevInSEL = edge1
      edge1.prevInSEL = edge2.prevInSEL
      if (edge1.prevInSEL !== null) edge1.prevInSEL.nextInSEL = edge1
      edge2.nextInSEL = next
      if (edge2.nextInSEL !== null) edge2.nextInSEL.prevInSEL = edge2
      edge2.prevInSEL = prev
      if (edge2.prevInSEL !== null) edge2.prevInSEL.nextInSEL = edge2
    }
    if (edge1.prevInSEL === null) this.sortedEdges = edge1
    else if (edge2.prevInSEL === null) this.sortedEdges = edge2
  }

  public addLocalMaxPoly(edge1: TEdge, edge2: TEdge, point: IntPoint) {
    this.addOuterPoint(edge1, point)
    if (edge2.windDelta === 0) this.addOuterPoint(edge2, point)
    if (edge1.outIndex === edge2.outIndex) {
      edge1.outIndex = -1
      edge2.outIndex = -1
    } else if (edge1.outIndex < edge2.outIndex) this.appendPolygon(edge1, edge2)
    else this.appendPolygon(edge2, edge1)
  }

  public addLocalMinPoly(edge1: TEdge, edge2: TEdge, point: IntPoint) {
    let result: OuterPoint
    let edge: TEdge, prevEdge: TEdge
    if (ClipperBase.isHorizontal(edge2) || edge1.dx > edge2.dx) {
      result = this.addOuterPoint(edge1, point)
      edge2.outIndex = edge1.outIndex
      edge1.side = EdgeSide.left
      edge2.side = EdgeSide.right
      edge = edge1
      if (edge.prevInAEL === edge2) prevEdge = edge2.prevInAEL
      else prevEdge = edge.prevInAEL
    } else {
      result = this.addOuterPoint(edge2, point)
      edge1.outIndex = edge2.outIndex
      edge1.side = EdgeSide.right
      edge2.side = EdgeSide.left
      edge = edge2
      if (edge.prevInAEL === edge1) prevEdge = edge1.prevInAEL
      else prevEdge = edge.prevInAEL
    }

    if (prevEdge !== null && prevEdge.outIndex >= 0 && prevEdge.top.y < point.y && edge.top.y < point.y) {
      const prevTopX = Clipper.topX(prevEdge, point.y)
      const topX = Clipper.topX(edge, point.y)
      if (
        prevTopX === topX &&
        edge.windDelta !== 0 &&
        prevEdge.windDelta !== 0 &&
        ClipperBase.slopesEqual(
          new IntPoint(prevTopX, point.y),
          prevEdge.top,
          new IntPoint(topX, point.y),
          edge.top,
          this.useFullRange
        )
      ) {
        const outerPoint = this.addOuterPoint(prevEdge, point)
        this.addJoin(result, outerPoint, edge.top)
      }
    }
    return result
  }

  public addOuterPoint(e: TEdge, pt: IntPoint) {
    if (e.outIndex < 0) {
      const outerRectangle = this.createOuterRectangle()
      outerRectangle.isOpen = e.windDelta === 0

      const newOuterPoint = new OuterPoint()
      outerRectangle.points = newOuterPoint
      newOuterPoint.index = outerRectangle.index
      //newOuterPoint.Pt = pt;
      newOuterPoint.point.x = pt.x
      newOuterPoint.point.y = pt.y

      if (ClipperLib.USE_XYZ) newOuterPoint.point.z = pt.z
      newOuterPoint.next = newOuterPoint
      newOuterPoint.prev = newOuterPoint

      if (!outerRectangle.isOpen) this.setHoleState(e, outerRectangle)
      e.outIndex = outerRectangle.index
      //nb: do this after SetZ !
      return newOuterPoint
    } else {
      const outerRectangle = this.outerPolygons[e.outIndex]
      //OutRec.Pts is the 'Left-most' point & OutRec.Pts.Prev is the 'Right-most'
      const outerPoints = outerRectangle.points
      const toFront = e.side === EdgeSide.left
      if (toFront && IntPoint.op_Equality(pt, outerPoints.point)) return outerPoints
      else if (!toFront && IntPoint.op_Equality(pt, outerPoints.prev.point)) return outerPoints.prev
      const newOuterPoint = new OuterPoint()
      newOuterPoint.index = outerRectangle.index
      //newOuterPoint.Pt = pt;
      newOuterPoint.point.x = pt.x
      newOuterPoint.point.y = pt.y
      if (ClipperLib.USE_XYZ) newOuterPoint.point.z = pt.z
      newOuterPoint.next = outerPoints
      newOuterPoint.prev = outerPoints.prev
      newOuterPoint.prev.next = newOuterPoint
      outerPoints.prev = newOuterPoint
      if (toFront) outerRectangle.points = newOuterPoint
      return newOuterPoint
    }
  }

  public getLastOutPoint(edge: TEdge) {
    const outerRectangle = this.outerPolygons[edge.outIndex]
    if (edge.side === EdgeSide.left) {
      return outerRectangle.points
    } else {
      return outerRectangle.points.prev
    }
  }

  /*
  // Jacob: unused I think
  public SwapPoints(pt1, pt2) {
    const tmp = new IntPoint(pt1.Value)
    //pt1.Value = pt2.Value;
    pt1.Value.X = pt2.Value.X
    pt1.Value.Y = pt2.Value.Y
    if (ClipperLib.use_xyz) pt1.Value.Z = pt2.Value.Z
    //pt2.Value = tmp;
    pt2.Value.X = tmp.X
    pt2.Value.Y = tmp.Y
    if (ClipperLib.use_xyz) pt2.Value.Z = tmp.Z
  }
  */

  public horizontalSegmentsOverlap(seg1a: number, seg1b: number, seg2a: number, seg2b: number): boolean {
    let tmp: number
    if (seg1a > seg1b) {
      tmp = seg1a
      seg1a = seg1b
      seg1b = tmp
    }
    if (seg2a > seg2b) {
      tmp = seg2a
      seg2a = seg2b
      seg2b = tmp
    }
    return seg1a < seg2b && seg2a < seg1b
  }

  public setHoleState(edge: TEdge, outerRectangle: OuterRectangle) {
    let prevEdgeInAEL = edge.prevInAEL
    let edgeTmp: TEdge | null = null
    while (prevEdgeInAEL !== null) {
      if (prevEdgeInAEL.outIndex >= 0 && prevEdgeInAEL.windDelta !== 0) {
        if (edgeTmp === null) edgeTmp = prevEdgeInAEL
        else if (edgeTmp.outIndex === prevEdgeInAEL.outIndex) edgeTmp = null //paired
      }
      prevEdgeInAEL = prevEdgeInAEL.prevInAEL
    }

    if (edgeTmp === null) {
      outerRectangle.firstLeft = null
      outerRectangle.isHole = false
    } else {
      outerRectangle.firstLeft = this.outerPolygons[edgeTmp.outIndex]
      outerRectangle.isHole = !outerRectangle.firstLeft.isHole
    }
  }

  public getDx(pt1: IntPoint, pt2: IntPoint) {
    if (pt1.y === pt2.y) return ClipperBase.HORIZONTAL
    else return (pt2.x - pt1.x) / (pt2.y - pt1.y)
  }

  public firstIsBottomPoint(btmPt1: OuterPoint, btmPt2: OuterPoint): boolean {
    let p = btmPt1.prev
    while (IntPoint.op_Equality(p.point, btmPt1.point) && p !== btmPt1) p = p.prev
    const dx1p = Math.abs(this.getDx(btmPt1.point, p.point))
    p = btmPt1.next
    while (IntPoint.op_Equality(p.point, btmPt1.point) && p !== btmPt1) p = p.next
    const dx1n = Math.abs(this.getDx(btmPt1.point, p.point))
    p = btmPt2.prev
    while (IntPoint.op_Equality(p.point, btmPt2.point) && p !== btmPt2) p = p.prev
    const dx2p = Math.abs(this.getDx(btmPt2.point, p.point))
    p = btmPt2.next
    while (IntPoint.op_Equality(p.point, btmPt2.point) && p !== btmPt2) p = p.next
    const dx2n = Math.abs(this.getDx(btmPt2.point, p.point))

    if (Math.max(dx1p, dx1n) === Math.max(dx2p, dx2n) && Math.min(dx1p, dx1n) === Math.min(dx2p, dx2n)) {
      return this.area(btmPt1) > 0 //if otherwise identical use orientation
    } else {
      return (dx1p >= dx2p && dx1p >= dx2n) || (dx1n >= dx2p && dx1n >= dx2n)
    }
  }

  public getBottomPoint(outerPoint: OuterPoint) {
    let duplicates = null
    let nextOutPoint = outerPoint.next
    while (nextOutPoint !== outerPoint) {
      if (nextOutPoint.point.y > outerPoint.point.y) {
        outerPoint = nextOutPoint
        duplicates = null
      } else if (nextOutPoint.point.y === outerPoint.point.y && nextOutPoint.point.x <= outerPoint.point.x) {
        if (nextOutPoint.point.x < outerPoint.point.x) {
          duplicates = null
          outerPoint = nextOutPoint
        } else {
          if (nextOutPoint.next !== outerPoint && nextOutPoint.prev !== outerPoint) duplicates = nextOutPoint
        }
      }
      nextOutPoint = nextOutPoint.next
    }
    if (duplicates !== null) {
      //there appears to be at least 2 vertices at bottomPt so ...
      while (duplicates !== nextOutPoint) {
        if (!this.firstIsBottomPoint(nextOutPoint, duplicates)) outerPoint = duplicates
        duplicates = duplicates.next
        while (IntPoint.op_Inequality(duplicates.point, outerPoint.point)) duplicates = duplicates.next
      }
    }
    return outerPoint
  }

  public getLowermostRec(outerRectangle1: OuterRectangle, outerRectangle2: OuterRectangle) {
    //work out which polygon fragment has the correct hole state ...
    if (outerRectangle1.bottomPoint === null) outerRectangle1.bottomPoint = this.getBottomPoint(outerRectangle1.points)
    if (outerRectangle2.bottomPoint === null) outerRectangle2.bottomPoint = this.getBottomPoint(outerRectangle2.points)
    const bottomPoint1 = outerRectangle1.bottomPoint
    const bottomPoint2 = outerRectangle2.bottomPoint
    if (bottomPoint1.point.y > bottomPoint2.point.y) return outerRectangle1
    else if (bottomPoint1.point.y < bottomPoint2.point.y) return outerRectangle2
    else if (bottomPoint1.point.x < bottomPoint2.point.x) return outerRectangle1
    else if (bottomPoint1.point.x > bottomPoint2.point.x) return outerRectangle2
    else if (bottomPoint1.next === bottomPoint1) return outerRectangle2
    else if (bottomPoint2.next === bottomPoint2) return outerRectangle1
    else if (this.firstIsBottomPoint(bottomPoint1, bottomPoint2)) return outerRectangle1
    else return outerRectangle2
  }

  public outerRectangle1RightOfOutRec2(outerRectangle1: OuterRectangle, outerRectangle2: OuterRectangle): boolean {
    do {
      outerRectangle1 = outerRectangle1.firstLeft
      if (outerRectangle1 === outerRectangle2) return true
    } while (outerRectangle1 !== null)
    return false
  }

  public getOutRec(index: number) {
    let outerRectangle = this.outerPolygons[index]
    while (outerRectangle !== this.outerPolygons[outerRectangle.index])
      outerRectangle = this.outerPolygons[outerRectangle.index]
    return outerRectangle
  }

  public appendPolygon(edge1: TEdge, edge2: TEdge) {
    // get the start and ends of both output polygons ...
    const outerRectangle1 = this.outerPolygons[edge1.outIndex]
    const outerRectangle2 = this.outerPolygons[edge2.outIndex]
    let holeStateRec: OuterRectangle
    if (this.outerRectangle1RightOfOutRec2(outerRectangle1, outerRectangle2)) holeStateRec = outerRectangle2
    else if (this.outerRectangle1RightOfOutRec2(outerRectangle2, outerRectangle1)) holeStateRec = outerRectangle1
    else holeStateRec = this.getLowermostRec(outerRectangle1, outerRectangle2)

    // get the start and ends of both output polygons and
    // join E2 poly onto E1 poly and delete pointers to E2 ...
    const p1_left = outerRectangle1.points
    const p1_right = p1_left.prev
    const p2_left = outerRectangle2.points
    const p2_right = p2_left.prev

    // join e2 poly onto e1 poly and delete pointers to e2 ...
    if (edge1.side === EdgeSide.left) {
      if (edge2.side === EdgeSide.left) {
        // z y x a b c
        this.reversePolyPointLinks(p2_left)
        p2_left.next = p1_left
        p1_left.prev = p2_left
        p1_right.next = p2_right
        p2_right.prev = p1_right
        outerRectangle1.points = p2_right
      } else {
        // x y z a b c
        p2_right.next = p1_left
        p1_left.prev = p2_right
        p2_left.prev = p1_right
        p1_right.next = p2_left
        outerRectangle1.points = p2_left
      }
    } else {
      if (edge2.side === EdgeSide.right) {
        // a b c z y x
        this.reversePolyPointLinks(p2_left)
        p1_right.next = p2_right
        p2_right.prev = p1_right
        p2_left.next = p1_left
        p1_left.prev = p2_left
      } else {
        // a b c x y z
        p1_right.next = p2_left
        p2_left.prev = p1_right
        p1_left.prev = p2_right
        p2_right.next = p1_left
      }
    }
    outerRectangle1.bottomPoint = null
    if (holeStateRec === outerRectangle2) {
      if (outerRectangle2.firstLeft !== outerRectangle1) outerRectangle1.firstLeft = outerRectangle2.firstLeft
      outerRectangle1.isHole = outerRectangle2.isHole
    }
    outerRectangle2.points = null
    outerRectangle2.bottomPoint = null
    outerRectangle2.firstLeft = outerRectangle1
    const okIndex = edge1.outIndex
    const obsoleteIndex = edge2.outIndex
    edge1.outIndex = -1

    // nb: safe because we only get here via AddLocalMaxPoly
    edge2.outIndex = -1
    let e = this.activeEdges
    while (e !== null) {
      if (e.outIndex === obsoleteIndex) {
        e.outIndex = okIndex
        e.side = edge1.side
        break
      }
      e = e.nextInAEL
    }
    outerRectangle2.index = outerRectangle1.index
  }

  public reversePolyPointLinks(pp: OuterPoint) {
    if (pp === null) return
    let pp1: OuterPoint
    let pp2: OuterPoint
    pp1 = pp
    do {
      pp2 = pp1.next
      pp1.next = pp1.prev
      pp1.prev = pp2
      pp1 = pp2
    } while (pp1 !== pp)
  }

  public static swapSides(edge1: TEdge, edge2: TEdge) {
    const side = edge1.side
    edge1.side = edge2.side
    edge2.side = side
  }

  public static swapPolyIndexes(edge1: TEdge, edge2: TEdge) {
    const outIdx = edge1.outIndex
    edge1.outIndex = edge2.outIndex
    edge2.outIndex = outIdx
  }

  public intersectEdges(edge1: TEdge, edge2: TEdge, point: IntPoint) {
    //e1 will be to the left of e2 BELOW the intersection. Therefore e1 is before
    //e2 in AEL except when e1 is being inserted at the intersection point ...
    const e1Contributing = edge1.outIndex >= 0
    const e2Contributing = edge2.outIndex >= 0

    if (ClipperLib.USE_XYZ) this.setZ(point, edge1, edge2)

    if (ClipperLib.use_lines) {
      // if either edge is on an OPEN path ...
      if (edge1.windDelta === 0 || edge2.windDelta === 0) {
        // ignore subject-subject open path intersections UNLESS they
        // are both open paths, AND they are both 'contributing maximas' ...
        if (edge1.windDelta === 0 && edge2.windDelta === 0) return
        // if intersecting a subj line with a subj poly ...
        else if (
          edge1.polyType === edge2.polyType &&
          edge1.windDelta !== edge2.windDelta &&
          this.clipType === ClipType.union
        ) {
          if (edge1.windDelta === 0) {
            if (e2Contributing) {
              this.addOuterPoint(edge1, point)
              if (e1Contributing) edge1.outIndex = -1
            }
          } else {
            if (e1Contributing) {
              this.addOuterPoint(edge2, point)
              if (e2Contributing) edge2.outIndex = -1
            }
          }
        } else if (edge1.polyType !== edge2.polyType) {
          if (
            edge1.windDelta === 0 &&
            Math.abs(edge2.windCount) === 1 &&
            (this.clipType !== ClipType.union || edge2.windCount2 === 0)
          ) {
            this.addOuterPoint(edge1, point)
            if (e1Contributing) edge1.outIndex = -1
          } else if (
            edge2.windDelta === 0 &&
            Math.abs(edge1.windCount) === 1 &&
            (this.clipType !== ClipType.union || edge1.windCount2 === 0)
          ) {
            this.addOuterPoint(edge2, point)
            if (e2Contributing) edge2.outIndex = -1
          }
        }
        return
      }
    }

    // update winding counts...
    // assumes that e1 will be to the Right of e2 ABOVE the intersection
    if (edge1.polyType === edge2.polyType) {
      if (this.isEvenOddFillType(edge1)) {
        const oldE1WindCnt = edge1.windCount
        edge1.windCount = edge2.windCount
        edge2.windCount = oldE1WindCnt
      } else {
        if (edge1.windCount + edge2.windDelta === 0) edge1.windCount = -edge1.windCount
        else edge1.windCount += edge2.windDelta
        if (edge2.windCount - edge1.windDelta === 0) edge2.windCount = -edge2.windCount
        else edge2.windCount -= edge1.windDelta
      }
    } else {
      if (!this.isEvenOddFillType(edge2)) edge1.windCount2 += edge2.windDelta
      else edge1.windCount2 = edge1.windCount2 === 0 ? 1 : 0
      if (!this.isEvenOddFillType(edge1)) edge2.windCount2 -= edge1.windDelta
      else edge2.windCount2 = edge2.windCount2 === 0 ? 1 : 0
    }

    let e1FillType1: PolygonFillType,
      e2FillType1: PolygonFillType,
      e1FillType2: PolygonFillType,
      e2FillType2: PolygonFillType
    if (edge1.polyType === PolyType.subject) {
      e1FillType1 = this.subjectFillType
      e1FillType2 = this.clipFillType
    } else {
      e1FillType1 = this.clipFillType
      e1FillType2 = this.subjectFillType
    }
    if (edge2.polyType === PolyType.subject) {
      e2FillType1 = this.subjectFillType
      e2FillType2 = this.clipFillType
    } else {
      e2FillType1 = this.clipFillType
      e2FillType2 = this.subjectFillType
    }
    let e1WindCount: number, e2WindCount: number
    switch (e1FillType1) {
      case PolygonFillType.positive:
        e1WindCount = edge1.windCount
        break
      case PolygonFillType.negative:
        e1WindCount = -edge1.windCount
        break
      default:
        e1WindCount = Math.abs(edge1.windCount)
        break
    }
    switch (e2FillType1) {
      case PolygonFillType.positive:
        e2WindCount = edge2.windCount
        break
      case PolygonFillType.negative:
        e2WindCount = -edge2.windCount
        break
      default:
        e2WindCount = Math.abs(edge2.windCount)
        break
    }
    if (e1Contributing && e2Contributing) {
      if (
        (e1WindCount !== 0 && e1WindCount !== 1) ||
        (e2WindCount !== 0 && e2WindCount !== 1) ||
        (edge1.polyType !== edge2.polyType && this.clipType !== ClipType.xor)
      ) {
        this.addLocalMaxPoly(edge1, edge2, point)
      } else {
        this.addOuterPoint(edge1, point)
        this.addOuterPoint(edge2, point)
        Clipper.swapSides(edge1, edge2)
        Clipper.swapPolyIndexes(edge1, edge2)
      }
    } else if (e1Contributing) {
      if (e2WindCount === 0 || e2WindCount === 1) {
        this.addOuterPoint(edge1, point)
        Clipper.swapSides(edge1, edge2)
        Clipper.swapPolyIndexes(edge1, edge2)
      }
    } else if (e2Contributing) {
      if (e1WindCount === 0 || e1WindCount === 1) {
        this.addOuterPoint(edge2, point)
        Clipper.swapSides(edge1, edge2)
        Clipper.swapPolyIndexes(edge1, edge2)
      }
    } else if ((e1WindCount === 0 || e1WindCount === 1) && (e2WindCount === 0 || e2WindCount === 1)) {
      //neither edge is currently contributing ...
      let e1WindCount2: number, e2WindCount2: number
      switch (e1FillType2) {
        case PolygonFillType.positive:
          e1WindCount2 = edge1.windCount2
          break
        case PolygonFillType.negative:
          e1WindCount2 = -edge1.windCount2
          break
        default:
          e1WindCount2 = Math.abs(edge1.windCount2)
          break
      }
      switch (e2FillType2) {
        case PolygonFillType.positive:
          e2WindCount2 = edge2.windCount2
          break
        case PolygonFillType.negative:
          e2WindCount2 = -edge2.windCount2
          break
        default:
          e2WindCount2 = Math.abs(edge2.windCount2)
          break
      }
      if (edge1.polyType !== edge2.polyType) {
        this.addLocalMinPoly(edge1, edge2, point)
      } else if (e1WindCount === 1 && e2WindCount === 1)
        switch (this.clipType) {
          case ClipType.intersection:
            if (e1WindCount2 > 0 && e2WindCount2 > 0) this.addLocalMinPoly(edge1, edge2, point)
            break
          case ClipType.union:
            if (e1WindCount2 <= 0 && e2WindCount2 <= 0) this.addLocalMinPoly(edge1, edge2, point)
            break
          case ClipType.difference:
            if (
              (edge1.polyType === PolyType.clip && e1WindCount2 > 0 && e2WindCount2 > 0) ||
              (edge1.polyType === PolyType.subject && e1WindCount2 <= 0 && e2WindCount2 <= 0)
            )
              this.addLocalMinPoly(edge1, edge2, point)
            break
          case ClipType.xor:
            this.addLocalMinPoly(edge1, edge2, point)
            break
        }
      else Clipper.swapSides(edge1, edge2)
    }
  }

  public deleteFromSEL(edge: TEdge) {
    const prevSEL = edge.prevInSEL
    const nextSEL = edge.nextInSEL
    if (prevSEL === null && nextSEL === null && edge !== this.sortedEdges) return
    //already deleted
    if (prevSEL !== null) prevSEL.nextInSEL = nextSEL
    else this.sortedEdges = nextSEL
    if (nextSEL !== null) nextSEL.prevInSEL = prevSEL
    edge.nextInSEL = null
    edge.prevInSEL = null
  }

  public processHorizontals() {
    const horizontalEdge = new TEdge() // {} //m_SortedEdges;
    while (this.popEdgeFromSEL(horizontalEdge)) {
      this.processHorizontal(horizontalEdge.v)
    }
  }

  public getHorizontalDirection(horizontalEdge: TEdge, $var: HorizontalEdgeProps) {
    if (horizontalEdge.bottom.x < horizontalEdge.top.x) {
      $var.left = horizontalEdge.bottom.x
      $var.right = horizontalEdge.top.x
      $var.direction = Direction.leftToRight
    } else {
      $var.left = horizontalEdge.top.x
      $var.right = horizontalEdge.bottom.x
      $var.direction = Direction.rightToLeft
    }
  }

  public processHorizontal(horizontalEdge: TEdge) {
    const $var: HorizontalEdgeProps = {
      direction: null,
      left: null,
      right: null,
    }

    this.getHorizontalDirection(horizontalEdge, $var)
    let direction = $var.direction
    let horizontalLeft = $var.left
    let horizontalRight = $var.right

    const isOpen = horizontalEdge.windDelta === 0

    let lastHorizontalEdge = horizontalEdge,
      edgeMaxPair: TEdge = null
    while (lastHorizontalEdge.nextInLML !== null && ClipperBase.isHorizontal(lastHorizontalEdge.nextInLML))
      lastHorizontalEdge = lastHorizontalEdge.nextInLML
    if (lastHorizontalEdge.nextInLML === null) edgeMaxPair = this.getMaximaPair(lastHorizontalEdge)

    let currMax = this.maxima
    if (currMax !== null) {
      //get the first maxima in range (X) ...
      if (direction === Direction.leftToRight) {
        while (currMax !== null && currMax.x <= horizontalEdge.bottom.x) {
          currMax = currMax.next
        }
        if (currMax !== null && currMax.x >= lastHorizontalEdge.top.x) {
          currMax = null
        }
      } else {
        while (currMax.next !== null && currMax.next.x < horizontalEdge.bottom.x) {
          currMax = currMax.next
        }
        if (currMax.x <= lastHorizontalEdge.top.x) {
          currMax = null
        }
      }
    }

    let outerPoint1: OuterPoint | null = null
    for (;;) //loop through consecutive horizontal edges
    {
      const isLastHorizontal = horizontalEdge === lastHorizontalEdge
      let edge = this.getNextInAEL(horizontalEdge, direction)
      while (edge !== null) {
        // This code block inserts extra coords into horizontal edges (in output polygons)
        // wherever maxima touch these horizontal edges.
        // This helps 'simplifying' polygons (ie if the Simplify property is set).
        if (currMax !== null) {
          if (direction === Direction.leftToRight) {
            while (currMax !== null && currMax.x < edge.current.x) {
              if (horizontalEdge.outIndex >= 0 && !isOpen) {
                this.addOuterPoint(horizontalEdge, new IntPoint(currMax.x, horizontalEdge.bottom.y))
              }
              currMax = currMax.next
            }
          } else {
            while (currMax !== null && currMax.x > edge.current.x) {
              if (horizontalEdge.outIndex >= 0 && !isOpen) {
                this.addOuterPoint(horizontalEdge, new IntPoint(currMax.x, horizontalEdge.bottom.y))
              }
              currMax = currMax.prev
            }
          }
        }

        if (
          (direction === Direction.leftToRight && edge.current.x > horizontalRight) ||
          (direction === Direction.rightToLeft && edge.current.x < horizontalLeft)
        ) {
          break
        }

        //Also break if we've got to the end of an intermediate horizontal edge ...
        //nb: Smaller Dx's are to the right of larger Dx's ABOVE the horizontal.
        if (
          edge.current.x === horizontalEdge.top.x &&
          horizontalEdge.nextInLML !== null &&
          edge.dx < horizontalEdge.nextInLML.dx
        )
          break

        if (horizontalEdge.outIndex >= 0 && !isOpen) {
          //note: may be done multiple times
          if (ClipperLib.USE_XYZ) {
            if (direction === Direction.leftToRight) this.setZ(edge.current, horizontalEdge, edge)
            else this.setZ(edge.current, edge, horizontalEdge)
          }

          outerPoint1 = this.addOuterPoint(horizontalEdge, edge.current)
          let nextEdgeHorizontal = this.sortedEdges
          while (nextEdgeHorizontal !== null) {
            if (
              nextEdgeHorizontal.outIndex >= 0 &&
              this.horizontalSegmentsOverlap(
                horizontalEdge.bottom.x,
                horizontalEdge.top.x,
                nextEdgeHorizontal.bottom.x,
                nextEdgeHorizontal.top.x
              )
            ) {
              const outerPoint2 = this.getLastOutPoint(nextEdgeHorizontal)
              this.addJoin(outerPoint2, outerPoint1, nextEdgeHorizontal.top)
            }
            nextEdgeHorizontal = nextEdgeHorizontal.nextInSEL
          }
          this.addGhostJoin(outerPoint1, horizontalEdge.bottom)
        }

        // OK, so far we're still in range of the horizontal Edge  but make sure
        // we're at the last of consecutively horizontals when matching with eMaxPair
        if (edge === edgeMaxPair && isLastHorizontal) {
          if (horizontalEdge.outIndex >= 0) {
            this.addLocalMaxPoly(horizontalEdge, edgeMaxPair, horizontalEdge.top)
          }
          this.deleteFromAEL(horizontalEdge)
          this.deleteFromAEL(edgeMaxPair)
          return
        }

        if (direction === Direction.leftToRight) {
          const Pt = new IntPoint(edge.current.x, horizontalEdge.current.y)
          this.intersectEdges(horizontalEdge, edge, Pt)
        } else {
          const Pt = new IntPoint(edge.current.x, horizontalEdge.current.y)
          this.intersectEdges(edge, horizontalEdge, Pt)
        }
        const eNext = this.getNextInAEL(edge, direction)
        this.swapPositionsInAEL(horizontalEdge, edge)
        edge = eNext
      } //end while(e !== null)

      // Break out of loop if HorizontalEdge.NextInLML is not also horizontal ...
      if (horizontalEdge.nextInLML === null || !ClipperBase.isHorizontal(horizontalEdge.nextInLML)) {
        break
      }

      horizontalEdge = this.updateEdgeIntoAEL(horizontalEdge)
      if (horizontalEdge.outIndex >= 0) {
        this.addOuterPoint(horizontalEdge, horizontalEdge.bottom)
      }

      const $var: HorizontalEdgeProps = {
        direction: direction,
        left: horizontalLeft,
        right: horizontalRight,
      }

      this.getHorizontalDirection(horizontalEdge, $var)
      direction = $var.direction
      horizontalLeft = $var.left
      horizontalRight = $var.right
    } //end for (;;)

    if (horizontalEdge.outIndex >= 0 && outerPoint1 === null) {
      outerPoint1 = this.getLastOutPoint(horizontalEdge)
      let nextEdgeHorizontal = this.sortedEdges
      while (nextEdgeHorizontal !== null) {
        if (
          nextEdgeHorizontal.outIndex >= 0 &&
          this.horizontalSegmentsOverlap(
            horizontalEdge.bottom.x,
            horizontalEdge.top.x,
            nextEdgeHorizontal.bottom.x,
            nextEdgeHorizontal.top.x
          )
        ) {
          const outerPoint2 = this.getLastOutPoint(nextEdgeHorizontal)
          this.addJoin(outerPoint2, outerPoint1, nextEdgeHorizontal.top)
        }
        nextEdgeHorizontal = nextEdgeHorizontal.nextInSEL
      }
      this.addGhostJoin(outerPoint1, horizontalEdge.top)
    }

    if (horizontalEdge.nextInLML !== null) {
      if (horizontalEdge.outIndex >= 0) {
        outerPoint1 = this.addOuterPoint(horizontalEdge, horizontalEdge.top)

        horizontalEdge = this.updateEdgeIntoAEL(horizontalEdge)
        if (horizontalEdge.windDelta === 0) {
          return
        }
        //nb: HorizontalEdge is no longer horizontal here
        const prevEdge = horizontalEdge.prevInAEL
        const nextEdge = horizontalEdge.nextInAEL
        if (
          prevEdge !== null &&
          prevEdge.current.x === horizontalEdge.bottom.x &&
          prevEdge.current.y === horizontalEdge.bottom.y &&
          prevEdge.windDelta === 0 &&
          prevEdge.outIndex >= 0 &&
          prevEdge.current.y > prevEdge.top.y &&
          ClipperBase.slopesEqual(horizontalEdge, prevEdge, this.useFullRange)
        ) {
          const outerPoint2 = this.addOuterPoint(prevEdge, horizontalEdge.bottom)
          this.addJoin(outerPoint1, outerPoint2, horizontalEdge.top)
        } else if (
          nextEdge !== null &&
          nextEdge.current.x === horizontalEdge.bottom.x &&
          nextEdge.current.y === horizontalEdge.bottom.y &&
          nextEdge.windDelta !== 0 &&
          nextEdge.outIndex >= 0 &&
          nextEdge.current.y > nextEdge.top.y &&
          ClipperBase.slopesEqual(horizontalEdge, nextEdge, this.useFullRange)
        ) {
          const outerPoint2 = this.addOuterPoint(nextEdge, horizontalEdge.bottom)
          this.addJoin(outerPoint1, outerPoint2, horizontalEdge.top)
        }
      } else {
        horizontalEdge = this.updateEdgeIntoAEL(horizontalEdge)
      }
    } else {
      if (horizontalEdge.outIndex >= 0) this.addOuterPoint(horizontalEdge, horizontalEdge.top)
      this.deleteFromAEL(horizontalEdge)
    }
  }

  public getNextInAEL(edge: TEdge, direction: Direction) {
    return direction === Direction.leftToRight ? edge.nextInAEL : edge.prevInAEL
  }

  public isMinima(edge: TEdge) {
    return edge !== null && edge.prev.nextInLML !== edge && edge.next.nextInLML !== edge
  }

  public isMaxima(edge: TEdge, y: number) {
    return edge !== null && edge.top.y === y && edge.nextInLML === null
  }

  public isIntermediate(edge: TEdge, y: number) {
    return edge.top.y === y && edge.nextInLML !== null
  }

  public getMaximaPair(edge: TEdge) {
    if (IntPoint.op_Equality(edge.next.top, edge.top) && edge.next.nextInLML === null) {
      return edge.next
    } else {
      if (IntPoint.op_Equality(edge.prev.top, edge.top) && edge.prev.nextInLML === null) {
        return edge.prev
      } else {
        return null
      }
    }
  }

  /** Same as getMaximaPair but returns null if MaxPair isn't in AEL (unless it's horizontal) */
  public getMaximaPairEx(edge: TEdge) {
    const result = this.getMaximaPair(edge)
    if (
      result === null ||
      result.outIndex === ClipperBase.SKIP ||
      (result.nextInAEL === result.prevInAEL && !ClipperBase.isHorizontal(result))
    ) {
      return null
    }
    return result
  }

  public processIntersections(topY: number) {
    if (this.activeEdges === null) return true
    try {
      this.buildIntersectList(topY)
      if (this.intersectList.length === 0) return true
      if (this.intersectList.length === 1 || this.fixupIntersectionOrder()) this.processIntersectList()
      else return false
    } catch ($$e2) {
      this.sortedEdges = null
      this.intersectList.length = 0
      ClipperLib.Error('ProcessIntersections error')
    }
    this.sortedEdges = null
    return true
  }

  public buildIntersectList(topY: number) {
    if (this.activeEdges === null) return

    // prepare for sorting ...
    let edge = this.activeEdges
    this.sortedEdges = edge
    while (edge !== null) {
      edge.prevInSEL = edge.prevInAEL
      edge.nextInSEL = edge.nextInAEL
      edge.current.x = Clipper.topX(edge, topY)
      edge = edge.nextInAEL
    }

    // bubble sort ...
    let isModified = true
    while (isModified && this.sortedEdges !== null) {
      isModified = false
      edge = this.sortedEdges
      while (edge.nextInSEL !== null) {
        const nextEdge = edge.nextInSEL
        let point = new IntPoint()
        if (edge.current.x > nextEdge.current.x) {
          this.intersectPoint(edge, nextEdge, point)
          if (point.y < topY) point = new IntPoint(Clipper.topX(edge, topY), topY)
          const newNode = new IntersectNode()
          newNode.edge1 = edge
          newNode.edge2 = nextEdge
          //newNode.Pt = pt;
          newNode.point.x = point.x
          newNode.point.y = point.y
          if (ClipperLib.USE_XYZ) newNode.point.z = point.z
          this.intersectList.push(newNode)
          this.swapPositionsInSEL(edge, nextEdge)
          isModified = true
        } else edge = nextEdge
      }
      if (edge.prevInSEL !== null) edge.prevInSEL.nextInSEL = null
      else break
    }
    this.sortedEdges = null
  }

  public edgesAdjacent(inode: IntersectNode): boolean {
    return inode.edge1.nextInSEL === inode.edge2 || inode.edge1.prevInSEL === inode.edge2
  }

  public static intersectNodeSort(node1: IntersectNode, node2: IntersectNode) {
    // the following typecast is safe because the differences in Pt.Y will
    // be limited to the height of the scanbeam.
    return node2.point.y - node1.point.y
  }

  public fixupIntersectionOrder() {
    // pre-condition: intersections are sorted bottom-most first.
    // Now it's crucial that intersections are made only between adjacent edges,
    // so to ensure this the order of intersections may need adjusting ...
    this.intersectList.sort(this.intersectNodeComparer)
    this.copyAELToSEL()
    const count = this.intersectList.length
    for (let i = 0; i < count; i++) {
      if (!this.edgesAdjacent(this.intersectList[i])) {
        let j = i + 1
        while (j < count && !this.edgesAdjacent(this.intersectList[j])) j++
        if (j === count) return false
        const tmp = this.intersectList[i]
        this.intersectList[i] = this.intersectList[j]
        this.intersectList[j] = tmp
      }
      this.swapPositionsInSEL(this.intersectList[i].edge1, this.intersectList[i].edge2)
    }
    return true
  }

  public processIntersectList() {
    for (let i = 0, len = this.intersectList.length; i < len; i++) {
      const iNode = this.intersectList[i]
      this.intersectEdges(iNode.edge1, iNode.edge2, iNode.point)
      this.swapPositionsInAEL(iNode.edge1, iNode.edge2)
    }
    this.intersectList.length = 0
  }

  public static topX(edge: TEdge, currentY: number) {
    //if (edge.Bot == edge.Curr) alert ("edge.Bot = edge.Curr");
    //if (edge.Bot == edge.Top) alert ("edge.Bot = edge.Top");
    if (currentY === edge.top.y) return edge.top.x
    return edge.bottom.x + Clipper.round(edge.dx * (currentY - edge.bottom.y))
  }

  public intersectPoint(edge1: TEdge, edge2: TEdge, intersectionPoint: IntPoint) {
    intersectionPoint.x = 0
    intersectionPoint.y = 0
    let b1: number, b2: number
    // nb: with very large coordinate values, it's possible for SlopesEqual() to
    // return false but for the edge.Dx value be equal due to double precision rounding.
    if (edge1.dx === edge2.dx) {
      intersectionPoint.y = edge1.current.y
      intersectionPoint.x = Clipper.topX(edge1, intersectionPoint.y)
      return
    }
    if (edge1.delta.x === 0) {
      intersectionPoint.x = edge1.bottom.x
      if (ClipperBase.isHorizontal(edge2)) {
        intersectionPoint.y = edge2.bottom.y
      } else {
        b2 = edge2.bottom.y - edge2.bottom.x / edge2.dx
        intersectionPoint.y = Clipper.round(intersectionPoint.x / edge2.dx + b2)
      }
    } else if (edge2.delta.x === 0) {
      intersectionPoint.x = edge2.bottom.x
      if (ClipperBase.isHorizontal(edge1)) {
        intersectionPoint.y = edge1.bottom.y
      } else {
        b1 = edge1.bottom.y - edge1.bottom.x / edge1.dx
        intersectionPoint.y = Clipper.round(intersectionPoint.x / edge1.dx + b1)
      }
    } else {
      b1 = edge1.bottom.x - edge1.bottom.y * edge1.dx
      b2 = edge2.bottom.x - edge2.bottom.y * edge2.dx
      const q = (b2 - b1) / (edge1.dx - edge2.dx)
      intersectionPoint.y = Clipper.round(q)
      if (Math.abs(edge1.dx) < Math.abs(edge2.dx)) intersectionPoint.x = Clipper.round(edge1.dx * q + b1)
      else intersectionPoint.x = Clipper.round(edge2.dx * q + b2)
    }
    if (intersectionPoint.y < edge1.top.y || intersectionPoint.y < edge2.top.y) {
      if (edge1.top.y > edge2.top.y) {
        intersectionPoint.y = edge1.top.y
        intersectionPoint.x = Clipper.topX(edge2, edge1.top.y)
        return intersectionPoint.x < edge1.top.x
      } else intersectionPoint.y = edge2.top.y
      if (Math.abs(edge1.dx) < Math.abs(edge2.dx)) intersectionPoint.x = Clipper.topX(edge1, intersectionPoint.y)
      else intersectionPoint.x = Clipper.topX(edge2, intersectionPoint.y)
    }
    // finally, don't allow 'ip' to be BELOW curr.Y (ie bottom of scanbeam) ...
    if (intersectionPoint.y > edge1.current.y) {
      intersectionPoint.y = edge1.current.y
      //better to use the more vertical edge to derive X ...
      if (Math.abs(edge1.dx) > Math.abs(edge2.dx)) intersectionPoint.x = Clipper.topX(edge2, intersectionPoint.y)
      else intersectionPoint.x = Clipper.topX(edge1, intersectionPoint.y)
    }
  }

  public processEdgesAtTopOfScanbeam(topY: number) {
    let edge = this.activeEdges

    while (edge !== null) {
      // 1. process maxima, treating them as if they're 'bent' horizontal edges,
      //    but exclude maxima with horizontal edges. nb: e can't be a horizontal.
      let isMaximaEdge = this.isMaxima(edge, topY)
      if (isMaximaEdge) {
        const edgeMaximaPair = this.getMaximaPairEx(edge)
        isMaximaEdge = edgeMaximaPair === null || !ClipperBase.isHorizontal(edgeMaximaPair)
      }
      if (isMaximaEdge) {
        if (this.strictlySimple) {
          this.insertMaxima(edge.top.x)
        }
        const prevEdge = edge.prevInAEL
        this.doMaxima(edge)
        if (prevEdge === null) edge = this.activeEdges
        else edge = prevEdge.nextInAEL
      } else {
        // 2. promote horizontal edges, otherwise update Curr.X and Curr.Y ...
        if (this.isIntermediate(edge, topY) && ClipperBase.isHorizontal(edge.nextInLML)) {
          edge = this.updateEdgeIntoAEL(edge)
          if (edge.outIndex >= 0) this.addOuterPoint(edge, edge.bottom)
          this.addEdgeToSEL(edge)
        } else {
          edge.current.x = Clipper.topX(edge, topY)
          edge.current.y = topY
        }

        if (ClipperLib.USE_XYZ) {
          if (edge.top.y === topY) edge.current.z = edge.top.z
          else if (edge.bottom.y === topY) edge.current.z = edge.bottom.z
          else edge.current.z = 0
        }

        // When StrictlySimple and 'e' is being touched by another edge, then
        // make sure both edges have a vertex here ...
        if (this.strictlySimple) {
          const prevEdge = edge.prevInAEL
          if (
            edge.outIndex >= 0 &&
            edge.windDelta !== 0 &&
            prevEdge !== null &&
            prevEdge.outIndex >= 0 &&
            prevEdge.current.x === edge.current.x &&
            prevEdge.windDelta !== 0
          ) {
            const ip = new IntPoint(edge.current)

            if (ClipperLib.USE_XYZ) {
              this.setZ(ip, prevEdge, edge)
            }

            const outerPoint1 = this.addOuterPoint(prevEdge, ip)
            const outerPoint2 = this.addOuterPoint(edge, ip)
            this.addJoin(outerPoint1, outerPoint2, ip) // StrictlySimple (type-3) join
          }
        }
        edge = edge.nextInAEL
      }
    }
    // 3. Process horizontals at the Top of the scanbeam ...
    this.processHorizontals()
    this.maxima = null

    // 4. Promote intermediate vertices ...
    edge = this.activeEdges
    while (edge !== null) {
      if (this.isIntermediate(edge, topY)) {
        let outerPoint1: OuterPoint | null = null
        if (edge.outIndex >= 0) outerPoint1 = this.addOuterPoint(edge, edge.top)
        edge = this.updateEdgeIntoAEL(edge)
        // if output polygons share an edge, they'll need joining later ...
        const prevEdge = edge.prevInAEL
        const nextEdge = edge.nextInAEL

        if (
          prevEdge !== null &&
          prevEdge.current.x === edge.bottom.x &&
          prevEdge.current.y === edge.bottom.y &&
          outerPoint1 !== null &&
          prevEdge.outIndex >= 0 &&
          prevEdge.current.y === prevEdge.top.y &&
          ClipperBase.slopesEqual(edge.current, edge.top, prevEdge.current, prevEdge.top, this.useFullRange) &&
          edge.windDelta !== 0 &&
          prevEdge.windDelta !== 0
        ) {
          const outerPoint2 = this.addOuterPoint(prevEdge, edge.bottom)
          this.addJoin(outerPoint1, outerPoint2, edge.top)
        } else if (
          nextEdge !== null &&
          nextEdge.current.x === edge.bottom.x &&
          nextEdge.current.y === edge.bottom.y &&
          outerPoint1 !== null &&
          nextEdge.outIndex >= 0 &&
          nextEdge.current.y === nextEdge.top.y &&
          ClipperBase.slopesEqual(edge.current, edge.top, nextEdge.current, nextEdge.top, this.useFullRange) &&
          edge.windDelta !== 0 &&
          nextEdge.windDelta !== 0
        ) {
          const outerPoint2 = this.addOuterPoint(nextEdge, edge.bottom)
          this.addJoin(outerPoint1, outerPoint2, edge.top)
        }
      }
      edge = edge.nextInAEL
    }
  }

  public doMaxima(e: TEdge) {
    const edgeMaximaPair = this.getMaximaPairEx(e)
    if (edgeMaximaPair === null) {
      if (e.outIndex >= 0) this.addOuterPoint(e, e.top)
      this.deleteFromAEL(e)
      return
    }
    let nextEdge = e.nextInAEL
    while (nextEdge !== null && nextEdge !== edgeMaximaPair) {
      this.intersectEdges(e, nextEdge, e.top)
      this.swapPositionsInAEL(e, nextEdge)
      nextEdge = e.nextInAEL
    }
    if (e.outIndex === -1 && edgeMaximaPair.outIndex === -1) {
      this.deleteFromAEL(e)
      this.deleteFromAEL(edgeMaximaPair)
    } else if (e.outIndex >= 0 && edgeMaximaPair.outIndex >= 0) {
      if (e.outIndex >= 0) this.addLocalMaxPoly(e, edgeMaximaPair, e.top)
      this.deleteFromAEL(e)
      this.deleteFromAEL(edgeMaximaPair)
    } else if (ClipperLib.use_lines && e.windDelta === 0) {
      if (e.outIndex >= 0) {
        this.addOuterPoint(e, e.top)
        e.outIndex = ClipperBase.UNASSIGNED
      }
      this.deleteFromAEL(e)
      if (edgeMaximaPair.outIndex >= 0) {
        this.addOuterPoint(edgeMaximaPair, e.top)
        edgeMaximaPair.outIndex = ClipperBase.UNASSIGNED
      }
      this.deleteFromAEL(edgeMaximaPair)
    } else ClipperLib.Error('DoMaxima error')
  }

  public static reversePaths(polys: Paths) {
    for (let i = 0, len = polys.length; i < len; i++) polys[i].reverse()
  }

  public static orientation(poly: Path) {
    return Clipper.area(poly) >= 0
  }

  public pointCount(points: OuterPoint) {
    if (points === null) return 0
    let result = 0
    let p = points
    do {
      result++
      p = p.next
    } while (p !== points)
    return result
  }

  public buildResult(pattern: PolygonTree | Paths) {
    if (pattern instanceof Paths) {
      ClipperLib.clear(pattern)
      for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
        const outerRectangle = this.outerPolygons[i]
        if (outerRectangle.points === null) continue
        let p = outerRectangle.points.prev
        const cnt = this.pointCount(p)
        if (cnt < 2) continue
        const pg = new Path(cnt)
        for (let j = 0; j < cnt; j++) {
          pg[j] = p.point
          p = p.prev
        }
        pattern.push(pg)
      }
    } else if (pattern) {
      pattern.clear()
      // add each output polygon/contour to polygonTree ...
      // polygonTree.allPolys.set_Capacity(this.m_PolyOuts.length);
      for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
        const outerRectangle = this.outerPolygons[i]
        const cnt = this.pointCount(outerRectangle.points)
        if ((outerRectangle.isOpen && cnt < 2) || (!outerRectangle.isOpen && cnt < 3)) continue
        this.fixHoleLinkage(outerRectangle)
        const pn = new PolygonNode()
        pattern.allPolys.push(pn)
        outerRectangle.polyNode = pn
        pn.polygon.length = cnt
        let op = outerRectangle.points.prev
        for (let j = 0; j < cnt; j++) {
          pn.polygon[j] = op.point
          op = op.prev
        }
      }
      // fixup PolyNode links etc ...
      // polygonTree.children.set_Capacity(this.m_PolyOuts.length);
      for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
        const outerRectangle = this.outerPolygons[i]
        if (outerRectangle.polyNode === null) continue
        else if (outerRectangle.isOpen) {
          outerRectangle.polyNode.isOpen = true
          pattern.addChild(outerRectangle.polyNode)
        } else if (outerRectangle.firstLeft !== null && outerRectangle.firstLeft.polyNode !== null)
          outerRectangle.firstLeft.polyNode.addChild(outerRectangle.polyNode)
        else pattern.addChild(outerRectangle.polyNode)
      }
    }
  }

  public fixupOutPolyline(outerRectangle: OuterRectangle) {
    let pp = outerRectangle.points
    let lastPP = pp.prev
    while (pp !== lastPP) {
      pp = pp.next
      if (IntPoint.op_Equality(pp.point, pp.prev.point)) {
        if (pp === lastPP) {
          lastPP = pp.prev
        }
        const tmpPP = pp.prev
        tmpPP.next = pp.next
        pp.next.prev = tmpPP
        pp = tmpPP
      }
    }
    if (pp === pp.prev) {
      outerRectangle.points = null
    }
  }

  /** removes duplicate points and simplifies consecutive parallel edges by removing the middle vertex. */
  public fixupOutPolygon(outerRectangle: OuterRectangle) {
    let lastOK = null
    outerRectangle.bottomPoint = null
    let pp = outerRectangle.points
    const preserveCol = this.preserveCollinear || this.strictlySimple
    for (;;) {
      if (pp.prev === pp || pp.prev === pp.next) {
        outerRectangle.points = null
        return
      }

      // test for duplicate points and collinear edges ...
      if (
        IntPoint.op_Equality(pp.point, pp.next.point) ||
        IntPoint.op_Equality(pp.point, pp.prev.point) ||
        (ClipperBase.slopesEqual(pp.prev.point, pp.point, pp.next.point, this.useFullRange) &&
          (!preserveCol || !this.pt2IsBetweenPt1AndPt3(pp.prev.point, pp.point, pp.next.point)))
      ) {
        lastOK = null
        pp.prev.next = pp.next
        pp.next.prev = pp.prev
        pp = pp.prev
      } else if (pp === lastOK) break
      else {
        if (lastOK === null) lastOK = pp
        pp = pp.next
      }
    }
    outerRectangle.points = pp
  }

  public dupOutPoint(outerPoint: OuterPoint, insertAfter?: boolean) {
    const result = new OuterPoint()
    //result.Pt = outPt.Pt;
    result.point.x = outerPoint.point.x
    result.point.y = outerPoint.point.y
    if (ClipperLib.USE_XYZ) result.point.z = outerPoint.point.z
    result.index = outerPoint.index
    if (insertAfter) {
      result.next = outerPoint.next
      result.prev = outerPoint
      outerPoint.next.prev = result
      outerPoint.next = result
    } else {
      result.prev = outerPoint.prev
      result.next = outerPoint
      outerPoint.prev.next = result
      outerPoint.prev = result
    }
    return result
  }

  public getOverlap(a1: number, a2: number, b1: number, b2: number, $val: OverlapProps) {
    if (a1 < a2) {
      if (b1 < b2) {
        $val.left = Math.max(a1, b1)
        $val.right = Math.min(a2, b2)
      } else {
        $val.left = Math.max(a1, b2)
        $val.right = Math.min(a2, b1)
      }
    } else {
      if (b1 < b2) {
        $val.left = Math.max(a2, b1)
        $val.right = Math.min(a1, b2)
      } else {
        $val.left = Math.max(a2, b2)
        $val.right = Math.min(a1, b1)
      }
    }
    return $val.left < $val.right
  }

  public joinHorizontal(
    op1: OuterPoint,
    op1b: OuterPoint,
    op2: OuterPoint,
    op2b: OuterPoint,
    pt: IntPoint,
    discardLeft?: boolean
  ) {
    const direction1 = op1.point.x > op1b.point.x ? Direction.rightToLeft : Direction.leftToRight
    const direction2 = op2.point.x > op2b.point.x ? Direction.rightToLeft : Direction.leftToRight
    if (direction1 === direction2) return false
    // When DiscardLeft, we want Op1b to be on the Left of Op1, otherwise we
    // want Op1b to be on the Right. (And likewise with Op2 and Op2b.)
    // So, to facilitate this while inserting Op1b and Op2b ...
    // when DiscardLeft, make sure we're AT or RIGHT of Pt before adding Op1b,
    // otherwise make sure we're AT or LEFT of Pt. (Likewise with Op2b.)
    if (direction1 === Direction.leftToRight) {
      while (op1.next.point.x <= pt.x && op1.next.point.x >= op1.point.x && op1.next.point.y === pt.y) op1 = op1.next
      if (discardLeft && op1.point.x !== pt.x) op1 = op1.next
      op1b = this.dupOutPoint(op1, !discardLeft)
      if (IntPoint.op_Inequality(op1b.point, pt)) {
        op1 = op1b
        //op1.Pt = Pt;
        op1.point.x = pt.x
        op1.point.y = pt.y
        if (ClipperLib.USE_XYZ) op1.point.z = pt.z
        op1b = this.dupOutPoint(op1, !discardLeft)
      }
    } else {
      while (op1.next.point.x >= pt.x && op1.next.point.x <= op1.point.x && op1.next.point.y === pt.y) op1 = op1.next
      if (!discardLeft && op1.point.x !== pt.x) op1 = op1.next
      op1b = this.dupOutPoint(op1, discardLeft)
      if (IntPoint.op_Inequality(op1b.point, pt)) {
        op1 = op1b
        //op1.Pt = Pt;
        op1.point.x = pt.x
        op1.point.y = pt.y
        if (ClipperLib.USE_XYZ) op1.point.z = pt.z
        op1b = this.dupOutPoint(op1, discardLeft)
      }
    }
    if (direction2 === Direction.leftToRight) {
      while (op2.next.point.x <= pt.x && op2.next.point.x >= op2.point.x && op2.next.point.y === pt.y) op2 = op2.next
      if (discardLeft && op2.point.x !== pt.x) op2 = op2.next
      op2b = this.dupOutPoint(op2, !discardLeft)
      if (IntPoint.op_Inequality(op2b.point, pt)) {
        op2 = op2b
        //op2.Pt = Pt;
        op2.point.x = pt.x
        op2.point.y = pt.y
        if (ClipperLib.USE_XYZ) op2.point.z = pt.z
        op2b = this.dupOutPoint(op2, !discardLeft)
      }
    } else {
      while (op2.next.point.x >= pt.x && op2.next.point.x <= op2.point.x && op2.next.point.y === pt.y) op2 = op2.next
      if (!discardLeft && op2.point.x !== pt.x) op2 = op2.next
      op2b = this.dupOutPoint(op2, discardLeft)
      if (IntPoint.op_Inequality(op2b.point, pt)) {
        op2 = op2b
        //op2.Pt = Pt;
        op2.point.x = pt.x
        op2.point.y = pt.y
        if (ClipperLib.USE_XYZ) op2.point.z = pt.z
        op2b = this.dupOutPoint(op2, discardLeft)
      }
    }
    if ((direction1 === Direction.leftToRight) === discardLeft) {
      op1.prev = op2
      op2.next = op1
      op1b.next = op2b
      op2b.prev = op1b
    } else {
      op1.next = op2
      op2.prev = op1
      op1b.prev = op2b
      op2b.next = op1b
    }
    return true
  }

  public joinPoints(j: Join, outerRectangle1: OuterRectangle, outerRectangle2: OuterRectangle) {
    let op1 = j.outerPoint1,
      op1b = new OuterPoint()
    let op2 = j.outerPoint2,
      op2b = new OuterPoint()
    /**
     * There are 3 kinds of joins for output polygons ...
     * 1. Horizontal joins where Join.OutPt1 & Join.OutPt2 are vertices anywhere
     * along (horizontal) collinear edges (& Join.OffPt is on the same horizontal).
     * 2. Non-horizontal joins where Join.OutPt1 & Join.OutPt2 are at the same
     * location at the Bottom of the overlapping segment (& Join.OffPt is above).
     * 3. StrictlySimple joins where edges touch but are not collinear and where
     * Join.OutPt1, Join.OutPt2 & Join.OffPt all share the same point.
     */
    const isHorizontal = j.outerPoint1.point.y === j.offPoint.y
    if (
      isHorizontal &&
      IntPoint.op_Equality(j.offPoint, j.outerPoint1.point) &&
      IntPoint.op_Equality(j.offPoint, j.outerPoint2.point)
    ) {
      //Strictly Simple join ...
      if (outerRectangle1 !== outerRectangle2) return false

      op1b = j.outerPoint1.next
      while (op1b !== op1 && IntPoint.op_Equality(op1b.point, j.offPoint)) op1b = op1b.next
      const reverse1 = op1b.point.y > j.offPoint.y
      op2b = j.outerPoint2.next
      while (op2b !== op2 && IntPoint.op_Equality(op2b.point, j.offPoint)) op2b = op2b.next
      const reverse2 = op2b.point.y > j.offPoint.y
      if (reverse1 === reverse2) return false
      if (reverse1) {
        op1b = this.dupOutPoint(op1, false)
        op2b = this.dupOutPoint(op2, true)
        op1.prev = op2
        op2.next = op1
        op1b.next = op2b
        op2b.prev = op1b
        j.outerPoint1 = op1
        j.outerPoint2 = op1b
        return true
      } else {
        op1b = this.dupOutPoint(op1, true)
        op2b = this.dupOutPoint(op2, false)
        op1.next = op2
        op2.prev = op1
        op1b.prev = op2b
        op2b.next = op1b
        j.outerPoint1 = op1
        j.outerPoint2 = op1b
        return true
      }
    } else if (isHorizontal) {
      //treat horizontal joins differently to non-horizontal joins since with
      //them we're not yet sure where the overlapping is. OutPt1.Pt & OutPt2.Pt
      //may be anywhere along the horizontal edge.
      op1b = op1
      while (op1.prev.point.y === op1.point.y && op1.prev !== op1b && op1.prev !== op2) op1 = op1.prev
      while (op1b.next.point.y === op1b.point.y && op1b.next !== op1 && op1b.next !== op2) op1b = op1b.next
      if (op1b.next === op1 || op1b.next === op2) return false
      //a flat 'polygon'
      op2b = op2
      while (op2.prev.point.y === op2.point.y && op2.prev !== op2b && op2.prev !== op1b) op2 = op2.prev
      while (op2b.next.point.y === op2b.point.y && op2b.next !== op2 && op2b.next !== op1) op2b = op2b.next
      if (op2b.next === op2 || op2b.next === op1) return false
      //a flat 'polygon'
      //Op1 -. Op1b & Op2 -. Op2b are the extremites of the horizontal edges

      const $val: OverlapProps = {
        left: null,
        right: null,
      }

      if (!this.getOverlap(op1.point.x, op1b.point.x, op2.point.x, op2b.point.x, $val)) return false
      const left = $val.left
      const right = $val.right

      // DiscardLeftSide: when overlapping edges are joined, a spike will created
      // which needs to be cleaned up. However, we don't want Op1 or Op2 caught up
      // on the discard Side as either may still be needed for other joins ...
      const pt = new IntPoint()
      let discardLeftSide: boolean
      if (op1.point.x >= left && op1.point.x <= right) {
        //Pt = op1.Pt;
        pt.x = op1.point.x
        pt.y = op1.point.y
        if (ClipperLib.USE_XYZ) pt.z = op1.point.z
        discardLeftSide = op1.point.x > op1b.point.x
      } else if (op2.point.x >= left && op2.point.x <= right) {
        //Pt = op2.Pt;
        pt.x = op2.point.x
        pt.y = op2.point.y
        if (ClipperLib.USE_XYZ) pt.z = op2.point.z
        discardLeftSide = op2.point.x > op2b.point.x
      } else if (op1b.point.x >= left && op1b.point.x <= right) {
        //Pt = op1b.Pt;
        pt.x = op1b.point.x
        pt.y = op1b.point.y
        if (ClipperLib.USE_XYZ) pt.z = op1b.point.z
        discardLeftSide = op1b.point.x > op1.point.x
      } else {
        //Pt = op2b.Pt;
        pt.x = op2b.point.x
        pt.y = op2b.point.y
        if (ClipperLib.USE_XYZ) pt.z = op2b.point.z
        discardLeftSide = op2b.point.x > op2.point.x
      }
      j.outerPoint1 = op1
      j.outerPoint2 = op2
      return this.joinHorizontal(op1, op1b, op2, op2b, pt, discardLeftSide)
    } else {
      // nb: For non-horizontal joins ...
      //    1. Jr.OutPt1.Pt.Y == Jr.OutPt2.Pt.Y
      //    2. Jr.OutPt1.Pt > Jr.OffPt.Y
      // make sure the polygons are correctly oriented ...
      op1b = op1.next
      while (IntPoint.op_Equality(op1b.point, op1.point) && op1b !== op1) op1b = op1b.next
      const reverse1 =
        op1b.point.y > op1.point.y || !ClipperBase.slopesEqual(op1.point, op1b.point, j.offPoint, this.useFullRange)
      if (reverse1) {
        op1b = op1.prev
        while (IntPoint.op_Equality(op1b.point, op1.point) && op1b !== op1) op1b = op1b.prev

        if (
          op1b.point.y > op1.point.y ||
          !ClipperBase.slopesEqual(op1.point, op1b.point, j.offPoint, this.useFullRange)
        )
          return false
      }
      op2b = op2.next
      while (IntPoint.op_Equality(op2b.point, op2.point) && op2b !== op2) op2b = op2b.next

      const reverse2 =
        op2b.point.y > op2.point.y || !ClipperBase.slopesEqual(op2.point, op2b.point, j.offPoint, this.useFullRange)
      if (reverse2) {
        op2b = op2.prev
        while (IntPoint.op_Equality(op2b.point, op2.point) && op2b !== op2) op2b = op2b.prev

        if (
          op2b.point.y > op2.point.y ||
          !ClipperBase.slopesEqual(op2.point, op2b.point, j.offPoint, this.useFullRange)
        )
          return false
      }
      if (
        op1b === op1 ||
        op2b === op2 ||
        op1b === op2b ||
        (outerRectangle1 === outerRectangle2 && reverse1 === reverse2)
      )
        return false
      if (reverse1) {
        op1b = this.dupOutPoint(op1, false)
        op2b = this.dupOutPoint(op2, true)
        op1.prev = op2
        op2.next = op1
        op1b.next = op2b
        op2b.prev = op1b
        j.outerPoint1 = op1
        j.outerPoint2 = op1b
        return true
      } else {
        op1b = this.dupOutPoint(op1, true)
        op2b = this.dupOutPoint(op2, false)
        op1.next = op2
        op2.prev = op1
        op1b.prev = op2b
        op2b.next = op1b
        j.outerPoint1 = op1
        j.outerPoint2 = op1b
        return true
      }
    }
  }

  public static getBounds(paths: Paths | OuterPoint) {
    if (paths instanceof Paths) {
      const count = paths.length
      let i = 0
      while (i < count && paths[i].length === 0) i++
      if (i === count) return new IntRectangle(0, 0, 0, 0)
      const result = new IntRectangle()
      result.left = paths[i][0].x
      result.right = result.left
      result.top = paths[i][0].y
      result.bottom = result.top
      for (; i < count; i++)
        for (let j = 0, len = paths[i].length; j < len; j++) {
          if (paths[i][j].x < result.left) result.left = paths[i][j].x
          else if (paths[i][j].x > result.right) result.right = paths[i][j].x
          if (paths[i][j].y < result.top) result.top = paths[i][j].y
          else if (paths[i][j].y > result.bottom) result.bottom = paths[i][j].y
        }
      return result
    } else {
      const outerPointStart = paths
      const result = new IntRectangle()
      result.left = paths.point.x
      result.right = paths.point.x
      result.top = paths.point.y
      result.bottom = paths.point.y
      paths = paths.next
      while (paths !== outerPointStart) {
        if (paths.point.x < result.left) result.left = paths.point.x
        if (paths.point.x > result.right) result.right = paths.point.x
        if (paths.point.y < result.top) result.top = paths.point.y
        if (paths.point.y > result.bottom) result.bottom = paths.point.y
        paths = paths.next
      }
      return result
    }
  }

  /**
   * Returns 0 if false, +1 if true, -1 if pt ON polygon boundary
   * See "The Point in Polygon Problem for Arbitrary Polygons" by Hormann & Agathos
   * http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.5498&rep=rep1&type=pdf
   **/
  public static pointInPolygon(point: IntPoint, path: Path): -1 | 0 | 1 {
    const count = path.length
    let result: -1 | 0 | 1 = 0
    if (count < 3) return 0
    let ip = path[0]
    for (let i = 1; i <= count; ++i) {
      const ipNext = i === count ? path[0] : path[i]
      if (ipNext.y === point.y) {
        if (ipNext.x === point.x || (ip.y === point.y && ipNext.x > point.x === ip.x < point.x)) return -1
      }
      if (ip.y < point.y !== ipNext.y < point.y) {
        if (ip.x >= point.x) {
          if (ipNext.x > point.x) result = (1 - result) as -1 | 0 | 1
          else {
            const d = (ip.x - point.x) * (ipNext.y - point.y) - (ipNext.x - point.x) * (ip.y - point.y)
            if (d === 0) return -1
            else if (d > 0 === ipNext.y > ip.y) result = (1 - result) as -1 | 0 | 1
          }
        } else {
          if (ipNext.x > point.x) {
            const d = (ip.x - point.x) * (ipNext.y - point.y) - (ipNext.x - point.x) * (ip.y - point.y)
            if (d === 0) return -1
            else if (d > 0 === ipNext.y > ip.y) result = (1 - result) as -1 | 0 | 1
          }
        }
      }
      ip = ipNext
    }
    return result
  }

  /** returns 0 if false, +1 if true, -1 if pt ON polygon boundary */
  public pointInPolygon(point: IntPoint, outerPoint: OuterPoint): -1 | 0 | 1 {
    let result: -1 | 0 | 1 = 0
    const startOp = outerPoint
    const ptx = point.x,
      pty = point.y
    let poly0x = outerPoint.point.x,
      poly0y = outerPoint.point.y
    do {
      outerPoint = outerPoint.next
      const polygon1x = outerPoint.point.x,
        polygon1y = outerPoint.point.y
      if (polygon1y === pty) {
        if (polygon1x === ptx || (poly0y === pty && polygon1x > ptx === poly0x < ptx)) return -1
      }
      if (poly0y < pty !== polygon1y < pty) {
        if (poly0x >= ptx) {
          if (polygon1x > ptx) result = (1 - result) as -1 | 0 | 1
          else {
            const d = (poly0x - ptx) * (polygon1y - pty) - (polygon1x - ptx) * (poly0y - pty)
            if (d === 0) return -1
            if (d > 0 === polygon1y > poly0y) result = (1 - result) as -1 | 0 | 1
          }
        } else {
          if (polygon1x > ptx) {
            const d = (poly0x - ptx) * (polygon1y - pty) - (polygon1x - ptx) * (poly0y - pty)
            if (d === 0) return -1
            if (d > 0 === polygon1y > poly0y) result = (1 - result) as -1 | 0 | 1
          }
        }
      }
      poly0x = polygon1x
      poly0y = polygon1y
    } while (startOp !== outerPoint)

    return result
  }

  public polygon2ContainsPoly1(outPt1: OuterPoint, outPt2: OuterPoint) {
    let outerPoint = outPt1
    do {
      //nb: PointInPolygon returns 0 if false, +1 if true, -1 if pt on polygon
      const res = this.pointInPolygon(outerPoint.point, outPt2)
      if (res >= 0) return res > 0
      outerPoint = outerPoint.next
    } while (outerPoint !== outPt1)
    return true
  }

  public fixupFirstLefts1(OldOutRec: OuterRectangle, NewOutRec: OuterRectangle) {
    let outerRectangle, firstLeft
    for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
      outerRectangle = this.outerPolygons[i]
      firstLeft = Clipper.parseFirstLeft(outerRectangle.firstLeft)
      if (outerRectangle.points !== null && firstLeft === OldOutRec) {
        if (this.polygon2ContainsPoly1(outerRectangle.points, NewOutRec.points)) outerRectangle.firstLeft = NewOutRec
      }
    }
  }

  public fixupFirstLefts2(innerOutRec: OuterRectangle, outerOutRec: OuterRectangle) {
    // A polygon has split into two such that one is now the inner of the other.
    // It's possible that these polygons now wrap around other polygons, so check
    // every polygon that's also contained by OuterOutRec's FirstLeft container
    // (including nil) to see if they've become inner to the new inner polygon ...
    const outerOutRecFirstLeft = outerOutRec.firstLeft
    let outerRectangle: OuterRectangle, firstLeft: OuterRectangle
    for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
      outerRectangle = this.outerPolygons[i]
      if (outerRectangle.points === null || outerRectangle === outerOutRec || outerRectangle === innerOutRec) continue
      firstLeft = Clipper.parseFirstLeft(outerRectangle.firstLeft)
      if (firstLeft !== outerOutRecFirstLeft && firstLeft !== innerOutRec && firstLeft !== outerOutRec) continue
      if (this.polygon2ContainsPoly1(outerRectangle.points, innerOutRec.points)) outerRectangle.firstLeft = innerOutRec
      else if (this.polygon2ContainsPoly1(outerRectangle.points, outerOutRec.points))
        outerRectangle.firstLeft = outerOutRec
      else if (outerRectangle.firstLeft === innerOutRec || outerRectangle.firstLeft === outerOutRec)
        outerRectangle.firstLeft = outerOutRecFirstLeft
    }
  }

  /** same as FixupFirstLefts1 but doesn't call polygon2ContainsPoly1() */
  public fixupFirstLefts3(oldOutRec: OuterRectangle, newOutRec: OuterRectangle) {
    let outerRectangle: OuterRectangle
    let firstLeft: OuterRectangle
    for (let i = 0, len = this.outerPolygons.length; i < len; i++) {
      outerRectangle = this.outerPolygons[i]
      firstLeft = Clipper.parseFirstLeft(outerRectangle.firstLeft)
      if (outerRectangle.points !== null && firstLeft === oldOutRec) outerRectangle.firstLeft = newOutRec
    }
  }

  public static parseFirstLeft(firstLeft: OuterRectangle) {
    while (firstLeft !== null && firstLeft.points === null) firstLeft = firstLeft.firstLeft
    return firstLeft
  }

  public joinCommonEdges() {
    for (let i = 0, len = this.joins.length; i < len; i++) {
      const join = this.joins[i]
      const outerRectangle1 = this.getOutRec(join.outerPoint1.index)
      let outerRectangle2 = this.getOutRec(join.outerPoint2.index)
      if (outerRectangle1.points === null || outerRectangle2.points === null) continue

      if (outerRectangle1.isOpen || outerRectangle2.isOpen) {
        continue
      }

      // get the polygon fragment with the correct hole state (FirstLeft) before calling JoinPoints() ...
      let holeStateRec: OuterRectangle
      if (outerRectangle1 === outerRectangle2) holeStateRec = outerRectangle1
      else if (this.outerRectangle1RightOfOutRec2(outerRectangle1, outerRectangle2)) holeStateRec = outerRectangle2
      else if (this.outerRectangle1RightOfOutRec2(outerRectangle2, outerRectangle1)) holeStateRec = outerRectangle1
      else holeStateRec = this.getLowermostRec(outerRectangle1, outerRectangle2)

      if (!this.joinPoints(join, outerRectangle1, outerRectangle2)) continue

      if (outerRectangle1 === outerRectangle2) {
        // instead of joining two polygons, we've just created a new one by splitting one polygon into two.
        outerRectangle1.points = join.outerPoint1
        outerRectangle1.bottomPoint = null
        outerRectangle2 = this.createOuterRectangle()
        outerRectangle2.points = join.outerPoint2
        // update all OutRec2.Pts Idx's ...
        this.updateOutPointIndexes(outerRectangle2)

        if (this.polygon2ContainsPoly1(outerRectangle2.points, outerRectangle1.points)) {
          // outerRectangle1 contains outerRectangle2 ...
          outerRectangle2.isHole = !outerRectangle1.isHole
          outerRectangle2.firstLeft = outerRectangle1
          if (this.usingPolygonTree) this.fixupFirstLefts2(outerRectangle2, outerRectangle1)
          if ((+outerRectangle2.isHole ^ +this.reverseSolution) === +(this.area(outerRectangle2.points) > 0))
            this.reversePolyPointLinks(outerRectangle2.points)
        } else if (this.polygon2ContainsPoly1(outerRectangle1.points, outerRectangle2.points)) {
          // outerRectangle2 contains outerRectangle1 ...
          outerRectangle2.isHole = outerRectangle1.isHole
          outerRectangle1.isHole = !outerRectangle2.isHole
          outerRectangle2.firstLeft = outerRectangle1.firstLeft
          outerRectangle1.firstLeft = outerRectangle2
          if (this.usingPolygonTree) this.fixupFirstLefts2(outerRectangle1, outerRectangle2)

          if ((+outerRectangle1.isHole ^ +this.reverseSolution) === +(this.area(outerRectangle1.points) > 0))
            this.reversePolyPointLinks(outerRectangle1.points)
        } else {
          //the 2 polygons are completely separate ...
          outerRectangle2.isHole = outerRectangle1.isHole
          outerRectangle2.firstLeft = outerRectangle1.firstLeft
          //fixup FirstLeft pointers that may need reassigning to OutRec2
          if (this.usingPolygonTree) this.fixupFirstLefts1(outerRectangle1, outerRectangle2)
        }
      } else {
        //joined 2 polygons together ...
        outerRectangle2.points = null
        outerRectangle2.bottomPoint = null
        outerRectangle2.index = outerRectangle1.index
        outerRectangle1.isHole = holeStateRec.isHole
        if (holeStateRec === outerRectangle2) outerRectangle1.firstLeft = outerRectangle2.firstLeft
        outerRectangle2.firstLeft = outerRectangle1
        //fixup FirstLeft pointers that may need reassigning to OutRec1
        if (this.usingPolygonTree) this.fixupFirstLefts3(outerRectangle2, outerRectangle1)
      }
    }
  }

  public updateOutPointIndexes(outerRectangle: OuterRectangle) {
    let op = outerRectangle.points
    do {
      op.index = outerRectangle.index
      op = op.prev
    } while (op !== outerRectangle.points)
  }

  public doSimplePolygons() {
    let i = 0
    while (i < this.outerPolygons.length) {
      const outerRectangle = this.outerPolygons[i++]
      let outerPoint1 = outerRectangle.points
      if (outerPoint1 === null || outerRectangle.isOpen) continue
      do // for each Pt in Polygon until duplicate found do ...
      {
        let outerPoint2 = outerPoint1.next
        while (outerPoint2 !== outerRectangle.points) {
          if (
            IntPoint.op_Equality(outerPoint1.point, outerPoint2.point) &&
            outerPoint2.next !== outerPoint1 &&
            outerPoint2.prev !== outerPoint1
          ) {
            // split the polygon into two ...
            const outerPoint3 = outerPoint1.prev
            const outerPoint4 = outerPoint2.prev
            outerPoint1.prev = outerPoint4
            outerPoint4.next = outerPoint1
            outerPoint2.prev = outerPoint3
            outerPoint3.next = outerPoint2
            outerRectangle.points = outerPoint1
            const outerRectangle2 = this.createOuterRectangle()
            outerRectangle2.points = outerPoint2
            this.updateOutPointIndexes(outerRectangle2)
            if (this.polygon2ContainsPoly1(outerRectangle2.points, outerRectangle.points)) {
              // OutRec2 is contained by OutRec1 ...
              outerRectangle2.isHole = !outerRectangle.isHole
              outerRectangle2.firstLeft = outerRectangle
              if (this.usingPolygonTree) this.fixupFirstLefts2(outerRectangle2, outerRectangle)
            } else if (this.polygon2ContainsPoly1(outerRectangle.points, outerRectangle2.points)) {
              // OutRec1 is contained by OutRec2 ...
              outerRectangle2.isHole = outerRectangle.isHole
              outerRectangle.isHole = !outerRectangle2.isHole
              outerRectangle2.firstLeft = outerRectangle.firstLeft
              outerRectangle.firstLeft = outerRectangle2
              if (this.usingPolygonTree) this.fixupFirstLefts2(outerRectangle, outerRectangle2)
            } else {
              // the 2 polygons are separate ...
              outerRectangle2.isHole = outerRectangle.isHole
              outerRectangle2.firstLeft = outerRectangle.firstLeft
              if (this.usingPolygonTree) this.fixupFirstLefts1(outerRectangle, outerRectangle2)
            }
            outerPoint2 = outerPoint1
            // ie get ready for the next iteration
          }
          outerPoint2 = outerPoint2.next
        }
        outerPoint1 = outerPoint1.next
      } while (outerPoint1 !== outerRectangle.points)
    }
  }

  public static area(poly: Path) {
    if (!Array.isArray(poly)) return 0
    const count = poly.length
    if (count < 3) return 0
    let a = 0
    for (let i = 0, j = count - 1; i < count; ++i) {
      a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y)
      j = i
    }
    return -a * 0.5
  }

  public area(outerPoint: OuterPoint) {
    const firstOutPoint = outerPoint
    if (outerPoint === null) return 0
    let a = 0
    do {
      a = a + (outerPoint.prev.point.x + outerPoint.point.x) * (outerPoint.prev.point.y - outerPoint.point.y)
      outerPoint = outerPoint.next
    } while (outerPoint !== firstOutPoint) // && typeof op !== 'undefined');
    return a * 0.5
  }

  public areaFunction(outerRectangle: OuterRectangle) {
    return this.area(outerRectangle.points)
  }

  // TODO: Check if unused
  public static simplifyPolygon(poly: Path, fillType: PolygonFillType) {
    const result = new Paths()
    const clipper = new Clipper(0)
    clipper.strictlySimple = true
    clipper.addPath(poly, PolyType.subject, true)
    clipper.execute(ClipType.union, result, fillType, fillType)
    return result
  }

  public static simplifyPolygons(polys: Paths, fillType?: PolygonFillType) {
    if (typeof fillType === 'undefined') fillType = PolygonFillType.evenOdd
    const result = new Paths()
    const clipper = new Clipper(0)
    clipper.strictlySimple = true
    clipper.addPaths(polys, PolyType.subject, true)
    clipper.execute(ClipType.union, result, fillType, fillType)
    return result
  }

  public static distanceSquared(pt1: IntPoint, pt2: IntPoint) {
    const dx = pt1.x - pt2.x
    const dy = pt1.y - pt2.y
    return dx * dx + dy * dy
  }

  public static distanceFromLineSquared(pt: IntPoint, ln1: IntPoint, ln2: IntPoint) {
    /**
     * The equation of a line in general form (Ax + By + C = 0)
     * given 2 points (x¹,y¹) & (x²,y²) is ...
     * (y¹ - y²)x + (x² - x¹)y + (y² - y¹)x¹ - (x² - x¹)y¹ = 0
     * A = (y¹ - y²); B = (x² - x¹); C = (y² - y¹)x¹ - (x² - x¹)y¹
     * perpendicular distance of point (x³,y³) = (Ax³ + By³ + C)/Sqrt(A² + B²)
     * see http://en.wikipedia.org/wiki/Perpendicular_distance
     */
    const A = ln1.y - ln2.y
    const B = ln2.x - ln1.x
    let C = A * ln1.x + B * ln1.y
    C = A * pt.x + B * pt.y - C
    return (C * C) / (A * A + B * B)
  }

  public static slopesNearCollinear(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, distSquared: number) {
    // this function is more accurate when the point that's GEOMETRICALLY
    // between the other 2 points is the one that's tested for distance.
    // nb: with 'spikes', either pt1 or pt3 is geometrically between the other pts
    if (Math.abs(pt1.x - pt2.x) > Math.abs(pt1.y - pt2.y)) {
      if (pt1.x > pt2.x === pt1.x < pt3.x) return Clipper.distanceFromLineSquared(pt1, pt2, pt3) < distSquared
      else if (pt2.x > pt1.x === pt2.x < pt3.x) return Clipper.distanceFromLineSquared(pt2, pt1, pt3) < distSquared
      else return Clipper.distanceFromLineSquared(pt3, pt1, pt2) < distSquared
    } else {
      if (pt1.y > pt2.y === pt1.y < pt3.y) return Clipper.distanceFromLineSquared(pt1, pt2, pt3) < distSquared
      else if (pt2.y > pt1.y === pt2.y < pt3.y) return Clipper.distanceFromLineSquared(pt2, pt1, pt3) < distSquared
      else return Clipper.distanceFromLineSquared(pt3, pt1, pt2) < distSquared
    }
  }

  public static pointsAreClose(pt1: IntPoint, pt2: IntPoint, distanceSquared: number) {
    const dx = pt1.x - pt2.x
    const dy = pt1.y - pt2.y
    return dx * dx + dy * dy <= distanceSquared
  }

  public static excludeOutPoint(outerPoint: OuterPoint) {
    const result = outerPoint.prev
    result.next = outerPoint.next
    outerPoint.next.prev = result
    result.index = 0
    return result
  }

  public static cleanPolygon(path: Path, distance?: number) {
    if (typeof distance === 'undefined') distance = 1.415
    // distance = proximity in units/pixels below which vertices will be stripped.
    // Default ~= sqrt(2) so when adjacent vertices or semi-adjacent vertices have
    // both x & y coords within 1 unit, then the second vertex will be stripped.
    let count = path.length
    if (count === 0) return []
    let outerPoints: OuterPoint[] = new Array(count)
    for (let i = 0; i < count; ++i) outerPoints[i] = new OuterPoint()
    for (let i = 0; i < count; ++i) {
      outerPoints[i].point = path[i]
      outerPoints[i].next = outerPoints[(i + 1) % count]
      outerPoints[i].next.prev = outerPoints[i]
      outerPoints[i].index = 0
    }
    const distanceSquared = distance * distance
    let outerPoint = outerPoints[0]
    while (outerPoint.index === 0 && outerPoint.next !== outerPoint.prev) {
      if (Clipper.pointsAreClose(outerPoint.point, outerPoint.prev.point, distanceSquared)) {
        outerPoint = Clipper.excludeOutPoint(outerPoint)
        count--
      } else if (Clipper.pointsAreClose(outerPoint.prev.point, outerPoint.next.point, distanceSquared)) {
        Clipper.excludeOutPoint(outerPoint.next)
        outerPoint = Clipper.excludeOutPoint(outerPoint)
        count -= 2
      } else if (
        Clipper.slopesNearCollinear(outerPoint.prev.point, outerPoint.point, outerPoint.next.point, distanceSquared)
      ) {
        outerPoint = Clipper.excludeOutPoint(outerPoint)
        count--
      } else {
        outerPoint.index = 1
        outerPoint = outerPoint.next
      }
    }
    if (count < 3) count = 0
    const result: IntPoint[] = new Array(count)
    for (let i = 0; i < count; ++i) {
      result[i] = new IntPoint(outerPoint.point)
      outerPoint = outerPoint.next
    }
    outerPoints = null
    return result
  }

  public static cleanPolygons(polygons: Paths, distance: number) {
    const result: typeof polygons = new Array(polygons.length)
    for (let i = 0, len = polygons.length; i < len; i++) result[i] = Clipper.cleanPolygon(polygons[i], distance)
    return result
  }

  public static minkowski(pattern: Path, path: Path, isSum: boolean, isClosed: boolean) {
    const delta = isClosed ? 1 : 0
    const polygonCount = pattern.length
    const pathCount = path.length
    const result = new Paths()
    if (isSum) {
      for (let i = 0; i < pathCount; i++) {
        const p: IntPoint[] = new Array(polygonCount)
        for (let j = 0, len = pattern.length, ip = pattern[j]; j < len; j++, ip = pattern[j]) {
          p[j] = new IntPoint(path[i].x + ip.x, path[i].y + ip.y)
        }
        result.push(p)
      }
    } else {
      for (let i = 0; i < pathCount; i++) {
        const p = new Array(polygonCount)
        for (let j = 0, len = pattern.length, ip = pattern[j]; j < len; j++, ip = pattern[j]) {
          p[j] = new IntPoint(path[i].x - ip.x, path[i].y - ip.y)
        }
        result.push(p)
      }
    }
    const quads = new Paths()
    for (let i = 0; i < pathCount - 1 + delta; i++)
      for (let j = 0; j < polygonCount; j++) {
        const quad: IntPoint[] = []
        quad.push(result[i % pathCount][j % polygonCount])
        quad.push(result[(i + 1) % pathCount][j % polygonCount])
        quad.push(result[(i + 1) % pathCount][(j + 1) % polygonCount])
        quad.push(result[i % pathCount][(j + 1) % polygonCount])
        if (!Clipper.orientation(quad)) quad.reverse()
        quads.push(quad)
      }
    return quads
  }

  public static minkowskiSum(pattern: Path, pathOrPaths: Path | Paths, pathIsClosed: boolean) {
    if (!(pathOrPaths[0] instanceof Array)) {
      const path = pathOrPaths as Path
      const paths = Clipper.minkowski(pattern, path, true, pathIsClosed)
      const clipper = new Clipper()
      clipper.addPaths(paths, PolyType.subject, true)
      clipper.execute(ClipType.union, paths, PolygonFillType.nonZero, PolygonFillType.nonZero)
      return paths
    } else {
      const paths = pathOrPaths as Paths
      const solution = new Paths()
      const c = new Clipper()
      for (let i = 0; i < paths.length; ++i) {
        const tmp = Clipper.minkowski(pattern, paths[i], true, pathIsClosed)
        c.addPaths(tmp, PolyType.subject, true)
        if (pathIsClosed) {
          const path = Clipper.translatePath(paths[i], pattern[0])
          c.addPath(path, PolyType.clip, true)
        }
      }
      c.execute(ClipType.union, solution, PolygonFillType.nonZero, PolygonFillType.nonZero)
      return solution
    }
  }

  public static translatePath(path: Path, delta: IntPoint) {
    const outPath = new Path()
    for (let i = 0; i < path.length; i++) outPath.push(new IntPoint(path[i].x + delta.x, path[i].y + delta.y))
    return outPath
  }

  public static minkowskiDiff(polygon1: Path, polygon2: Path) {
    const paths = Clipper.minkowski(polygon1, polygon2, false, true)
    const c = new Clipper()
    c.addPaths(paths, PolyType.subject, true)
    c.execute(ClipType.union, paths, PolygonFillType.nonZero, PolygonFillType.nonZero)
    return paths
  }

  public static polygonTreeToPaths(polygonTree: PolygonTree) {
    const result = new Paths()
    // result.set_Capacity(polytree.get_Total());
    Clipper.addPolyNodeToPaths(polygonTree, NodeType.any, result)
    return result
  }

  public static addPolyNodeToPaths(polyNode: PolygonNode, nt: NodeType, paths: Paths) {
    let match = true
    switch (nt) {
      case NodeType.open:
        return
      case NodeType.closed:
        match = !polyNode.isOpen
        break
      default:
        break
    }
    if (polyNode.polygon.length > 0 && match) paths.push(polyNode.polygon)
    for (let $i3 = 0, $t3 = polyNode.children, $l3 = $t3.length, pn = $t3[$i3]; $i3 < $l3; $i3++, pn = $t3[$i3]) {
      Clipper.addPolyNodeToPaths(pn, nt, paths)
    }
  }

  public static openPathsFromPolyTree(polygonTree: PolygonTree) {
    const result = new Paths()
    //result.set_Capacity(polytree.ChildCount());
    for (let i = 0, len = polygonTree.childCount(); i < len; i++) {
      if (polygonTree.children[i].isOpen) result.push(polygonTree.children[i].polygon)
    }
    return result
  }

  public static closedPathsFromPolyTree(polygonTree: PolygonTree) {
    const result = new Paths()
    //result.set_Capacity(polytree.Total());
    Clipper.addPolyNodeToPaths(polygonTree, NodeType.closed, result)
    return result
  }
}
