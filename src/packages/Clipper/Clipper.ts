import { ClipperLib } from '.'
import { browser } from './browser'
import { ClipperBase } from './ClipperBase'
import { ClipType, Direction, EdgeSide, NodeType, PolyFillType, PolyType } from './enums'
import { IntersectNode, MyIntersectNodeSort } from './IntersectNode'
import { IntPoint } from './IntPoint'
import { IntRect } from './IntRect'
import type { OutRec } from './Misc'
import { Join, LocalMinima, Maxima, OutPt, Scanbeam } from './Misc'
import { Path, Paths } from './Path'
import { PolyNode, PolyTree } from './PolyNode'
import { TEdge } from './TEdge'
import type { HorizontalEdgeProps, OverlapProps } from './types'

export class Clipper extends ClipperBase {
  public static ioReverseSolution = 1
  public static ioStrictlySimple = 2
  public static ioPreserveCollinear = 4

  public m_PolyOuts: OutRec[] = []
  public m_ClipType = ClipType.ctIntersection
  public m_Scanbeam: Scanbeam | null = null
  public m_Maxima: Maxima | null = null
  public m_ActiveEdges: TEdge | null = null
  public m_SortedEdges: TEdge | null = null
  public m_IntersectList: IntersectNode[] = []
  public m_IntersectNodeComparer = MyIntersectNodeSort.Compare
  public m_ExecuteLocked = false
  public m_ClipFillType = PolyFillType.pftEvenOdd
  public m_SubjFillType = PolyFillType.pftEvenOdd
  public m_Joins: Join[] = []
  public m_GhostJoins: Join[] = []
  public m_UsingPolyTree = false
  public ReverseSolution = false
  public StrictlySimple = false
  public PreserveCollinear = false

  public ZFillFunction: null | ((vert1: IntPoint, vert2: IntPoint, ref: unknown, intersectPt: IntPoint) => void)

  // Round speedtest: http://jsperf.com/fastest-round
  public static Round: (a: number) => number = browser.msie
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
    this.ReverseSolution = (1 & InitOptions) !== 0
    this.StrictlySimple = (2 & InitOptions) !== 0
    this.PreserveCollinear = (4 & InitOptions) !== 0
    if (ClipperLib.use_xyz) {
      this.ZFillFunction = null // function (IntPoint vert1, IntPoint vert2, ref IntPoint intersectPt);
    } else {
      // TODO: ????
      this.ZFillFunction = null
    }
  }

  public Clear() {
    if (this.m_edges.length === 0) return
    //avoids problems with ClipperBase destructor
    this.DisposeAllPolyPts()
    super.Clear()
  }

  public InsertMaxima(X: number) {
    //double-linked list: sorted ascending, ignoring dups.
    const newMax = new Maxima()
    newMax.X = X
    if (this.m_Maxima === null) {
      this.m_Maxima = newMax
      this.m_Maxima.Next = null
      this.m_Maxima.Prev = null
    } else if (X < this.m_Maxima.X) {
      newMax.Next = this.m_Maxima
      newMax.Prev = null
      this.m_Maxima = newMax
    } else {
      let m = this.m_Maxima
      while (m.Next !== null && X >= m.Next.X) {
        m = m.Next
      }
      if (X === m.X) {
        return
      } //ie ignores duplicates (& CG to clean up newMax)
      //insert newMax between m and m.Next ...
      newMax.Next = m.Next
      newMax.Prev = m
      if (m.Next !== null) {
        m.Next.Prev = newMax
      }
      m.Next = newMax
    }
  }

  public Execute(
    ...args:
      | [clipType: ClipType, solution: PolyTree | Paths, subjFillType: PolyFillType, clipFillType: PolyFillType]
      | [clipType: ClipType, solution: PolyTree | Paths]
  ): boolean {
    if (args.length === 4 && !(args[1] instanceof PolyTree)) {
      if (this.m_ExecuteLocked) return false
      if (this.m_HasOpenPaths) ClipperLib.Error('Error: PolyTree struct is needed for open path clipping.')

      const [clipType, solution, subjFillType, clipFillType] = args
      this.m_ExecuteLocked = true
      ClipperLib.Clear(solution)

      this.m_SubjFillType = subjFillType
      this.m_ClipFillType = clipFillType
      this.m_ClipType = clipType
      this.m_UsingPolyTree = false

      let succeeded = false
      try {
        succeeded = this.ExecuteInternal()
        // build the return polygons ...
        if (succeeded) this.BuildResult(solution)
      } finally {
        this.DisposeAllPolyPts()
        this.m_ExecuteLocked = false
      }
      return succeeded
    } else if (args.length === 4 && args[1] instanceof PolyTree) {
      if (this.m_ExecuteLocked) return false

      const [clipType, polyTree, subjFillType, clipFillType] = args

      this.m_ExecuteLocked = true
      this.m_SubjFillType = subjFillType
      this.m_ClipFillType = clipFillType
      this.m_ClipType = clipType
      this.m_UsingPolyTree = true

      let succeeded = false
      try {
        succeeded = this.ExecuteInternal()
        //build the return polygons ...
        if (succeeded) this.BuildResult(polyTree)
      } finally {
        this.DisposeAllPolyPts()
        this.m_ExecuteLocked = false
      }
      return succeeded
    } else if (args.length === 2 && !(args[1] instanceof PolyTree)) {
      const [clipType, solution] = args
      return this.Execute(clipType, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd)
    } else if (args.length === 2 && args[1] instanceof PolyTree) {
      const [clipType, polyTree] = args
      return this.Execute(clipType, polyTree, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd)
    }
  }

  public FixHoleLinkage(outRec: OutRec) {
    // skip if an outermost polygon or already already points to the correct FirstLeft ...
    if (outRec.FirstLeft === null || (outRec.IsHole !== outRec.FirstLeft.IsHole && outRec.FirstLeft.Pts !== null))
      return
    let outRecFirstLeft = outRec.FirstLeft
    while (outRecFirstLeft !== null && (outRecFirstLeft.IsHole === outRec.IsHole || outRecFirstLeft.Pts === null))
      outRecFirstLeft = outRecFirstLeft.FirstLeft
    outRec.FirstLeft = outRecFirstLeft
  }

  public ExecuteInternal() {
    try {
      this.Reset()
      this.m_SortedEdges = null
      this.m_Maxima = null

      const bottomY = new Scanbeam()
      const topY = new Scanbeam()

      if (!this.PopScanbeam(bottomY)) {
        return false
      }
      this.InsertLocalMinimaIntoAEL(bottomY.v)
      while (this.PopScanbeam(topY) || this.LocalMinimaPending()) {
        this.ProcessHorizontals()
        this.m_GhostJoins.length = 0
        if (!this.ProcessIntersections(topY.v)) {
          return false
        }
        this.ProcessEdgesAtTopOfScanbeam(topY.v)
        bottomY.v = topY.v
        this.InsertLocalMinimaIntoAEL(bottomY.v)
      }

      // fix orientations ...
      for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
        const outRec = this.m_PolyOuts[i]
        if (outRec.Pts === null || outRec.IsOpen) continue
        // Jacob: fixed error here where boolean wasn't correctly being coerced to number (added + at start of each)
        if ((+outRec.IsHole ^ +this.ReverseSolution) === +(this.Area(outRec.Pts) > 0))
          this.ReversePolyPtLinks(outRec.Pts)
      }

      this.JoinCommonEdges()

      for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
        const outRec = this.m_PolyOuts[i]
        if (outRec.Pts === null) continue
        else if (outRec.IsOpen) this.FixupOutPolyline(outRec)
        else this.FixupOutPolygon(outRec)
      }

      if (this.StrictlySimple) this.DoSimplePolygons()
      return true
    } finally {
      //catch { return false; }
      this.m_Joins.length = 0
      this.m_GhostJoins.length = 0
    }
  }

  public DisposeAllPolyPts() {
    for (let i = 0, len = this.m_PolyOuts.length; i < len; ++i) this.DisposeOutRec(i)
    ClipperLib.Clear(this.m_PolyOuts)
  }

  public AddJoin(Op1: OutPt, Op2: OutPt, OffPt: IntPoint) {
    const j = new Join()
    j.OutPt1 = Op1
    j.OutPt2 = Op2
    //j.OffPt = OffPt;
    j.OffPt.X = OffPt.X
    j.OffPt.Y = OffPt.Y
    if (ClipperLib.use_xyz) j.OffPt.Z = OffPt.Z
    this.m_Joins.push(j)
  }

  public AddGhostJoin(Op: OutPt, OffPt: IntPoint) {
    const j = new Join()
    j.OutPt1 = Op
    //j.OffPt = OffPt;
    j.OffPt.X = OffPt.X
    j.OffPt.Y = OffPt.Y
    if (ClipperLib.use_xyz) j.OffPt.Z = OffPt.Z
    this.m_GhostJoins.push(j)
  }

  public SetZ(pt: IntPoint, e1: TEdge, e2: TEdge) {
    if (ClipperLib.use_xyz) {
      if (this.ZFillFunction !== null) {
        if (pt.Z !== 0 || this.ZFillFunction === null) return
        else if (IntPoint.op_Equality(pt, e1.Bot)) pt.Z = e1.Bot.Z
        else if (IntPoint.op_Equality(pt, e1.Top)) pt.Z = e1.Top.Z
        else if (IntPoint.op_Equality(pt, e2.Bot)) pt.Z = e2.Bot.Z
        else if (IntPoint.op_Equality(pt, e2.Top)) pt.Z = e2.Top.Z
        // TODO: look into this function
        // else this.ZFillFunction(e1.Bot, e1.Top, e2.Bot, e2.Top, pt)
      }
    }
  }

  public InsertLocalMinimaIntoAEL(bottomY: number) {
    const lm = new LocalMinima()

    let leftBound: TEdge
    let rightBound: TEdge
    while (this.PopLocalMinima(bottomY, lm)) {
      leftBound = lm.v.LeftBound
      rightBound = lm.v.RightBound

      let Op1 = null
      if (leftBound === null) {
        this.InsertEdgeIntoAEL(rightBound, null)
        this.SetWindingCount(rightBound)
        if (this.IsContributing(rightBound)) Op1 = this.AddOutPt(rightBound, rightBound.Bot)
      } else if (rightBound === null) {
        this.InsertEdgeIntoAEL(leftBound, null)
        this.SetWindingCount(leftBound)
        if (this.IsContributing(leftBound)) Op1 = this.AddOutPt(leftBound, leftBound.Bot)
        this.InsertScanbeam(leftBound.Top.Y)
      } else {
        this.InsertEdgeIntoAEL(leftBound, null)
        this.InsertEdgeIntoAEL(rightBound, leftBound)
        this.SetWindingCount(leftBound)
        rightBound.WindCnt = leftBound.WindCnt
        rightBound.WindCnt2 = leftBound.WindCnt2
        if (this.IsContributing(leftBound)) Op1 = this.AddLocalMinPoly(leftBound, rightBound, leftBound.Bot)
        this.InsertScanbeam(leftBound.Top.Y)
      }
      if (rightBound !== null) {
        if (ClipperBase.IsHorizontal(rightBound)) {
          if (rightBound.NextInLML !== null) {
            this.InsertScanbeam(rightBound.NextInLML.Top.Y)
          }
          this.AddEdgeToSEL(rightBound)
        } else {
          this.InsertScanbeam(rightBound.Top.Y)
        }
      }
      if (leftBound === null || rightBound === null) continue
      // if output polygons share an Edge with a horizontal rb, they'll need joining later ...
      if (
        Op1 !== null &&
        ClipperBase.IsHorizontal(rightBound) &&
        this.m_GhostJoins.length > 0 &&
        rightBound.WindDelta !== 0
      ) {
        for (let i = 0, len = this.m_GhostJoins.length; i < len; i++) {
          // if the horizontal Rb and a 'ghost' horizontal overlap, then convert the 'ghost' join to a real join ready for later ...
          const j = this.m_GhostJoins[i]

          if (this.HorzSegmentsOverlap(j.OutPt1.Pt.X, j.OffPt.X, rightBound.Bot.X, rightBound.Top.X))
            this.AddJoin(j.OutPt1, Op1, j.OffPt)
        }
      }

      if (
        leftBound.OutIdx >= 0 &&
        leftBound.PrevInAEL !== null &&
        leftBound.PrevInAEL.Curr.X === leftBound.Bot.X &&
        leftBound.PrevInAEL.OutIdx >= 0 &&
        ClipperBase.SlopesEqual(
          leftBound.PrevInAEL.Curr,
          leftBound.PrevInAEL.Top,
          leftBound.Curr,
          leftBound.Top,
          this.m_UseFullRange
        ) &&
        leftBound.WindDelta !== 0 &&
        leftBound.PrevInAEL.WindDelta !== 0
      ) {
        const Op2 = this.AddOutPt(leftBound.PrevInAEL, leftBound.Bot)
        this.AddJoin(Op1, Op2, leftBound.Top)
      }
      if (leftBound.NextInAEL !== rightBound) {
        if (
          rightBound.OutIdx >= 0 &&
          rightBound.PrevInAEL.OutIdx >= 0 &&
          ClipperBase.SlopesEqual(
            rightBound.PrevInAEL.Curr,
            rightBound.PrevInAEL.Top,
            rightBound.Curr,
            rightBound.Top,
            this.m_UseFullRange
          ) &&
          rightBound.WindDelta !== 0 &&
          rightBound.PrevInAEL.WindDelta !== 0
        ) {
          const Op2 = this.AddOutPt(rightBound.PrevInAEL, rightBound.Bot)
          this.AddJoin(Op1, Op2, rightBound.Top)
        }
        let e = leftBound.NextInAEL
        if (e !== null)
          while (e !== rightBound) {
            // nb: For calculating winding counts etc, IntersectEdges() assumes
            // that param1 will be to the right of param2 ABOVE the intersection ...
            this.IntersectEdges(rightBound, e, leftBound.Curr)
            //order important here
            e = e.NextInAEL
          }
      }
    }
  }

  public InsertEdgeIntoAEL(edge: TEdge, startEdge: TEdge) {
    if (this.m_ActiveEdges === null) {
      edge.PrevInAEL = null
      edge.NextInAEL = null
      this.m_ActiveEdges = edge
    } else if (startEdge === null && this.E2InsertsBeforeE1(this.m_ActiveEdges, edge)) {
      edge.PrevInAEL = null
      edge.NextInAEL = this.m_ActiveEdges
      this.m_ActiveEdges.PrevInAEL = edge
      this.m_ActiveEdges = edge
    } else {
      if (startEdge === null) startEdge = this.m_ActiveEdges
      while (startEdge.NextInAEL !== null && !this.E2InsertsBeforeE1(startEdge.NextInAEL, edge))
        startEdge = startEdge.NextInAEL
      edge.NextInAEL = startEdge.NextInAEL
      if (startEdge.NextInAEL !== null) startEdge.NextInAEL.PrevInAEL = edge
      edge.PrevInAEL = startEdge
      startEdge.NextInAEL = edge
    }
  }

  public E2InsertsBeforeE1(e1: TEdge, e2: TEdge) {
    if (e2.Curr.X === e1.Curr.X) {
      if (e2.Top.Y > e1.Top.Y) return e2.Top.X < Clipper.TopX(e1, e2.Top.Y)
      else return e1.Top.X > Clipper.TopX(e2, e1.Top.Y)
    } else return e2.Curr.X < e1.Curr.X
  }

  public IsEvenOddFillType(edge: TEdge) {
    if (edge.PolyTyp === PolyType.ptSubject) return this.m_SubjFillType === PolyFillType.pftEvenOdd
    else return this.m_ClipFillType === PolyFillType.pftEvenOdd
  }

  public IsEvenOddAltFillType(edge: TEdge) {
    if (edge.PolyTyp === PolyType.ptSubject) return this.m_ClipFillType === PolyFillType.pftEvenOdd
    else return this.m_SubjFillType === PolyFillType.pftEvenOdd
  }

  public IsContributing(edge: TEdge) {
    let pft, pft2
    if (edge.PolyTyp === PolyType.ptSubject) {
      pft = this.m_SubjFillType
      pft2 = this.m_ClipFillType
    } else {
      pft = this.m_ClipFillType
      pft2 = this.m_SubjFillType
    }
    switch (pft) {
      case PolyFillType.pftEvenOdd:
        if (edge.WindDelta === 0 && edge.WindCnt !== 1) return false
        break
      case PolyFillType.pftNonZero:
        if (Math.abs(edge.WindCnt) !== 1) return false
        break
      case PolyFillType.pftPositive:
        if (edge.WindCnt !== 1) return false
        break
      default:
        if (edge.WindCnt !== -1) return false
        break
    }
    switch (this.m_ClipType) {
      case ClipType.ctIntersection:
        switch (pft2) {
          case PolyFillType.pftEvenOdd:
          case PolyFillType.pftNonZero:
            return edge.WindCnt2 !== 0
          case PolyFillType.pftPositive:
            return edge.WindCnt2 > 0
          default:
            return edge.WindCnt2 < 0
        }
      case ClipType.ctUnion:
        switch (pft2) {
          case PolyFillType.pftEvenOdd:
          case PolyFillType.pftNonZero:
            return edge.WindCnt2 === 0
          case PolyFillType.pftPositive:
            return edge.WindCnt2 <= 0
          default:
            return edge.WindCnt2 >= 0
        }
      case ClipType.ctDifference:
        if (edge.PolyTyp === PolyType.ptSubject)
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return edge.WindCnt2 === 0
            case PolyFillType.pftPositive:
              return edge.WindCnt2 <= 0
            default:
              return edge.WindCnt2 >= 0
          }
        else
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return edge.WindCnt2 !== 0
            case PolyFillType.pftPositive:
              return edge.WindCnt2 > 0
            default:
              return edge.WindCnt2 < 0
          }
      case ClipType.ctXor:
        if (edge.WindDelta === 0)
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return edge.WindCnt2 === 0
            case PolyFillType.pftPositive:
              return edge.WindCnt2 <= 0
            default:
              return edge.WindCnt2 >= 0
          }
        else return true
    }
    return true
  }

  public SetWindingCount(edge: TEdge) {
    let e = edge.PrevInAEL
    // find the edge of the same polytype that immediately precedes 'edge' in AEL
    while (e !== null && (e.PolyTyp !== edge.PolyTyp || e.WindDelta === 0)) e = e.PrevInAEL
    if (e === null) {
      const pft = edge.PolyTyp === PolyType.ptSubject ? this.m_SubjFillType : this.m_ClipFillType
      if (edge.WindDelta === 0) {
        edge.WindCnt = pft === PolyFillType.pftNegative ? -1 : 1
      } else {
        edge.WindCnt = edge.WindDelta
      }
      edge.WindCnt2 = 0
      e = this.m_ActiveEdges
      //ie get ready to calc WindCnt2
    } else if (edge.WindDelta === 0 && this.m_ClipType !== ClipType.ctUnion) {
      edge.WindCnt = 1
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      //ie get ready to calc WindCnt2
    } else if (this.IsEvenOddFillType(edge)) {
      //EvenOdd filling ...
      if (edge.WindDelta === 0) {
        //are we inside a subj polygon ...
        let Inside = true
        let e2 = e.PrevInAEL
        while (e2 !== null) {
          if (e2.PolyTyp === e.PolyTyp && e2.WindDelta !== 0) Inside = !Inside
          e2 = e2.PrevInAEL
        }
        edge.WindCnt = Inside ? 0 : 1
      } else {
        edge.WindCnt = edge.WindDelta
      }
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      //ie get ready to calc WindCnt2
    } else {
      //nonZero, Positive or Negative filling ...
      if (e.WindCnt * e.WindDelta < 0) {
        //prev edge is 'decreasing' WindCount (WC) toward zero
        //so we're outside the previous polygon ...
        if (Math.abs(e.WindCnt) > 1) {
          //outside prev poly but still inside another.
          //when reversing direction of prev poly use the same WC
          if (e.WindDelta * edge.WindDelta < 0) edge.WindCnt = e.WindCnt
          else edge.WindCnt = e.WindCnt + edge.WindDelta
        } else edge.WindCnt = edge.WindDelta === 0 ? 1 : edge.WindDelta
      } else {
        //prev edge is 'increasing' WindCount (WC) away from zero
        //so we're inside the previous polygon ...
        if (edge.WindDelta === 0) edge.WindCnt = e.WindCnt < 0 ? e.WindCnt - 1 : e.WindCnt + 1
        else if (e.WindDelta * edge.WindDelta < 0) edge.WindCnt = e.WindCnt
        else edge.WindCnt = e.WindCnt + edge.WindDelta
      }
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      //ie get ready to calc WindCnt2
    }
    //update WindCnt2 ...
    if (this.IsEvenOddAltFillType(edge)) {
      //EvenOdd filling ...
      while (e !== edge) {
        if (e.WindDelta !== 0) edge.WindCnt2 = edge.WindCnt2 === 0 ? 1 : 0
        e = e.NextInAEL
      }
    } else {
      //nonZero, Positive or Negative filling ...
      while (e !== edge) {
        edge.WindCnt2 += e.WindDelta
        e = e.NextInAEL
      }
    }
  }

  public AddEdgeToSEL(edge: TEdge) {
    // SEL pointers in PEdge are use to build transient lists of horizontal edges.
    // However, since we don't need to worry about processing order, all additions
    // are made to the front of the list ...
    if (this.m_SortedEdges === null) {
      this.m_SortedEdges = edge
      edge.PrevInSEL = null
      edge.NextInSEL = null
    } else {
      edge.NextInSEL = this.m_SortedEdges
      edge.PrevInSEL = null
      this.m_SortedEdges.PrevInSEL = edge
      this.m_SortedEdges = edge
    }
  }

  public PopEdgeFromSEL(e: TEdge) {
    // Pop edge from front of SEL (ie SEL is a FILO list)
    e.v = this.m_SortedEdges
    if (e.v === null) {
      return false
    }
    const oldE = e.v
    this.m_SortedEdges = e.v.NextInSEL
    if (this.m_SortedEdges !== null) {
      this.m_SortedEdges.PrevInSEL = null
    }
    oldE.NextInSEL = null
    oldE.PrevInSEL = null
    return true
  }

  public CopyAELToSEL() {
    let e = this.m_ActiveEdges
    this.m_SortedEdges = e
    while (e !== null) {
      e.PrevInSEL = e.PrevInAEL
      e.NextInSEL = e.NextInAEL
      e = e.NextInAEL
    }
  }

  public SwapPositionsInSEL(edge1: TEdge, edge2: TEdge) {
    if (edge1.NextInSEL === null && edge1.PrevInSEL === null) return
    if (edge2.NextInSEL === null && edge2.PrevInSEL === null) return
    if (edge1.NextInSEL === edge2) {
      const next = edge2.NextInSEL
      if (next !== null) next.PrevInSEL = edge1
      const prev = edge1.PrevInSEL
      if (prev !== null) prev.NextInSEL = edge2
      edge2.PrevInSEL = prev
      edge2.NextInSEL = edge1
      edge1.PrevInSEL = edge2
      edge1.NextInSEL = next
    } else if (edge2.NextInSEL === edge1) {
      const next = edge1.NextInSEL
      if (next !== null) next.PrevInSEL = edge2
      const prev = edge2.PrevInSEL
      if (prev !== null) prev.NextInSEL = edge1
      edge1.PrevInSEL = prev
      edge1.NextInSEL = edge2
      edge2.PrevInSEL = edge1
      edge2.NextInSEL = next
    } else {
      const next = edge1.NextInSEL
      const prev = edge1.PrevInSEL
      edge1.NextInSEL = edge2.NextInSEL
      if (edge1.NextInSEL !== null) edge1.NextInSEL.PrevInSEL = edge1
      edge1.PrevInSEL = edge2.PrevInSEL
      if (edge1.PrevInSEL !== null) edge1.PrevInSEL.NextInSEL = edge1
      edge2.NextInSEL = next
      if (edge2.NextInSEL !== null) edge2.NextInSEL.PrevInSEL = edge2
      edge2.PrevInSEL = prev
      if (edge2.PrevInSEL !== null) edge2.PrevInSEL.NextInSEL = edge2
    }
    if (edge1.PrevInSEL === null) this.m_SortedEdges = edge1
    else if (edge2.PrevInSEL === null) this.m_SortedEdges = edge2
  }

  public AddLocalMaxPoly(e1: TEdge, e2: TEdge, pt: IntPoint) {
    this.AddOutPt(e1, pt)
    if (e2.WindDelta === 0) this.AddOutPt(e2, pt)
    if (e1.OutIdx === e2.OutIdx) {
      e1.OutIdx = -1
      e2.OutIdx = -1
    } else if (e1.OutIdx < e2.OutIdx) this.AppendPolygon(e1, e2)
    else this.AppendPolygon(e2, e1)
  }

  public AddLocalMinPoly(e1: TEdge, e2: TEdge, pt: IntPoint) {
    let result
    let e, prevE
    if (ClipperBase.IsHorizontal(e2) || e1.Dx > e2.Dx) {
      result = this.AddOutPt(e1, pt)
      e2.OutIdx = e1.OutIdx
      e1.Side = EdgeSide.esLeft
      e2.Side = EdgeSide.esRight
      e = e1
      if (e.PrevInAEL === e2) prevE = e2.PrevInAEL
      else prevE = e.PrevInAEL
    } else {
      result = this.AddOutPt(e2, pt)
      e1.OutIdx = e2.OutIdx
      e1.Side = EdgeSide.esRight
      e2.Side = EdgeSide.esLeft
      e = e2
      if (e.PrevInAEL === e1) prevE = e1.PrevInAEL
      else prevE = e.PrevInAEL
    }

    if (prevE !== null && prevE.OutIdx >= 0 && prevE.Top.Y < pt.Y && e.Top.Y < pt.Y) {
      const xPrev = Clipper.TopX(prevE, pt.Y)
      const xE = Clipper.TopX(e, pt.Y)
      if (
        xPrev === xE &&
        e.WindDelta !== 0 &&
        prevE.WindDelta !== 0 &&
        ClipperBase.SlopesEqual(
          new IntPoint(xPrev, pt.Y),
          prevE.Top,
          new IntPoint(xE, pt.Y),
          e.Top,
          this.m_UseFullRange
        )
      ) {
        const outPt = this.AddOutPt(prevE, pt)
        this.AddJoin(result, outPt, e.Top)
      }
    }
    return result
  }

  public AddOutPt(e: TEdge, pt: IntPoint) {
    if (e.OutIdx < 0) {
      const outRec = this.CreateOutRec()
      outRec.IsOpen = e.WindDelta === 0
      const newOp = new OutPt()
      outRec.Pts = newOp
      newOp.Idx = outRec.Idx
      //newOp.Pt = pt;
      newOp.Pt.X = pt.X
      newOp.Pt.Y = pt.Y
      if (ClipperLib.use_xyz) newOp.Pt.Z = pt.Z
      newOp.Next = newOp
      newOp.Prev = newOp
      if (!outRec.IsOpen) this.SetHoleState(e, outRec)
      e.OutIdx = outRec.Idx
      //nb: do this after SetZ !
      return newOp
    } else {
      const outRec = this.m_PolyOuts[e.OutIdx]
      //OutRec.Pts is the 'Left-most' point & OutRec.Pts.Prev is the 'Right-most'
      const op = outRec.Pts
      const ToFront = e.Side === EdgeSide.esLeft
      if (ToFront && IntPoint.op_Equality(pt, op.Pt)) return op
      else if (!ToFront && IntPoint.op_Equality(pt, op.Prev.Pt)) return op.Prev
      const newOp = new OutPt()
      newOp.Idx = outRec.Idx
      //newOp.Pt = pt;
      newOp.Pt.X = pt.X
      newOp.Pt.Y = pt.Y
      if (ClipperLib.use_xyz) newOp.Pt.Z = pt.Z
      newOp.Next = op
      newOp.Prev = op.Prev
      newOp.Prev.Next = newOp
      op.Prev = newOp
      if (ToFront) outRec.Pts = newOp
      return newOp
    }
  }

  public GetLastOutPt(e: TEdge) {
    const outRec = this.m_PolyOuts[e.OutIdx]
    if (e.Side === EdgeSide.esLeft) {
      return outRec.Pts
    } else {
      return outRec.Pts.Prev
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

  public HorzSegmentsOverlap(seg1a: number, seg1b: number, seg2a: number, seg2b: number) {
    let tmp
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

  public SetHoleState(e: TEdge, outRec: OutRec) {
    let e2 = e.PrevInAEL
    let eTmp = null
    while (e2 !== null) {
      if (e2.OutIdx >= 0 && e2.WindDelta !== 0) {
        if (eTmp === null) eTmp = e2
        else if (eTmp.OutIdx === e2.OutIdx) eTmp = null //paired
      }
      e2 = e2.PrevInAEL
    }

    if (eTmp === null) {
      outRec.FirstLeft = null
      outRec.IsHole = false
    } else {
      outRec.FirstLeft = this.m_PolyOuts[eTmp.OutIdx]
      outRec.IsHole = !outRec.FirstLeft.IsHole
    }
  }

  public GetDx(pt1: IntPoint, pt2: IntPoint) {
    if (pt1.Y === pt2.Y) return ClipperBase.horizontal
    else return (pt2.X - pt1.X) / (pt2.Y - pt1.Y)
  }

  public FirstIsBottomPt(btmPt1: OutPt, btmPt2: OutPt) {
    let p = btmPt1.Prev
    while (IntPoint.op_Equality(p.Pt, btmPt1.Pt) && p !== btmPt1) p = p.Prev
    const dx1p = Math.abs(this.GetDx(btmPt1.Pt, p.Pt))
    p = btmPt1.Next
    while (IntPoint.op_Equality(p.Pt, btmPt1.Pt) && p !== btmPt1) p = p.Next
    const dx1n = Math.abs(this.GetDx(btmPt1.Pt, p.Pt))
    p = btmPt2.Prev
    while (IntPoint.op_Equality(p.Pt, btmPt2.Pt) && p !== btmPt2) p = p.Prev
    const dx2p = Math.abs(this.GetDx(btmPt2.Pt, p.Pt))
    p = btmPt2.Next
    while (IntPoint.op_Equality(p.Pt, btmPt2.Pt) && p !== btmPt2) p = p.Next
    const dx2n = Math.abs(this.GetDx(btmPt2.Pt, p.Pt))

    if (Math.max(dx1p, dx1n) === Math.max(dx2p, dx2n) && Math.min(dx1p, dx1n) === Math.min(dx2p, dx2n)) {
      return this.Area(btmPt1) > 0 //if otherwise identical use orientation
    } else {
      return (dx1p >= dx2p && dx1p >= dx2n) || (dx1n >= dx2p && dx1n >= dx2n)
    }
  }

  public GetBottomPt(pp: OutPt) {
    let dups = null
    let p = pp.Next
    while (p !== pp) {
      if (p.Pt.Y > pp.Pt.Y) {
        pp = p
        dups = null
      } else if (p.Pt.Y === pp.Pt.Y && p.Pt.X <= pp.Pt.X) {
        if (p.Pt.X < pp.Pt.X) {
          dups = null
          pp = p
        } else {
          if (p.Next !== pp && p.Prev !== pp) dups = p
        }
      }
      p = p.Next
    }
    if (dups !== null) {
      //there appears to be at least 2 vertices at bottomPt so ...
      while (dups !== p) {
        if (!this.FirstIsBottomPt(p, dups)) pp = dups
        dups = dups.Next
        while (IntPoint.op_Inequality(dups.Pt, pp.Pt)) dups = dups.Next
      }
    }
    return pp
  }

  public GetLowermostRec(outRec1: OutRec, outRec2: OutRec) {
    //work out which polygon fragment has the correct hole state ...
    if (outRec1.BottomPt === null) outRec1.BottomPt = this.GetBottomPt(outRec1.Pts)
    if (outRec2.BottomPt === null) outRec2.BottomPt = this.GetBottomPt(outRec2.Pts)
    const bPt1 = outRec1.BottomPt
    const bPt2 = outRec2.BottomPt
    if (bPt1.Pt.Y > bPt2.Pt.Y) return outRec1
    else if (bPt1.Pt.Y < bPt2.Pt.Y) return outRec2
    else if (bPt1.Pt.X < bPt2.Pt.X) return outRec1
    else if (bPt1.Pt.X > bPt2.Pt.X) return outRec2
    else if (bPt1.Next === bPt1) return outRec2
    else if (bPt2.Next === bPt2) return outRec1
    else if (this.FirstIsBottomPt(bPt1, bPt2)) return outRec1
    else return outRec2
  }

  public OutRec1RightOfOutRec2(outRec1: OutRec, outRec2: OutRec) {
    do {
      outRec1 = outRec1.FirstLeft
      if (outRec1 === outRec2) return true
    } while (outRec1 !== null)
    return false
  }

  public GetOutRec(index: number) {
    let outRec = this.m_PolyOuts[index]
    while (outRec !== this.m_PolyOuts[outRec.Idx]) outRec = this.m_PolyOuts[outRec.Idx]
    return outRec
  }

  public AppendPolygon(e1: TEdge, e2: TEdge) {
    // get the start and ends of both output polygons ...
    const outRec1 = this.m_PolyOuts[e1.OutIdx]
    const outRec2 = this.m_PolyOuts[e2.OutIdx]
    let holeStateRec
    if (this.OutRec1RightOfOutRec2(outRec1, outRec2)) holeStateRec = outRec2
    else if (this.OutRec1RightOfOutRec2(outRec2, outRec1)) holeStateRec = outRec1
    else holeStateRec = this.GetLowermostRec(outRec1, outRec2)

    // get the start and ends of both output polygons and
    // join E2 poly onto E1 poly and delete pointers to E2 ...
    const p1_lft = outRec1.Pts
    const p1_rt = p1_lft.Prev
    const p2_lft = outRec2.Pts
    const p2_rt = p2_lft.Prev

    // join e2 poly onto e1 poly and delete pointers to e2 ...
    if (e1.Side === EdgeSide.esLeft) {
      if (e2.Side === EdgeSide.esLeft) {
        // z y x a b c
        this.ReversePolyPtLinks(p2_lft)
        p2_lft.Next = p1_lft
        p1_lft.Prev = p2_lft
        p1_rt.Next = p2_rt
        p2_rt.Prev = p1_rt
        outRec1.Pts = p2_rt
      } else {
        // x y z a b c
        p2_rt.Next = p1_lft
        p1_lft.Prev = p2_rt
        p2_lft.Prev = p1_rt
        p1_rt.Next = p2_lft
        outRec1.Pts = p2_lft
      }
    } else {
      if (e2.Side === EdgeSide.esRight) {
        // a b c z y x
        this.ReversePolyPtLinks(p2_lft)
        p1_rt.Next = p2_rt
        p2_rt.Prev = p1_rt
        p2_lft.Next = p1_lft
        p1_lft.Prev = p2_lft
      } else {
        // a b c x y z
        p1_rt.Next = p2_lft
        p2_lft.Prev = p1_rt
        p1_lft.Prev = p2_rt
        p2_rt.Next = p1_lft
      }
    }
    outRec1.BottomPt = null
    if (holeStateRec === outRec2) {
      if (outRec2.FirstLeft !== outRec1) outRec1.FirstLeft = outRec2.FirstLeft
      outRec1.IsHole = outRec2.IsHole
    }
    outRec2.Pts = null
    outRec2.BottomPt = null
    outRec2.FirstLeft = outRec1
    const OKIdx = e1.OutIdx
    const ObsoleteIdx = e2.OutIdx
    e1.OutIdx = -1

    // nb: safe because we only get here via AddLocalMaxPoly
    e2.OutIdx = -1
    let e = this.m_ActiveEdges
    while (e !== null) {
      if (e.OutIdx === ObsoleteIdx) {
        e.OutIdx = OKIdx
        e.Side = e1.Side
        break
      }
      e = e.NextInAEL
    }
    outRec2.Idx = outRec1.Idx
  }

  public ReversePolyPtLinks(pp: OutPt) {
    if (pp === null) return
    let pp1
    let pp2
    pp1 = pp
    do {
      pp2 = pp1.Next
      pp1.Next = pp1.Prev
      pp1.Prev = pp2
      pp1 = pp2
    } while (pp1 !== pp)
  }

  public static SwapSides(edge1: TEdge, edge2: TEdge) {
    const side = edge1.Side
    edge1.Side = edge2.Side
    edge2.Side = side
  }

  public static SwapPolyIndexes(edge1: TEdge, edge2: TEdge) {
    const outIdx = edge1.OutIdx
    edge1.OutIdx = edge2.OutIdx
    edge2.OutIdx = outIdx
  }

  public IntersectEdges(e1: TEdge, e2: TEdge, pt: IntPoint) {
    //e1 will be to the left of e2 BELOW the intersection. Therefore e1 is before
    //e2 in AEL except when e1 is being inserted at the intersection point ...
    const e1Contributing = e1.OutIdx >= 0
    const e2Contributing = e2.OutIdx >= 0

    if (ClipperLib.use_xyz) this.SetZ(pt, e1, e2)

    if (ClipperLib.use_lines) {
      // if either edge is on an OPEN path ...
      if (e1.WindDelta === 0 || e2.WindDelta === 0) {
        // ignore subject-subject open path intersections UNLESS they
        // are both open paths, AND they are both 'contributing maximas' ...
        if (e1.WindDelta === 0 && e2.WindDelta === 0) return
        // if intersecting a subj line with a subj poly ...
        else if (e1.PolyTyp === e2.PolyTyp && e1.WindDelta !== e2.WindDelta && this.m_ClipType === ClipType.ctUnion) {
          if (e1.WindDelta === 0) {
            if (e2Contributing) {
              this.AddOutPt(e1, pt)
              if (e1Contributing) e1.OutIdx = -1
            }
          } else {
            if (e1Contributing) {
              this.AddOutPt(e2, pt)
              if (e2Contributing) e2.OutIdx = -1
            }
          }
        } else if (e1.PolyTyp !== e2.PolyTyp) {
          if (
            e1.WindDelta === 0 &&
            Math.abs(e2.WindCnt) === 1 &&
            (this.m_ClipType !== ClipType.ctUnion || e2.WindCnt2 === 0)
          ) {
            this.AddOutPt(e1, pt)
            if (e1Contributing) e1.OutIdx = -1
          } else if (
            e2.WindDelta === 0 &&
            Math.abs(e1.WindCnt) === 1 &&
            (this.m_ClipType !== ClipType.ctUnion || e1.WindCnt2 === 0)
          ) {
            this.AddOutPt(e2, pt)
            if (e2Contributing) e2.OutIdx = -1
          }
        }
        return
      }
    }

    // update winding counts...
    // assumes that e1 will be to the Right of e2 ABOVE the intersection
    if (e1.PolyTyp === e2.PolyTyp) {
      if (this.IsEvenOddFillType(e1)) {
        const oldE1WindCnt = e1.WindCnt
        e1.WindCnt = e2.WindCnt
        e2.WindCnt = oldE1WindCnt
      } else {
        if (e1.WindCnt + e2.WindDelta === 0) e1.WindCnt = -e1.WindCnt
        else e1.WindCnt += e2.WindDelta
        if (e2.WindCnt - e1.WindDelta === 0) e2.WindCnt = -e2.WindCnt
        else e2.WindCnt -= e1.WindDelta
      }
    } else {
      if (!this.IsEvenOddFillType(e2)) e1.WindCnt2 += e2.WindDelta
      else e1.WindCnt2 = e1.WindCnt2 === 0 ? 1 : 0
      if (!this.IsEvenOddFillType(e1)) e2.WindCnt2 -= e1.WindDelta
      else e2.WindCnt2 = e2.WindCnt2 === 0 ? 1 : 0
    }

    let e1FillType, e2FillType, e1FillType2, e2FillType2
    if (e1.PolyTyp === PolyType.ptSubject) {
      e1FillType = this.m_SubjFillType
      e1FillType2 = this.m_ClipFillType
    } else {
      e1FillType = this.m_ClipFillType
      e1FillType2 = this.m_SubjFillType
    }
    if (e2.PolyTyp === PolyType.ptSubject) {
      e2FillType = this.m_SubjFillType
      e2FillType2 = this.m_ClipFillType
    } else {
      e2FillType = this.m_ClipFillType
      e2FillType2 = this.m_SubjFillType
    }
    let e1Wc, e2Wc
    switch (e1FillType) {
      case PolyFillType.pftPositive:
        e1Wc = e1.WindCnt
        break
      case PolyFillType.pftNegative:
        e1Wc = -e1.WindCnt
        break
      default:
        e1Wc = Math.abs(e1.WindCnt)
        break
    }
    switch (e2FillType) {
      case PolyFillType.pftPositive:
        e2Wc = e2.WindCnt
        break
      case PolyFillType.pftNegative:
        e2Wc = -e2.WindCnt
        break
      default:
        e2Wc = Math.abs(e2.WindCnt)
        break
    }
    if (e1Contributing && e2Contributing) {
      if (
        (e1Wc !== 0 && e1Wc !== 1) ||
        (e2Wc !== 0 && e2Wc !== 1) ||
        (e1.PolyTyp !== e2.PolyTyp && this.m_ClipType !== ClipType.ctXor)
      ) {
        this.AddLocalMaxPoly(e1, e2, pt)
      } else {
        this.AddOutPt(e1, pt)
        this.AddOutPt(e2, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if (e1Contributing) {
      if (e2Wc === 0 || e2Wc === 1) {
        this.AddOutPt(e1, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if (e2Contributing) {
      if (e1Wc === 0 || e1Wc === 1) {
        this.AddOutPt(e2, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if ((e1Wc === 0 || e1Wc === 1) && (e2Wc === 0 || e2Wc === 1)) {
      //neither edge is currently contributing ...
      let e1Wc2, e2Wc2
      switch (e1FillType2) {
        case PolyFillType.pftPositive:
          e1Wc2 = e1.WindCnt2
          break
        case PolyFillType.pftNegative:
          e1Wc2 = -e1.WindCnt2
          break
        default:
          e1Wc2 = Math.abs(e1.WindCnt2)
          break
      }
      switch (e2FillType2) {
        case PolyFillType.pftPositive:
          e2Wc2 = e2.WindCnt2
          break
        case PolyFillType.pftNegative:
          e2Wc2 = -e2.WindCnt2
          break
        default:
          e2Wc2 = Math.abs(e2.WindCnt2)
          break
      }
      if (e1.PolyTyp !== e2.PolyTyp) {
        this.AddLocalMinPoly(e1, e2, pt)
      } else if (e1Wc === 1 && e2Wc === 1)
        switch (this.m_ClipType) {
          case ClipType.ctIntersection:
            if (e1Wc2 > 0 && e2Wc2 > 0) this.AddLocalMinPoly(e1, e2, pt)
            break
          case ClipType.ctUnion:
            if (e1Wc2 <= 0 && e2Wc2 <= 0) this.AddLocalMinPoly(e1, e2, pt)
            break
          case ClipType.ctDifference:
            if (
              (e1.PolyTyp === PolyType.ptClip && e1Wc2 > 0 && e2Wc2 > 0) ||
              (e1.PolyTyp === PolyType.ptSubject && e1Wc2 <= 0 && e2Wc2 <= 0)
            )
              this.AddLocalMinPoly(e1, e2, pt)
            break
          case ClipType.ctXor:
            this.AddLocalMinPoly(e1, e2, pt)
            break
        }
      else Clipper.SwapSides(e1, e2)
    }
  }

  public DeleteFromSEL(e: TEdge) {
    const SelPrev = e.PrevInSEL
    const SelNext = e.NextInSEL
    if (SelPrev === null && SelNext === null && e !== this.m_SortedEdges) return
    //already deleted
    if (SelPrev !== null) SelPrev.NextInSEL = SelNext
    else this.m_SortedEdges = SelNext
    if (SelNext !== null) SelNext.PrevInSEL = SelPrev
    e.NextInSEL = null
    e.PrevInSEL = null
  }

  public ProcessHorizontals() {
    const horzEdge = new TEdge() // {} //m_SortedEdges;
    while (this.PopEdgeFromSEL(horzEdge)) {
      this.ProcessHorizontal(horzEdge.v)
    }
  }

  public GetHorzDirection(HorzEdge: TEdge, $var: HorizontalEdgeProps) {
    if (HorzEdge.Bot.X < HorzEdge.Top.X) {
      $var.Left = HorzEdge.Bot.X
      $var.Right = HorzEdge.Top.X
      $var.Dir = Direction.dLeftToRight
    } else {
      $var.Left = HorzEdge.Top.X
      $var.Right = HorzEdge.Bot.X
      $var.Dir = Direction.dRightToLeft
    }
  }

  public ProcessHorizontal(horzEdge: TEdge) {
    const $var: HorizontalEdgeProps = {
      Dir: null,
      Left: null,
      Right: null,
    }

    this.GetHorzDirection(horzEdge, $var)
    let dir = $var.Dir
    let horzLeft = $var.Left
    let horzRight = $var.Right

    const IsOpen = horzEdge.WindDelta === 0

    let eLastHorz = horzEdge,
      eMaxPair = null
    while (eLastHorz.NextInLML !== null && ClipperBase.IsHorizontal(eLastHorz.NextInLML))
      eLastHorz = eLastHorz.NextInLML
    if (eLastHorz.NextInLML === null) eMaxPair = this.GetMaximaPair(eLastHorz)

    let currMax = this.m_Maxima
    if (currMax !== null) {
      //get the first maxima in range (X) ...
      if (dir === Direction.dLeftToRight) {
        while (currMax !== null && currMax.X <= horzEdge.Bot.X) {
          currMax = currMax.Next
        }
        if (currMax !== null && currMax.X >= eLastHorz.Top.X) {
          currMax = null
        }
      } else {
        while (currMax.Next !== null && currMax.Next.X < horzEdge.Bot.X) {
          currMax = currMax.Next
        }
        if (currMax.X <= eLastHorz.Top.X) {
          currMax = null
        }
      }
    }

    let op1 = null
    for (;;) //loop through consec. horizontal edges
    {
      const IsLastHorz = horzEdge === eLastHorz
      let e = this.GetNextInAEL(horzEdge, dir)
      while (e !== null) {
        //this code block inserts extra coords into horizontal edges (in output
        //polygons) whereever maxima touch these horizontal edges. This helps
        //'simplifying' polygons (ie if the Simplify property is set).
        if (currMax !== null) {
          if (dir === Direction.dLeftToRight) {
            while (currMax !== null && currMax.X < e.Curr.X) {
              if (horzEdge.OutIdx >= 0 && !IsOpen) {
                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.Y))
              }
              currMax = currMax.Next
            }
          } else {
            while (currMax !== null && currMax.X > e.Curr.X) {
              if (horzEdge.OutIdx >= 0 && !IsOpen) {
                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.Y))
              }
              currMax = currMax.Prev
            }
          }
        }

        if (
          (dir === Direction.dLeftToRight && e.Curr.X > horzRight) ||
          (dir === Direction.dRightToLeft && e.Curr.X < horzLeft)
        ) {
          break
        }

        //Also break if we've got to the end of an intermediate horizontal edge ...
        //nb: Smaller Dx's are to the right of larger Dx's ABOVE the horizontal.
        if (e.Curr.X === horzEdge.Top.X && horzEdge.NextInLML !== null && e.Dx < horzEdge.NextInLML.Dx) break

        if (horzEdge.OutIdx >= 0 && !IsOpen) {
          //note: may be done multiple times
          if (ClipperLib.use_xyz) {
            if (dir === Direction.dLeftToRight) this.SetZ(e.Curr, horzEdge, e)
            else this.SetZ(e.Curr, e, horzEdge)
          }

          op1 = this.AddOutPt(horzEdge, e.Curr)
          let eNextHorz = this.m_SortedEdges
          while (eNextHorz !== null) {
            if (
              eNextHorz.OutIdx >= 0 &&
              this.HorzSegmentsOverlap(horzEdge.Bot.X, horzEdge.Top.X, eNextHorz.Bot.X, eNextHorz.Top.X)
            ) {
              const op2 = this.GetLastOutPt(eNextHorz)
              this.AddJoin(op2, op1, eNextHorz.Top)
            }
            eNextHorz = eNextHorz.NextInSEL
          }
          this.AddGhostJoin(op1, horzEdge.Bot)
        }

        //OK, so far we're still in range of the horizontal Edge  but make sure
        //we're at the last of consec. horizontals when matching with eMaxPair
        if (e === eMaxPair && IsLastHorz) {
          if (horzEdge.OutIdx >= 0) {
            this.AddLocalMaxPoly(horzEdge, eMaxPair, horzEdge.Top)
          }
          this.DeleteFromAEL(horzEdge)
          this.DeleteFromAEL(eMaxPair)
          return
        }

        if (dir === Direction.dLeftToRight) {
          const Pt = new IntPoint(e.Curr.X, horzEdge.Curr.Y)
          this.IntersectEdges(horzEdge, e, Pt)
        } else {
          const Pt = new IntPoint(e.Curr.X, horzEdge.Curr.Y)
          this.IntersectEdges(e, horzEdge, Pt)
        }
        const eNext = this.GetNextInAEL(e, dir)
        this.SwapPositionsInAEL(horzEdge, e)
        e = eNext
      } //end while(e !== null)

      //Break out of loop if HorzEdge.NextInLML is not also horizontal ...
      if (horzEdge.NextInLML === null || !ClipperBase.IsHorizontal(horzEdge.NextInLML)) {
        break
      }

      horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
      if (horzEdge.OutIdx >= 0) {
        this.AddOutPt(horzEdge, horzEdge.Bot)
      }

      const $var = {
        Dir: dir,
        Left: horzLeft,
        Right: horzRight,
      }

      this.GetHorzDirection(horzEdge, $var)
      dir = $var.Dir
      horzLeft = $var.Left
      horzRight = $var.Right
    } //end for (;;)

    if (horzEdge.OutIdx >= 0 && op1 === null) {
      op1 = this.GetLastOutPt(horzEdge)
      let eNextHorz = this.m_SortedEdges
      while (eNextHorz !== null) {
        if (
          eNextHorz.OutIdx >= 0 &&
          this.HorzSegmentsOverlap(horzEdge.Bot.X, horzEdge.Top.X, eNextHorz.Bot.X, eNextHorz.Top.X)
        ) {
          const op2 = this.GetLastOutPt(eNextHorz)
          this.AddJoin(op2, op1, eNextHorz.Top)
        }
        eNextHorz = eNextHorz.NextInSEL
      }
      this.AddGhostJoin(op1, horzEdge.Top)
    }

    if (horzEdge.NextInLML !== null) {
      if (horzEdge.OutIdx >= 0) {
        op1 = this.AddOutPt(horzEdge, horzEdge.Top)

        horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
        if (horzEdge.WindDelta === 0) {
          return
        }
        //nb: HorzEdge is no longer horizontal here
        const ePrev = horzEdge.PrevInAEL
        const eNext = horzEdge.NextInAEL
        if (
          ePrev !== null &&
          ePrev.Curr.X === horzEdge.Bot.X &&
          ePrev.Curr.Y === horzEdge.Bot.Y &&
          ePrev.WindDelta === 0 &&
          ePrev.OutIdx >= 0 &&
          ePrev.Curr.Y > ePrev.Top.Y &&
          ClipperBase.SlopesEqual(horzEdge, ePrev, this.m_UseFullRange)
        ) {
          const op2 = this.AddOutPt(ePrev, horzEdge.Bot)
          this.AddJoin(op1, op2, horzEdge.Top)
        } else if (
          eNext !== null &&
          eNext.Curr.X === horzEdge.Bot.X &&
          eNext.Curr.Y === horzEdge.Bot.Y &&
          eNext.WindDelta !== 0 &&
          eNext.OutIdx >= 0 &&
          eNext.Curr.Y > eNext.Top.Y &&
          ClipperBase.SlopesEqual(horzEdge, eNext, this.m_UseFullRange)
        ) {
          const op2 = this.AddOutPt(eNext, horzEdge.Bot)
          this.AddJoin(op1, op2, horzEdge.Top)
        }
      } else {
        horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
      }
    } else {
      if (horzEdge.OutIdx >= 0) {
        this.AddOutPt(horzEdge, horzEdge.Top)
      }
      this.DeleteFromAEL(horzEdge)
    }
  }

  public GetNextInAEL(e: TEdge, direction: Direction) {
    return direction === Direction.dLeftToRight ? e.NextInAEL : e.PrevInAEL
  }

  public IsMinima(e: TEdge) {
    return e !== null && e.Prev.NextInLML !== e && e.Next.NextInLML !== e
  }

  public IsMaxima(e: TEdge, Y: number) {
    return e !== null && e.Top.Y === Y && e.NextInLML === null
  }

  public IsIntermediate(e: TEdge, Y: number) {
    return e.Top.Y === Y && e.NextInLML !== null
  }

  public GetMaximaPair(e: TEdge) {
    if (IntPoint.op_Equality(e.Next.Top, e.Top) && e.Next.NextInLML === null) {
      return e.Next
    } else {
      if (IntPoint.op_Equality(e.Prev.Top, e.Top) && e.Prev.NextInLML === null) {
        return e.Prev
      } else {
        return null
      }
    }
  }

  public GetMaximaPairEx(e: TEdge) {
    // as above but returns null if MaxPair isn't in AEL (unless it's horizontal)
    const result = this.GetMaximaPair(e)
    if (
      result === null ||
      result.OutIdx === ClipperBase.Skip ||
      (result.NextInAEL === result.PrevInAEL && !ClipperBase.IsHorizontal(result))
    ) {
      return null
    }
    return result
  }

  public ProcessIntersections(topY: number) {
    if (this.m_ActiveEdges === null) return true
    try {
      this.BuildIntersectList(topY)
      if (this.m_IntersectList.length === 0) return true
      if (this.m_IntersectList.length === 1 || this.FixupIntersectionOrder()) this.ProcessIntersectList()
      else return false
    } catch ($$e2) {
      this.m_SortedEdges = null
      this.m_IntersectList.length = 0
      ClipperLib.Error('ProcessIntersections error')
    }
    this.m_SortedEdges = null
    return true
  }

  public BuildIntersectList(topY: number) {
    if (this.m_ActiveEdges === null) return

    // prepare for sorting ...
    let e = this.m_ActiveEdges
    this.m_SortedEdges = e
    while (e !== null) {
      e.PrevInSEL = e.PrevInAEL
      e.NextInSEL = e.NextInAEL
      e.Curr.X = Clipper.TopX(e, topY)
      e = e.NextInAEL
    }

    // bubblesort ...
    let isModified = true
    while (isModified && this.m_SortedEdges !== null) {
      isModified = false
      e = this.m_SortedEdges
      while (e.NextInSEL !== null) {
        const eNext = e.NextInSEL
        let pt = new IntPoint()
        if (e.Curr.X > eNext.Curr.X) {
          this.IntersectPoint(e, eNext, pt)
          if (pt.Y < topY) pt = new IntPoint(Clipper.TopX(e, topY), topY)
          const newNode = new IntersectNode()
          newNode.Edge1 = e
          newNode.Edge2 = eNext
          //newNode.Pt = pt;
          newNode.Pt.X = pt.X
          newNode.Pt.Y = pt.Y
          if (ClipperLib.use_xyz) newNode.Pt.Z = pt.Z
          this.m_IntersectList.push(newNode)
          this.SwapPositionsInSEL(e, eNext)
          isModified = true
        } else e = eNext
      }
      if (e.PrevInSEL !== null) e.PrevInSEL.NextInSEL = null
      else break
    }
    this.m_SortedEdges = null
  }

  public EdgesAdjacent(inode: IntersectNode) {
    return inode.Edge1.NextInSEL === inode.Edge2 || inode.Edge1.PrevInSEL === inode.Edge2
  }

  public static IntersectNodeSort(node1: IntersectNode, node2: IntersectNode) {
    // the following typecast is safe because the differences in Pt.Y will
    // be limited to the height of the scanbeam.
    return node2.Pt.Y - node1.Pt.Y
  }

  public FixupIntersectionOrder() {
    // pre-condition: intersections are sorted bottom-most first.
    // Now it's crucial that intersections are made only between adjacent edges,
    // so to ensure this the order of intersections may need adjusting ...
    this.m_IntersectList.sort(this.m_IntersectNodeComparer)
    this.CopyAELToSEL()
    const cnt = this.m_IntersectList.length
    for (let i = 0; i < cnt; i++) {
      if (!this.EdgesAdjacent(this.m_IntersectList[i])) {
        let j = i + 1
        while (j < cnt && !this.EdgesAdjacent(this.m_IntersectList[j])) j++
        if (j === cnt) return false
        const tmp = this.m_IntersectList[i]
        this.m_IntersectList[i] = this.m_IntersectList[j]
        this.m_IntersectList[j] = tmp
      }
      this.SwapPositionsInSEL(this.m_IntersectList[i].Edge1, this.m_IntersectList[i].Edge2)
    }
    return true
  }

  public ProcessIntersectList() {
    for (let i = 0, len = this.m_IntersectList.length; i < len; i++) {
      const iNode = this.m_IntersectList[i]
      this.IntersectEdges(iNode.Edge1, iNode.Edge2, iNode.Pt)
      this.SwapPositionsInAEL(iNode.Edge1, iNode.Edge2)
    }
    this.m_IntersectList.length = 0
  }

  public static TopX(edge: TEdge, currentY: number) {
    //if (edge.Bot == edge.Curr) alert ("edge.Bot = edge.Curr");
    //if (edge.Bot == edge.Top) alert ("edge.Bot = edge.Top");
    if (currentY === edge.Top.Y) return edge.Top.X
    return edge.Bot.X + Clipper.Round(edge.Dx * (currentY - edge.Bot.Y))
  }

  public IntersectPoint(edge1: TEdge, edge2: TEdge, ip: IntPoint) {
    ip.X = 0
    ip.Y = 0
    let b1, b2
    //nb: with very large coordinate values, it's possible for SlopesEqual() to
    //return false but for the edge.Dx value be equal due to double precision rounding.
    if (edge1.Dx === edge2.Dx) {
      ip.Y = edge1.Curr.Y
      ip.X = Clipper.TopX(edge1, ip.Y)
      return
    }
    if (edge1.Delta.X === 0) {
      ip.X = edge1.Bot.X
      if (ClipperBase.IsHorizontal(edge2)) {
        ip.Y = edge2.Bot.Y
      } else {
        b2 = edge2.Bot.Y - edge2.Bot.X / edge2.Dx
        ip.Y = Clipper.Round(ip.X / edge2.Dx + b2)
      }
    } else if (edge2.Delta.X === 0) {
      ip.X = edge2.Bot.X
      if (ClipperBase.IsHorizontal(edge1)) {
        ip.Y = edge1.Bot.Y
      } else {
        b1 = edge1.Bot.Y - edge1.Bot.X / edge1.Dx
        ip.Y = Clipper.Round(ip.X / edge1.Dx + b1)
      }
    } else {
      b1 = edge1.Bot.X - edge1.Bot.Y * edge1.Dx
      b2 = edge2.Bot.X - edge2.Bot.Y * edge2.Dx
      const q = (b2 - b1) / (edge1.Dx - edge2.Dx)
      ip.Y = Clipper.Round(q)
      if (Math.abs(edge1.Dx) < Math.abs(edge2.Dx)) ip.X = Clipper.Round(edge1.Dx * q + b1)
      else ip.X = Clipper.Round(edge2.Dx * q + b2)
    }
    if (ip.Y < edge1.Top.Y || ip.Y < edge2.Top.Y) {
      if (edge1.Top.Y > edge2.Top.Y) {
        ip.Y = edge1.Top.Y
        ip.X = Clipper.TopX(edge2, edge1.Top.Y)
        return ip.X < edge1.Top.X
      } else ip.Y = edge2.Top.Y
      if (Math.abs(edge1.Dx) < Math.abs(edge2.Dx)) ip.X = Clipper.TopX(edge1, ip.Y)
      else ip.X = Clipper.TopX(edge2, ip.Y)
    }
    //finally, don't allow 'ip' to be BELOW curr.Y (ie bottom of scanbeam) ...
    if (ip.Y > edge1.Curr.Y) {
      ip.Y = edge1.Curr.Y
      //better to use the more vertical edge to derive X ...
      if (Math.abs(edge1.Dx) > Math.abs(edge2.Dx)) ip.X = Clipper.TopX(edge2, ip.Y)
      else ip.X = Clipper.TopX(edge1, ip.Y)
    }
  }

  public ProcessEdgesAtTopOfScanbeam(topY: number) {
    let e = this.m_ActiveEdges

    while (e !== null) {
      // 1. process maxima, treating them as if they're 'bent' horizontal edges,
      //    but exclude maxima with horizontal edges. nb: e can't be a horizontal.
      let IsMaximaEdge = this.IsMaxima(e, topY)
      if (IsMaximaEdge) {
        const eMaxPair = this.GetMaximaPairEx(e)
        IsMaximaEdge = eMaxPair === null || !ClipperBase.IsHorizontal(eMaxPair)
      }
      if (IsMaximaEdge) {
        if (this.StrictlySimple) {
          this.InsertMaxima(e.Top.X)
        }
        const ePrev = e.PrevInAEL
        this.DoMaxima(e)
        if (ePrev === null) e = this.m_ActiveEdges
        else e = ePrev.NextInAEL
      } else {
        // 2. promote horizontal edges, otherwise update Curr.X and Curr.Y ...
        if (this.IsIntermediate(e, topY) && ClipperBase.IsHorizontal(e.NextInLML)) {
          e = this.UpdateEdgeIntoAEL(e)
          if (e.OutIdx >= 0) this.AddOutPt(e, e.Bot)
          this.AddEdgeToSEL(e)
        } else {
          e.Curr.X = Clipper.TopX(e, topY)
          e.Curr.Y = topY
        }

        if (ClipperLib.use_xyz) {
          if (e.Top.Y === topY) e.Curr.Z = e.Top.Z
          else if (e.Bot.Y === topY) e.Curr.Z = e.Bot.Z
          else e.Curr.Z = 0
        }

        // When StrictlySimple and 'e' is being touched by another edge, then
        // make sure both edges have a vertex here ...
        if (this.StrictlySimple) {
          const ePrev = e.PrevInAEL
          if (
            e.OutIdx >= 0 &&
            e.WindDelta !== 0 &&
            ePrev !== null &&
            ePrev.OutIdx >= 0 &&
            ePrev.Curr.X === e.Curr.X &&
            ePrev.WindDelta !== 0
          ) {
            const ip = new IntPoint(e.Curr)

            if (ClipperLib.use_xyz) {
              this.SetZ(ip, ePrev, e)
            }

            const op = this.AddOutPt(ePrev, ip)
            const op2 = this.AddOutPt(e, ip)
            this.AddJoin(op, op2, ip) // StrictlySimple (type-3) join
          }
        }
        e = e.NextInAEL
      }
    }
    // 3. Process horizontals at the Top of the scanbeam ...
    this.ProcessHorizontals()
    this.m_Maxima = null

    // 4. Promote intermediate vertices ...
    e = this.m_ActiveEdges
    while (e !== null) {
      if (this.IsIntermediate(e, topY)) {
        let op = null
        if (e.OutIdx >= 0) op = this.AddOutPt(e, e.Top)
        e = this.UpdateEdgeIntoAEL(e)
        // if output polygons share an edge, they'll need joining later ...
        const ePrev = e.PrevInAEL
        const eNext = e.NextInAEL

        if (
          ePrev !== null &&
          ePrev.Curr.X === e.Bot.X &&
          ePrev.Curr.Y === e.Bot.Y &&
          op !== null &&
          ePrev.OutIdx >= 0 &&
          ePrev.Curr.Y === ePrev.Top.Y &&
          ClipperBase.SlopesEqual(e.Curr, e.Top, ePrev.Curr, ePrev.Top, this.m_UseFullRange) &&
          e.WindDelta !== 0 &&
          ePrev.WindDelta !== 0
        ) {
          const op2 = this.AddOutPt(ePrev, e.Bot)
          this.AddJoin(op, op2, e.Top)
        } else if (
          eNext !== null &&
          eNext.Curr.X === e.Bot.X &&
          eNext.Curr.Y === e.Bot.Y &&
          op !== null &&
          eNext.OutIdx >= 0 &&
          eNext.Curr.Y === eNext.Top.Y &&
          ClipperBase.SlopesEqual(e.Curr, e.Top, eNext.Curr, eNext.Top, this.m_UseFullRange) &&
          e.WindDelta !== 0 &&
          eNext.WindDelta !== 0
        ) {
          const op2 = this.AddOutPt(eNext, e.Bot)
          this.AddJoin(op, op2, e.Top)
        }
      }
      e = e.NextInAEL
    }
  }

  public DoMaxima(e: TEdge) {
    const eMaxPair = this.GetMaximaPairEx(e)
    if (eMaxPair === null) {
      if (e.OutIdx >= 0) this.AddOutPt(e, e.Top)
      this.DeleteFromAEL(e)
      return
    }
    let eNext = e.NextInAEL
    while (eNext !== null && eNext !== eMaxPair) {
      this.IntersectEdges(e, eNext, e.Top)
      this.SwapPositionsInAEL(e, eNext)
      eNext = e.NextInAEL
    }
    if (e.OutIdx === -1 && eMaxPair.OutIdx === -1) {
      this.DeleteFromAEL(e)
      this.DeleteFromAEL(eMaxPair)
    } else if (e.OutIdx >= 0 && eMaxPair.OutIdx >= 0) {
      if (e.OutIdx >= 0) this.AddLocalMaxPoly(e, eMaxPair, e.Top)
      this.DeleteFromAEL(e)
      this.DeleteFromAEL(eMaxPair)
    } else if (ClipperLib.use_lines && e.WindDelta === 0) {
      if (e.OutIdx >= 0) {
        this.AddOutPt(e, e.Top)
        e.OutIdx = ClipperBase.Unassigned
      }
      this.DeleteFromAEL(e)
      if (eMaxPair.OutIdx >= 0) {
        this.AddOutPt(eMaxPair, e.Top)
        eMaxPair.OutIdx = ClipperBase.Unassigned
      }
      this.DeleteFromAEL(eMaxPair)
    } else ClipperLib.Error('DoMaxima error')
  }

  public static ReversePaths(polys: Paths) {
    for (let i = 0, len = polys.length; i < len; i++) polys[i].reverse()
  }

  public static Orientation(poly: Path) {
    return Clipper.Area(poly) >= 0
  }

  public PointCount(pts: OutPt) {
    if (pts === null) return 0
    let result = 0
    let p = pts
    do {
      result++
      p = p.Next
    } while (p !== pts)
    return result
  }

  public BuildResult(pattern: PolyTree | Paths) {
    if (pattern instanceof Paths) {
      ClipperLib.Clear(pattern)
      for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
        const outRec = this.m_PolyOuts[i]
        if (outRec.Pts === null) continue
        let p = outRec.Pts.Prev
        const cnt = this.PointCount(p)
        if (cnt < 2) continue
        const pg = new Path(cnt)
        for (let j = 0; j < cnt; j++) {
          pg[j] = p.Pt
          p = p.Prev
        }
        pattern.push(pg)
      }
    } else if (pattern) {
      pattern.Clear()
      // add each output polygon/contour to polytree ...
      // polytree.m_AllPolys.set_Capacity(this.m_PolyOuts.length);
      for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
        const outRec = this.m_PolyOuts[i]
        const cnt = this.PointCount(outRec.Pts)
        if ((outRec.IsOpen && cnt < 2) || (!outRec.IsOpen && cnt < 3)) continue
        this.FixHoleLinkage(outRec)
        const pn = new PolyNode()
        pattern.m_AllPolys.push(pn)
        outRec.PolyNode = pn
        pn.m_polygon.length = cnt
        let op = outRec.Pts.Prev
        for (let j = 0; j < cnt; j++) {
          pn.m_polygon[j] = op.Pt
          op = op.Prev
        }
      }
      // fixup PolyNode links etc ...
      // polytree.m_Childs.set_Capacity(this.m_PolyOuts.length);
      for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
        const outRec = this.m_PolyOuts[i]
        if (outRec.PolyNode === null) continue
        else if (outRec.IsOpen) {
          outRec.PolyNode.IsOpen = true
          pattern.AddChild(outRec.PolyNode)
        } else if (outRec.FirstLeft !== null && outRec.FirstLeft.PolyNode !== null)
          outRec.FirstLeft.PolyNode.AddChild(outRec.PolyNode)
        else pattern.AddChild(outRec.PolyNode)
      }
    }
  }

  public FixupOutPolyline(outRec: OutRec) {
    let pp = outRec.Pts
    let lastPP = pp.Prev
    while (pp !== lastPP) {
      pp = pp.Next
      if (IntPoint.op_Equality(pp.Pt, pp.Prev.Pt)) {
        if (pp === lastPP) {
          lastPP = pp.Prev
        }
        const tmpPP = pp.Prev
        tmpPP.Next = pp.Next
        pp.Next.Prev = tmpPP
        pp = tmpPP
      }
    }
    if (pp === pp.Prev) {
      outRec.Pts = null
    }
  }

  public FixupOutPolygon(outRec: OutRec) {
    //FixupOutPolygon() - removes duplicate points and simplifies consecutive
    //parallel edges by removing the middle vertex.
    let lastOK = null
    outRec.BottomPt = null
    let pp = outRec.Pts
    const preserveCol = this.PreserveCollinear || this.StrictlySimple
    for (;;) {
      if (pp.Prev === pp || pp.Prev === pp.Next) {
        outRec.Pts = null
        return
      }

      //test for duplicate points and collinear edges ...
      if (
        IntPoint.op_Equality(pp.Pt, pp.Next.Pt) ||
        IntPoint.op_Equality(pp.Pt, pp.Prev.Pt) ||
        (ClipperBase.SlopesEqual(pp.Prev.Pt, pp.Pt, pp.Next.Pt, this.m_UseFullRange) &&
          (!preserveCol || !this.Pt2IsBetweenPt1AndPt3(pp.Prev.Pt, pp.Pt, pp.Next.Pt)))
      ) {
        lastOK = null
        pp.Prev.Next = pp.Next
        pp.Next.Prev = pp.Prev
        pp = pp.Prev
      } else if (pp === lastOK) break
      else {
        if (lastOK === null) lastOK = pp
        pp = pp.Next
      }
    }
    outRec.Pts = pp
  }

  public DupOutPt(outPt: OutPt, InsertAfter?: boolean) {
    const result = new OutPt()
    //result.Pt = outPt.Pt;
    result.Pt.X = outPt.Pt.X
    result.Pt.Y = outPt.Pt.Y
    if (ClipperLib.use_xyz) result.Pt.Z = outPt.Pt.Z
    result.Idx = outPt.Idx
    if (InsertAfter) {
      result.Next = outPt.Next
      result.Prev = outPt
      outPt.Next.Prev = result
      outPt.Next = result
    } else {
      result.Prev = outPt.Prev
      result.Next = outPt
      outPt.Prev.Next = result
      outPt.Prev = result
    }
    return result
  }

  public GetOverlap(a1: number, a2: number, b1: number, b2: number, $val: OverlapProps) {
    if (a1 < a2) {
      if (b1 < b2) {
        $val.Left = Math.max(a1, b1)
        $val.Right = Math.min(a2, b2)
      } else {
        $val.Left = Math.max(a1, b2)
        $val.Right = Math.min(a2, b1)
      }
    } else {
      if (b1 < b2) {
        $val.Left = Math.max(a2, b1)
        $val.Right = Math.min(a1, b2)
      } else {
        $val.Left = Math.max(a2, b2)
        $val.Right = Math.min(a1, b1)
      }
    }
    return $val.Left < $val.Right
  }

  public JoinHorz(op1: OutPt, op1b: OutPt, op2: OutPt, op2b: OutPt, Pt: IntPoint, DiscardLeft?: boolean) {
    const Dir1 = op1.Pt.X > op1b.Pt.X ? Direction.dRightToLeft : Direction.dLeftToRight
    const Dir2 = op2.Pt.X > op2b.Pt.X ? Direction.dRightToLeft : Direction.dLeftToRight
    if (Dir1 === Dir2) return false
    //When DiscardLeft, we want Op1b to be on the Left of Op1, otherwise we
    //want Op1b to be on the Right. (And likewise with Op2 and Op2b.)
    //So, to facilitate this while inserting Op1b and Op2b ...
    //when DiscardLeft, make sure we're AT or RIGHT of Pt before adding Op1b,
    //otherwise make sure we're AT or LEFT of Pt. (Likewise with Op2b.)
    if (Dir1 === Direction.dLeftToRight) {
      while (op1.Next.Pt.X <= Pt.X && op1.Next.Pt.X >= op1.Pt.X && op1.Next.Pt.Y === Pt.Y) op1 = op1.Next
      if (DiscardLeft && op1.Pt.X !== Pt.X) op1 = op1.Next
      op1b = this.DupOutPt(op1, !DiscardLeft)
      if (IntPoint.op_Inequality(op1b.Pt, Pt)) {
        op1 = op1b
        //op1.Pt = Pt;
        op1.Pt.X = Pt.X
        op1.Pt.Y = Pt.Y
        if (ClipperLib.use_xyz) op1.Pt.Z = Pt.Z
        op1b = this.DupOutPt(op1, !DiscardLeft)
      }
    } else {
      while (op1.Next.Pt.X >= Pt.X && op1.Next.Pt.X <= op1.Pt.X && op1.Next.Pt.Y === Pt.Y) op1 = op1.Next
      if (!DiscardLeft && op1.Pt.X !== Pt.X) op1 = op1.Next
      op1b = this.DupOutPt(op1, DiscardLeft)
      if (IntPoint.op_Inequality(op1b.Pt, Pt)) {
        op1 = op1b
        //op1.Pt = Pt;
        op1.Pt.X = Pt.X
        op1.Pt.Y = Pt.Y
        if (ClipperLib.use_xyz) op1.Pt.Z = Pt.Z
        op1b = this.DupOutPt(op1, DiscardLeft)
      }
    }
    if (Dir2 === Direction.dLeftToRight) {
      while (op2.Next.Pt.X <= Pt.X && op2.Next.Pt.X >= op2.Pt.X && op2.Next.Pt.Y === Pt.Y) op2 = op2.Next
      if (DiscardLeft && op2.Pt.X !== Pt.X) op2 = op2.Next
      op2b = this.DupOutPt(op2, !DiscardLeft)
      if (IntPoint.op_Inequality(op2b.Pt, Pt)) {
        op2 = op2b
        //op2.Pt = Pt;
        op2.Pt.X = Pt.X
        op2.Pt.Y = Pt.Y
        if (ClipperLib.use_xyz) op2.Pt.Z = Pt.Z
        op2b = this.DupOutPt(op2, !DiscardLeft)
      }
    } else {
      while (op2.Next.Pt.X >= Pt.X && op2.Next.Pt.X <= op2.Pt.X && op2.Next.Pt.Y === Pt.Y) op2 = op2.Next
      if (!DiscardLeft && op2.Pt.X !== Pt.X) op2 = op2.Next
      op2b = this.DupOutPt(op2, DiscardLeft)
      if (IntPoint.op_Inequality(op2b.Pt, Pt)) {
        op2 = op2b
        //op2.Pt = Pt;
        op2.Pt.X = Pt.X
        op2.Pt.Y = Pt.Y
        if (ClipperLib.use_xyz) op2.Pt.Z = Pt.Z
        op2b = this.DupOutPt(op2, DiscardLeft)
      }
    }
    if ((Dir1 === Direction.dLeftToRight) === DiscardLeft) {
      op1.Prev = op2
      op2.Next = op1
      op1b.Next = op2b
      op2b.Prev = op1b
    } else {
      op1.Next = op2
      op2.Prev = op1
      op1b.Prev = op2b
      op2b.Next = op1b
    }
    return true
  }

  public JoinPoints(j: Join, outRec1: OutRec, outRec2: OutRec) {
    let op1 = j.OutPt1,
      op1b = new OutPt()
    let op2 = j.OutPt2,
      op2b = new OutPt()
    /**
     * There are 3 kinds of joins for output polygons ...
     * 1. Horizontal joins where Join.OutPt1 & Join.OutPt2 are vertices anywhere
     * along (horizontal) collinear edges (& Join.OffPt is on the same horizontal).
     * 2. Non-horizontal joins where Join.OutPt1 & Join.OutPt2 are at the same
     * location at the Bottom of the overlapping segment (& Join.OffPt is above).
     * 3. StrictlySimple joins where edges touch but are not collinear and where
     * Join.OutPt1, Join.OutPt2 & Join.OffPt all share the same point.
     */
    const isHorizontal = j.OutPt1.Pt.Y === j.OffPt.Y
    if (isHorizontal && IntPoint.op_Equality(j.OffPt, j.OutPt1.Pt) && IntPoint.op_Equality(j.OffPt, j.OutPt2.Pt)) {
      //Strictly Simple join ...
      if (outRec1 !== outRec2) return false

      op1b = j.OutPt1.Next
      while (op1b !== op1 && IntPoint.op_Equality(op1b.Pt, j.OffPt)) op1b = op1b.Next
      const reverse1 = op1b.Pt.Y > j.OffPt.Y
      op2b = j.OutPt2.Next
      while (op2b !== op2 && IntPoint.op_Equality(op2b.Pt, j.OffPt)) op2b = op2b.Next
      const reverse2 = op2b.Pt.Y > j.OffPt.Y
      if (reverse1 === reverse2) return false
      if (reverse1) {
        op1b = this.DupOutPt(op1, false)
        op2b = this.DupOutPt(op2, true)
        op1.Prev = op2
        op2.Next = op1
        op1b.Next = op2b
        op2b.Prev = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      } else {
        op1b = this.DupOutPt(op1, true)
        op2b = this.DupOutPt(op2, false)
        op1.Next = op2
        op2.Prev = op1
        op1b.Prev = op2b
        op2b.Next = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      }
    } else if (isHorizontal) {
      //treat horizontal joins differently to non-horizontal joins since with
      //them we're not yet sure where the overlapping is. OutPt1.Pt & OutPt2.Pt
      //may be anywhere along the horizontal edge.
      op1b = op1
      while (op1.Prev.Pt.Y === op1.Pt.Y && op1.Prev !== op1b && op1.Prev !== op2) op1 = op1.Prev
      while (op1b.Next.Pt.Y === op1b.Pt.Y && op1b.Next !== op1 && op1b.Next !== op2) op1b = op1b.Next
      if (op1b.Next === op1 || op1b.Next === op2) return false
      //a flat 'polygon'
      op2b = op2
      while (op2.Prev.Pt.Y === op2.Pt.Y && op2.Prev !== op2b && op2.Prev !== op1b) op2 = op2.Prev
      while (op2b.Next.Pt.Y === op2b.Pt.Y && op2b.Next !== op2 && op2b.Next !== op1) op2b = op2b.Next
      if (op2b.Next === op2 || op2b.Next === op1) return false
      //a flat 'polygon'
      //Op1 -. Op1b & Op2 -. Op2b are the extremites of the horizontal edges

      const $val: OverlapProps = {
        Left: null,
        Right: null,
      }

      if (!this.GetOverlap(op1.Pt.X, op1b.Pt.X, op2.Pt.X, op2b.Pt.X, $val)) return false
      const Left = $val.Left
      const Right = $val.Right

      //DiscardLeftSide: when overlapping edges are joined, a spike will created
      //which needs to be cleaned up. However, we don't want Op1 or Op2 caught up
      //on the discard Side as either may still be needed for other joins ...
      const Pt = new IntPoint()
      let DiscardLeftSide
      if (op1.Pt.X >= Left && op1.Pt.X <= Right) {
        //Pt = op1.Pt;
        Pt.X = op1.Pt.X
        Pt.Y = op1.Pt.Y
        if (ClipperLib.use_xyz) Pt.Z = op1.Pt.Z
        DiscardLeftSide = op1.Pt.X > op1b.Pt.X
      } else if (op2.Pt.X >= Left && op2.Pt.X <= Right) {
        //Pt = op2.Pt;
        Pt.X = op2.Pt.X
        Pt.Y = op2.Pt.Y
        if (ClipperLib.use_xyz) Pt.Z = op2.Pt.Z
        DiscardLeftSide = op2.Pt.X > op2b.Pt.X
      } else if (op1b.Pt.X >= Left && op1b.Pt.X <= Right) {
        //Pt = op1b.Pt;
        Pt.X = op1b.Pt.X
        Pt.Y = op1b.Pt.Y
        if (ClipperLib.use_xyz) Pt.Z = op1b.Pt.Z
        DiscardLeftSide = op1b.Pt.X > op1.Pt.X
      } else {
        //Pt = op2b.Pt;
        Pt.X = op2b.Pt.X
        Pt.Y = op2b.Pt.Y
        if (ClipperLib.use_xyz) Pt.Z = op2b.Pt.Z
        DiscardLeftSide = op2b.Pt.X > op2.Pt.X
      }
      j.OutPt1 = op1
      j.OutPt2 = op2
      return this.JoinHorz(op1, op1b, op2, op2b, Pt, DiscardLeftSide)
    } else {
      //nb: For non-horizontal joins ...
      //    1. Jr.OutPt1.Pt.Y == Jr.OutPt2.Pt.Y
      //    2. Jr.OutPt1.Pt > Jr.OffPt.Y
      //make sure the polygons are correctly oriented ...
      op1b = op1.Next
      while (IntPoint.op_Equality(op1b.Pt, op1.Pt) && op1b !== op1) op1b = op1b.Next
      const Reverse1 = op1b.Pt.Y > op1.Pt.Y || !ClipperBase.SlopesEqual(op1.Pt, op1b.Pt, j.OffPt, this.m_UseFullRange)
      if (Reverse1) {
        op1b = op1.Prev
        while (IntPoint.op_Equality(op1b.Pt, op1.Pt) && op1b !== op1) op1b = op1b.Prev

        if (op1b.Pt.Y > op1.Pt.Y || !ClipperBase.SlopesEqual(op1.Pt, op1b.Pt, j.OffPt, this.m_UseFullRange))
          return false
      }
      op2b = op2.Next
      while (IntPoint.op_Equality(op2b.Pt, op2.Pt) && op2b !== op2) op2b = op2b.Next

      const Reverse2 = op2b.Pt.Y > op2.Pt.Y || !ClipperBase.SlopesEqual(op2.Pt, op2b.Pt, j.OffPt, this.m_UseFullRange)
      if (Reverse2) {
        op2b = op2.Prev
        while (IntPoint.op_Equality(op2b.Pt, op2.Pt) && op2b !== op2) op2b = op2b.Prev

        if (op2b.Pt.Y > op2.Pt.Y || !ClipperBase.SlopesEqual(op2.Pt, op2b.Pt, j.OffPt, this.m_UseFullRange))
          return false
      }
      if (op1b === op1 || op2b === op2 || op1b === op2b || (outRec1 === outRec2 && Reverse1 === Reverse2)) return false
      if (Reverse1) {
        op1b = this.DupOutPt(op1, false)
        op2b = this.DupOutPt(op2, true)
        op1.Prev = op2
        op2.Next = op1
        op1b.Next = op2b
        op2b.Prev = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      } else {
        op1b = this.DupOutPt(op1, true)
        op2b = this.DupOutPt(op2, false)
        op1.Next = op2
        op2.Prev = op1
        op1b.Prev = op2b
        op2b.Next = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      }
    }
  }

  public static GetBounds(paths: Paths | OutPt) {
    if (paths instanceof Paths) {
      const cnt = paths.length
      let i = 0
      while (i < cnt && paths[i].length === 0) i++
      if (i === cnt) return new IntRect(0, 0, 0, 0)
      const result = new IntRect()
      result.left = paths[i][0].X
      result.right = result.left
      result.top = paths[i][0].Y
      result.bottom = result.top
      for (; i < cnt; i++)
        for (let j = 0, len = paths[i].length; j < len; j++) {
          if (paths[i][j].X < result.left) result.left = paths[i][j].X
          else if (paths[i][j].X > result.right) result.right = paths[i][j].X
          if (paths[i][j].Y < result.top) result.top = paths[i][j].Y
          else if (paths[i][j].Y > result.bottom) result.bottom = paths[i][j].Y
        }
      return result
    } else {
      const opStart = paths
      const result = new IntRect()
      result.left = paths.Pt.X
      result.right = paths.Pt.X
      result.top = paths.Pt.Y
      result.bottom = paths.Pt.Y
      paths = paths.Next
      while (paths !== opStart) {
        if (paths.Pt.X < result.left) result.left = paths.Pt.X
        if (paths.Pt.X > result.right) result.right = paths.Pt.X
        if (paths.Pt.Y < result.top) result.top = paths.Pt.Y
        if (paths.Pt.Y > result.bottom) result.bottom = paths.Pt.Y
        paths = paths.Next
      }
      return result
    }
  }

  public static PointInPolygon(pt: IntPoint, path: Path) {
    // returns 0 if false, +1 if true, -1 if pt ON polygon boundary
    // See "The Point in Polygon Problem for Arbitrary Polygons" by Hormann & Agathos
    // http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.5498&rep=rep1&type=pdf
    const cnt = path.length
    let result = 0
    if (cnt < 3) return 0
    let ip = path[0]
    for (let i = 1; i <= cnt; ++i) {
      const ipNext = i === cnt ? path[0] : path[i]
      if (ipNext.Y === pt.Y) {
        if (ipNext.X === pt.X || (ip.Y === pt.Y && ipNext.X > pt.X === ip.X < pt.X)) return -1
      }
      if (ip.Y < pt.Y !== ipNext.Y < pt.Y) {
        if (ip.X >= pt.X) {
          if (ipNext.X > pt.X) result = 1 - result
          else {
            const d = (ip.X - pt.X) * (ipNext.Y - pt.Y) - (ipNext.X - pt.X) * (ip.Y - pt.Y)
            if (d === 0) return -1
            else if (d > 0 === ipNext.Y > ip.Y) result = 1 - result
          }
        } else {
          if (ipNext.X > pt.X) {
            const d = (ip.X - pt.X) * (ipNext.Y - pt.Y) - (ipNext.X - pt.X) * (ip.Y - pt.Y)
            if (d === 0) return -1
            else if (d > 0 === ipNext.Y > ip.Y) result = 1 - result
          }
        }
      }
      ip = ipNext
    }
    return result
  }

  public PointInPolygon(pt: IntPoint, op: OutPt) {
    //returns 0 if false, +1 if true, -1 if pt ON polygon boundary
    let result = 0
    const startOp = op
    const ptx = pt.X,
      pty = pt.Y
    let poly0x = op.Pt.X,
      poly0y = op.Pt.Y
    do {
      op = op.Next
      const poly1x = op.Pt.X,
        poly1y = op.Pt.Y
      if (poly1y === pty) {
        if (poly1x === ptx || (poly0y === pty && poly1x > ptx === poly0x < ptx)) return -1
      }
      if (poly0y < pty !== poly1y < pty) {
        if (poly0x >= ptx) {
          if (poly1x > ptx) result = 1 - result
          else {
            const d = (poly0x - ptx) * (poly1y - pty) - (poly1x - ptx) * (poly0y - pty)
            if (d === 0) return -1
            if (d > 0 === poly1y > poly0y) result = 1 - result
          }
        } else {
          if (poly1x > ptx) {
            const d = (poly0x - ptx) * (poly1y - pty) - (poly1x - ptx) * (poly0y - pty)
            if (d === 0) return -1
            if (d > 0 === poly1y > poly0y) result = 1 - result
          }
        }
      }
      poly0x = poly1x
      poly0y = poly1y
    } while (startOp !== op)

    return result
  }

  public Poly2ContainsPoly1(outPt1: OutPt, outPt2: OutPt) {
    let op = outPt1
    do {
      //nb: PointInPolygon returns 0 if false, +1 if true, -1 if pt on polygon
      const res = this.PointInPolygon(op.Pt, outPt2)
      if (res >= 0) return res > 0
      op = op.Next
    } while (op !== outPt1)
    return true
  }

  public FixupFirstLefts1(OldOutRec: OutRec, NewOutRec: OutRec) {
    let outRec, firstLeft
    for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
      outRec = this.m_PolyOuts[i]
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (outRec.Pts !== null && firstLeft === OldOutRec) {
        if (this.Poly2ContainsPoly1(outRec.Pts, NewOutRec.Pts)) outRec.FirstLeft = NewOutRec
      }
    }
  }

  public FixupFirstLefts2(innerOutRec: OutRec, outerOutRec: OutRec) {
    // A polygon has split into two such that one is now the inner of the other.
    // It's possible that these polygons now wrap around other polygons, so check
    // every polygon that's also contained by OuterOutRec's FirstLeft container
    // (including nil) to see if they've become inner to the new inner polygon ...
    const orfl = outerOutRec.FirstLeft
    let outRec, firstLeft
    for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
      outRec = this.m_PolyOuts[i]
      if (outRec.Pts === null || outRec === outerOutRec || outRec === innerOutRec) continue
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (firstLeft !== orfl && firstLeft !== innerOutRec && firstLeft !== outerOutRec) continue
      if (this.Poly2ContainsPoly1(outRec.Pts, innerOutRec.Pts)) outRec.FirstLeft = innerOutRec
      else if (this.Poly2ContainsPoly1(outRec.Pts, outerOutRec.Pts)) outRec.FirstLeft = outerOutRec
      else if (outRec.FirstLeft === innerOutRec || outRec.FirstLeft === outerOutRec) outRec.FirstLeft = orfl
    }
  }

  public FixupFirstLefts3(OldOutRec: OutRec, NewOutRec: OutRec) {
    //same as FixupFirstLefts1 but doesn't call Poly2ContainsPoly1()
    let outRec
    let firstLeft
    for (let i = 0, len = this.m_PolyOuts.length; i < len; i++) {
      outRec = this.m_PolyOuts[i]
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (outRec.Pts !== null && firstLeft === OldOutRec) outRec.FirstLeft = NewOutRec
    }
  }

  public static ParseFirstLeft(FirstLeft: OutRec) {
    while (FirstLeft !== null && FirstLeft.Pts === null) FirstLeft = FirstLeft.FirstLeft
    return FirstLeft
  }

  public JoinCommonEdges() {
    for (let i = 0, len = this.m_Joins.length; i < len; i++) {
      const join = this.m_Joins[i]
      const outRec1 = this.GetOutRec(join.OutPt1.Idx)
      let outRec2 = this.GetOutRec(join.OutPt2.Idx)
      if (outRec1.Pts === null || outRec2.Pts === null) continue

      if (outRec1.IsOpen || outRec2.IsOpen) {
        continue
      }

      // get the polygon fragment with the correct hole state (FirstLeft) before calling JoinPoints() ...
      let holeStateRec: OutRec
      if (outRec1 === outRec2) holeStateRec = outRec1
      else if (this.OutRec1RightOfOutRec2(outRec1, outRec2)) holeStateRec = outRec2
      else if (this.OutRec1RightOfOutRec2(outRec2, outRec1)) holeStateRec = outRec1
      else holeStateRec = this.GetLowermostRec(outRec1, outRec2)

      if (!this.JoinPoints(join, outRec1, outRec2)) continue

      if (outRec1 === outRec2) {
        // instead of joining two polygons, we've just created a new one by splitting one polygon into two.
        outRec1.Pts = join.OutPt1
        outRec1.BottomPt = null
        outRec2 = this.CreateOutRec()
        outRec2.Pts = join.OutPt2
        //update all OutRec2.Pts Idx's ...
        this.UpdateOutPtIdxs(outRec2)

        if (this.Poly2ContainsPoly1(outRec2.Pts, outRec1.Pts)) {
          //outRec1 contains outRec2 ...
          outRec2.IsHole = !outRec1.IsHole
          outRec2.FirstLeft = outRec1
          if (this.m_UsingPolyTree) this.FixupFirstLefts2(outRec2, outRec1)
          if ((+outRec2.IsHole ^ +this.ReverseSolution) === +(this.Area(outRec2.Pts) > 0))
            this.ReversePolyPtLinks(outRec2.Pts)
        } else if (this.Poly2ContainsPoly1(outRec1.Pts, outRec2.Pts)) {
          //outRec2 contains outRec1 ...
          outRec2.IsHole = outRec1.IsHole
          outRec1.IsHole = !outRec2.IsHole
          outRec2.FirstLeft = outRec1.FirstLeft
          outRec1.FirstLeft = outRec2
          if (this.m_UsingPolyTree) this.FixupFirstLefts2(outRec1, outRec2)

          if ((+outRec1.IsHole ^ +this.ReverseSolution) === +(this.Area(outRec1.Pts) > 0))
            this.ReversePolyPtLinks(outRec1.Pts)
        } else {
          //the 2 polygons are completely separate ...
          outRec2.IsHole = outRec1.IsHole
          outRec2.FirstLeft = outRec1.FirstLeft
          //fixup FirstLeft pointers that may need reassigning to OutRec2
          if (this.m_UsingPolyTree) this.FixupFirstLefts1(outRec1, outRec2)
        }
      } else {
        //joined 2 polygons together ...
        outRec2.Pts = null
        outRec2.BottomPt = null
        outRec2.Idx = outRec1.Idx
        outRec1.IsHole = holeStateRec.IsHole
        if (holeStateRec === outRec2) outRec1.FirstLeft = outRec2.FirstLeft
        outRec2.FirstLeft = outRec1
        //fixup FirstLeft pointers that may need reassigning to OutRec1
        if (this.m_UsingPolyTree) this.FixupFirstLefts3(outRec2, outRec1)
      }
    }
  }

  public UpdateOutPtIdxs(outRec: OutRec) {
    let op = outRec.Pts
    do {
      op.Idx = outRec.Idx
      op = op.Prev
    } while (op !== outRec.Pts)
  }

  public DoSimplePolygons() {
    let i = 0
    while (i < this.m_PolyOuts.length) {
      const outRec = this.m_PolyOuts[i++]
      let op = outRec.Pts
      if (op === null || outRec.IsOpen) continue
      do //for each Pt in Polygon until duplicate found do ...
      {
        let op2 = op.Next
        while (op2 !== outRec.Pts) {
          if (IntPoint.op_Equality(op.Pt, op2.Pt) && op2.Next !== op && op2.Prev !== op) {
            //split the polygon into two ...
            const op3 = op.Prev
            const op4 = op2.Prev
            op.Prev = op4
            op4.Next = op
            op2.Prev = op3
            op3.Next = op2
            outRec.Pts = op
            const outRec2 = this.CreateOutRec()
            outRec2.Pts = op2
            this.UpdateOutPtIdxs(outRec2)
            if (this.Poly2ContainsPoly1(outRec2.Pts, outRec.Pts)) {
              //OutRec2 is contained by OutRec1 ...
              outRec2.IsHole = !outRec.IsHole
              outRec2.FirstLeft = outRec
              if (this.m_UsingPolyTree) this.FixupFirstLefts2(outRec2, outRec)
            } else if (this.Poly2ContainsPoly1(outRec.Pts, outRec2.Pts)) {
              //OutRec1 is contained by OutRec2 ...
              outRec2.IsHole = outRec.IsHole
              outRec.IsHole = !outRec2.IsHole
              outRec2.FirstLeft = outRec.FirstLeft
              outRec.FirstLeft = outRec2
              if (this.m_UsingPolyTree) this.FixupFirstLefts2(outRec, outRec2)
            } else {
              //the 2 polygons are separate ...
              outRec2.IsHole = outRec.IsHole
              outRec2.FirstLeft = outRec.FirstLeft
              if (this.m_UsingPolyTree) this.FixupFirstLefts1(outRec, outRec2)
            }
            op2 = op
            //ie get ready for the next iteration
          }
          op2 = op2.Next
        }
        op = op.Next
      } while (op !== outRec.Pts)
    }
  }

  public static Area(poly: Path) {
    if (!Array.isArray(poly)) return 0
    const cnt = poly.length
    if (cnt < 3) return 0
    let a = 0
    for (let i = 0, j = cnt - 1; i < cnt; ++i) {
      a += (poly[j].X + poly[i].X) * (poly[j].Y - poly[i].Y)
      j = i
    }
    return -a * 0.5
  }

  public Area(op: OutPt) {
    const opFirst = op
    if (op === null) return 0
    let a = 0
    do {
      a = a + (op.Prev.Pt.X + op.Pt.X) * (op.Prev.Pt.Y - op.Pt.Y)
      op = op.Next
    } while (op !== opFirst) // && typeof op !== 'undefined');
    return a * 0.5
  }

  public Areafunction(outRec: OutRec) {
    return this.Area(outRec.Pts)
  }

  // TODO: Check if unused
  public static SimplifyPolygon(poly: Path, fillType: PolyFillType) {
    const result = new Paths()
    const c = new Clipper(0)
    c.StrictlySimple = true
    c.AddPath(poly, PolyType.ptSubject, true)
    c.Execute(ClipType.ctUnion, result, fillType, fillType)
    return result
  }

  public static SimplifyPolygons(polys: Paths, fillType: PolyFillType) {
    if (typeof fillType === 'undefined') fillType = PolyFillType.pftEvenOdd
    const result = new Paths()
    const c = new Clipper(0)
    c.StrictlySimple = true
    c.AddPaths(polys, PolyType.ptSubject, true)
    c.Execute(ClipType.ctUnion, result, fillType, fillType)
    return result
  }

  public static DistanceSqrd(pt1: IntPoint, pt2: IntPoint) {
    const dx = pt1.X - pt2.X
    const dy = pt1.Y - pt2.Y
    return dx * dx + dy * dy
  }

  public static DistanceFromLineSqrd(pt: IntPoint, ln1: IntPoint, ln2: IntPoint) {
    /**
     * The equation of a line in general form (Ax + By + C = 0)
     * given 2 points (x¹,y¹) & (x²,y²) is ...
     * (y¹ - y²)x + (x² - x¹)y + (y² - y¹)x¹ - (x² - x¹)y¹ = 0
     * A = (y¹ - y²); B = (x² - x¹); C = (y² - y¹)x¹ - (x² - x¹)y¹
     * perpendicular distance of point (x³,y³) = (Ax³ + By³ + C)/Sqrt(A² + B²)
     * see http://en.wikipedia.org/wiki/Perpendicular_distance
     */
    const A = ln1.Y - ln2.Y
    const B = ln2.X - ln1.X
    let C = A * ln1.X + B * ln1.Y
    C = A * pt.X + B * pt.Y - C
    return (C * C) / (A * A + B * B)
  }

  public static SlopesNearCollinear(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, distSquared: number) {
    // this function is more accurate when the point that's GEOMETRICALLY
    // between the other 2 points is the one that's tested for distance.
    // nb: with 'spikes', either pt1 or pt3 is geometrically between the other pts
    if (Math.abs(pt1.X - pt2.X) > Math.abs(pt1.Y - pt2.Y)) {
      if (pt1.X > pt2.X === pt1.X < pt3.X) return Clipper.DistanceFromLineSqrd(pt1, pt2, pt3) < distSquared
      else if (pt2.X > pt1.X === pt2.X < pt3.X) return Clipper.DistanceFromLineSqrd(pt2, pt1, pt3) < distSquared
      else return Clipper.DistanceFromLineSqrd(pt3, pt1, pt2) < distSquared
    } else {
      if (pt1.Y > pt2.Y === pt1.Y < pt3.Y) return Clipper.DistanceFromLineSqrd(pt1, pt2, pt3) < distSquared
      else if (pt2.Y > pt1.Y === pt2.Y < pt3.Y) return Clipper.DistanceFromLineSqrd(pt2, pt1, pt3) < distSquared
      else return Clipper.DistanceFromLineSqrd(pt3, pt1, pt2) < distSquared
    }
  }

  public static PointsAreClose(pt1: IntPoint, pt2: IntPoint, distSqrd: number) {
    const dx = pt1.X - pt2.X
    const dy = pt1.Y - pt2.Y
    return dx * dx + dy * dy <= distSqrd
  }

  public static ExcludeOp(op: OutPt) {
    const result = op.Prev
    result.Next = op.Next
    op.Next.Prev = result
    result.Idx = 0
    return result
  }

  public static CleanPolygon(path: Path, distance: number) {
    if (typeof distance === 'undefined') distance = 1.415
    // distance = proximity in units/pixels below which vertices will be stripped.
    // Default ~= sqrt(2) so when adjacent vertices or semi-adjacent vertices have
    // both x & y coords within 1 unit, then the second vertex will be stripped.
    let cnt = path.length
    if (cnt === 0) return []
    let outPts: OutPt[] = new Array(cnt)
    for (let i = 0; i < cnt; ++i) outPts[i] = new OutPt()
    for (let i = 0; i < cnt; ++i) {
      outPts[i].Pt = path[i]
      outPts[i].Next = outPts[(i + 1) % cnt]
      outPts[i].Next.Prev = outPts[i]
      outPts[i].Idx = 0
    }
    const distSqrd = distance * distance
    let op = outPts[0]
    while (op.Idx === 0 && op.Next !== op.Prev) {
      if (Clipper.PointsAreClose(op.Pt, op.Prev.Pt, distSqrd)) {
        op = Clipper.ExcludeOp(op)
        cnt--
      } else if (Clipper.PointsAreClose(op.Prev.Pt, op.Next.Pt, distSqrd)) {
        Clipper.ExcludeOp(op.Next)
        op = Clipper.ExcludeOp(op)
        cnt -= 2
      } else if (Clipper.SlopesNearCollinear(op.Prev.Pt, op.Pt, op.Next.Pt, distSqrd)) {
        op = Clipper.ExcludeOp(op)
        cnt--
      } else {
        op.Idx = 1
        op = op.Next
      }
    }
    if (cnt < 3) cnt = 0
    const result = new Array(cnt)
    for (let i = 0; i < cnt; ++i) {
      result[i] = new IntPoint(op.Pt)
      op = op.Next
    }
    outPts = null
    return result
  }

  public static CleanPolygons(polys: Paths, distance: number) {
    const result: typeof polys = new Array(polys.length)
    for (let i = 0, len = polys.length; i < len; i++) result[i] = Clipper.CleanPolygon(polys[i], distance)
    return result
  }

  public static Minkowski(pattern: Path, path: Path, IsSum: boolean, IsClosed: boolean) {
    const delta = IsClosed ? 1 : 0
    const polyCnt = pattern.length
    const pathCnt = path.length
    const result = new Paths()
    if (IsSum)
      for (let i = 0; i < pathCnt; i++) {
        const p: IntPoint[] = new Array(polyCnt)
        for (let j = 0, len = pattern.length, ip = pattern[j]; j < len; j++, ip = pattern[j]) {
          p[j] = new IntPoint(path[i].X + ip.X, path[i].Y + ip.Y)
        }
        result.push(p)
      }
    else
      for (let i = 0; i < pathCnt; i++) {
        const p = new Array(polyCnt)
        for (let j = 0, len = pattern.length, ip = pattern[j]; j < len; j++, ip = pattern[j]) {
          p[j] = new IntPoint(path[i].X - ip.X, path[i].Y - ip.Y)
        }
        result.push(p)
      }
    const quads = new Paths()
    for (let i = 0; i < pathCnt - 1 + delta; i++)
      for (let j = 0; j < polyCnt; j++) {
        const quad: IntPoint[] = []
        quad.push(result[i % pathCnt][j % polyCnt])
        quad.push(result[(i + 1) % pathCnt][j % polyCnt])
        quad.push(result[(i + 1) % pathCnt][(j + 1) % polyCnt])
        quad.push(result[i % pathCnt][(j + 1) % polyCnt])
        if (!Clipper.Orientation(quad)) quad.reverse()
        quads.push(quad)
      }
    return quads
  }

  public static MinkowskiSum(pattern: Path, pathOrPaths: Path | Paths, pathIsClosed: boolean) {
    if (!(pathOrPaths[0] instanceof Array)) {
      const path = pathOrPaths as Path
      const paths = Clipper.Minkowski(pattern, path, true, pathIsClosed)
      const c = new Clipper()
      c.AddPaths(paths, PolyType.ptSubject, true)
      c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
      return paths
    } else {
      const paths = pathOrPaths as Paths
      const solution = new Paths()
      const c = new Clipper()
      for (let i = 0; i < paths.length; ++i) {
        const tmp = Clipper.Minkowski(pattern, paths[i], true, pathIsClosed)
        c.AddPaths(tmp, PolyType.ptSubject, true)
        if (pathIsClosed) {
          const path = Clipper.TranslatePath(paths[i], pattern[0])
          c.AddPath(path, PolyType.ptClip, true)
        }
      }
      c.Execute(ClipType.ctUnion, solution, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
      return solution
    }
  }

  public static TranslatePath(path: Path, delta: IntPoint) {
    const outPath = new Path()
    for (let i = 0; i < path.length; i++) outPath.push(new IntPoint(path[i].X + delta.X, path[i].Y + delta.Y))
    return outPath
  }

  public static MinkowskiDiff(poly1: Path, poly2: Path) {
    const paths = Clipper.Minkowski(poly1, poly2, false, true)
    const c = new Clipper()
    c.AddPaths(paths, PolyType.ptSubject, true)
    c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
    return paths
  }

  public static PolyTreeToPaths(polyTree: PolyTree) {
    const result = new Paths()
    // result.set_Capacity(polytree.get_Total());
    Clipper.AddPolyNodeToPaths(polyTree, NodeType.ntAny, result)
    return result
  }

  public static AddPolyNodeToPaths(polyNode: PolyNode, nt: NodeType, paths: Paths) {
    let match = true
    switch (nt) {
      case NodeType.ntOpen:
        return
      case NodeType.ntClosed:
        match = !polyNode.IsOpen
        break
      default:
        break
    }
    if (polyNode.m_polygon.length > 0 && match) paths.push(polyNode.m_polygon)
    for (let $i3 = 0, $t3 = polyNode.Childs(), $l3 = $t3.length, pn = $t3[$i3]; $i3 < $l3; $i3++, pn = $t3[$i3])
      Clipper.AddPolyNodeToPaths(pn, nt, paths)
  }

  public static OpenPathsFromPolyTree(polyTree: PolyTree) {
    const result = new Paths()
    //result.set_Capacity(polytree.ChildCount());
    for (let i = 0, len = polyTree.ChildCount(); i < len; i++)
      if (polyTree.Childs()[i].IsOpen) result.push(polyTree.Childs()[i].m_polygon)
    return result
  }

  public static ClosedPathsFromPolyTree(polyTree: PolyTree) {
    const result = new Paths()
    //result.set_Capacity(polytree.Total());
    Clipper.AddPolyNodeToPaths(polyTree, NodeType.ntClosed, result)
    return result
  }
}
