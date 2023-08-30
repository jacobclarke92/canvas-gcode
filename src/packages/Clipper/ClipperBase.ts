import { Int128 } from '../BigInteger'
import { ClipperLib } from '.'
import { PolyType } from './enums'
import { IntPoint } from './IntPoint'
import { LocalMinima, OutRec, Scanbeam } from './Misc'
import type { TEdge } from './TEdge'

export class ClipperBase {
  public m_MinimaList: LocalMinima | null = null
  public m_CurrentLM: LocalMinima | null = null
  public m_edges: TEdge[][] = []
  public m_UseFullRange = false
  public m_HasOpenPaths = false
  public PreserveCollinear = false
  public m_Scanbeam: Scanbeam | null = null
  public m_PolyOuts: OutRec[] = []
  public m_ActiveEdges: TEdge | null = null

  // Ranges are in original C# too high for Javascript (in current state 2013 september):
  // protected const double horizontal = -3.4E+38;
  // internal const cInt loRange = 0x3FFFFFFF; // = 1073741823 = sqrt(2^63 -1)/2
  // internal const cInt hiRange = 0x3FFFFFFFFFFFFFFFL; // = 4611686018427387903 = sqrt(2^127 -1)/2
  // So had to adjust them to more suitable for Javascript.
  // If JS some day supports truly 64-bit integers, then these ranges can be as in C#
  // and biginteger library can be more simpler (as then 128bit can be represented as two 64bit numbers)
  public static horizontal = -9007199254740992 as const //-2^53
  public static Skip = -2 as const
  public static Unassigned = -1 as const
  public static tolerance = 1e-20 as const
  public static loRange = 47453132 as const // sqrt(2^53 -1)/2
  public static hiRange = 4503599627370495 as const // sqrt(2^106 -1)/2

  public static near_zero(val: number) {
    return val > -ClipperBase.tolerance && val < ClipperBase.tolerance
  }
  public static IsHorizontal(e: TEdge) {
    return e.Delta.Y === 0
  }

  public PointIsVertex(pt: IntPoint, pp: dunno) {
    let pp2 = pp
    do {
      if (IntPoint.op_Equality(pp2.Pt, pt)) return true
      pp2 = pp2.Next
    } while (pp2 !== pp)
    return false
  }

  public PointOnLineSegment(pt: IntPoint, linePt1: IntPoint, linePt2: IntPoint, UseFullRange: boolean) {
    if (UseFullRange)
      return (
        (pt.X === linePt1.X && pt.Y === linePt1.Y) ||
        (pt.X === linePt2.X && pt.Y === linePt2.Y) ||
        (pt.X > linePt1.X === pt.X < linePt2.X &&
          pt.Y > linePt1.Y === pt.Y < linePt2.Y &&
          Int128.op_Equality(
            Int128.Int128Mul(pt.X - linePt1.X, linePt2.Y - linePt1.Y),
            Int128.Int128Mul(linePt2.X - linePt1.X, pt.Y - linePt1.Y)
          ))
      )
    else
      return (
        (pt.X === linePt1.X && pt.Y === linePt1.Y) ||
        (pt.X === linePt2.X && pt.Y === linePt2.Y) ||
        (pt.X > linePt1.X === pt.X < linePt2.X &&
          pt.Y > linePt1.Y === pt.Y < linePt2.Y &&
          (pt.X - linePt1.X) * (linePt2.Y - linePt1.Y) === (linePt2.X - linePt1.X) * (pt.Y - linePt1.Y))
      )
  }

  public PointOnPolygon(pt: IntPoint, pp: dunno, UseFullRange: boolean) {
    let pp2 = pp
    while (true) {
      if (this.PointOnLineSegment(pt, pp2.Pt, pp2.Next.Pt, UseFullRange)) return true
      pp2 = pp2.Next
      if (pp2 === pp) break
    }
    return false
  }

  // static and not
  public static SlopesEqual(
    ...args:
      | [e1: TEdge, e2: TEdge, UseFullRange: boolean]
      | [pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, UseFullRange: boolean]
      | [pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, pt4: IntPoint, UseFullRange: boolean]
  ) {
    if (args.length === 3) {
      const [e1, e2, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(Int128.Int128Mul(e1.Delta.Y, e2.Delta.X), Int128.Int128Mul(e1.Delta.X, e2.Delta.Y))
      else return ClipperLib.Cast_Int64(e1.Delta.Y * e2.Delta.X) === ClipperLib.Cast_Int64(e1.Delta.X * e2.Delta.Y)
    } else if (args.length === 4) {
      const [pt1, pt2, pt3, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(
          Int128.Int128Mul(pt1.Y - pt2.Y, pt2.X - pt3.X),
          Int128.Int128Mul(pt1.X - pt2.X, pt2.Y - pt3.Y)
        )
      else
        return (
          ClipperLib.Cast_Int64((pt1.Y - pt2.Y) * (pt2.X - pt3.X)) -
            ClipperLib.Cast_Int64((pt1.X - pt2.X) * (pt2.Y - pt3.Y)) ===
          0
        )
    } else {
      const [pt1, pt2, pt3, pt4, UseFullRange] = args
      if (UseFullRange)
        return Int128.op_Equality(
          Int128.Int128Mul(pt1.Y - pt2.Y, pt3.X - pt4.X),
          Int128.Int128Mul(pt1.X - pt2.X, pt3.Y - pt4.Y)
        )
      else
        return (
          ClipperLib.Cast_Int64((pt1.Y - pt2.Y) * (pt3.X - pt4.X)) -
            ClipperLib.Cast_Int64((pt1.X - pt2.X) * (pt3.Y - pt4.Y)) ===
          0
        )
    }
  }

  public Clear() {
    this.DisposeLocalMinimaList()
    for (let i = 0, ilen = this.m_edges.length; i < ilen; ++i) {
      for (let j = 0, jlen = this.m_edges[i].length; j < jlen; ++j) this.m_edges[i][j] = null
      ClipperLib.Clear(this.m_edges[i])
    }
    ClipperLib.Clear(this.m_edges)
    this.m_UseFullRange = false
    this.m_HasOpenPaths = false
  }

  public DisposeLocalMinimaList() {
    while (this.m_MinimaList !== null) {
      const tmpLm = this.m_MinimaList.Next
      this.m_MinimaList = null
      this.m_MinimaList = tmpLm
    }
    this.m_CurrentLM = null
  }

  public RangeTest(Pt: IntPoint, useFullRange: { Value: boolean }) {
    if (useFullRange.Value) {
      if (
        Pt.X > ClipperBase.hiRange ||
        Pt.Y > ClipperBase.hiRange ||
        -Pt.X > ClipperBase.hiRange ||
        -Pt.Y > ClipperBase.hiRange
      )
        ClipperLib.Error('Coordinate outside allowed range in RangeTest().')
    } else if (
      Pt.X > ClipperBase.loRange ||
      Pt.Y > ClipperBase.loRange ||
      -Pt.X > ClipperBase.loRange ||
      -Pt.Y > ClipperBase.loRange
    ) {
      useFullRange.Value = true
      this.RangeTest(Pt, useFullRange)
    }
  }

  public InitEdge(e: TEdge, eNext: TEdge | null, ePrev: TEdge | null, pt: IntPoint) {
    e.Next = eNext
    e.Prev = ePrev
    //e.Curr = pt;
    e.Curr.X = pt.X
    e.Curr.Y = pt.Y
    if (ClipperLib.use_xyz) e.Curr.Z = pt.Z
    e.OutIdx = -1
  }

  public InitEdge2(e: TEdge, polyType: PolyType) {
    if (e.Curr.Y >= e.Next.Curr.Y) {
      //e.Bot = e.Curr;
      e.Bot.X = e.Curr.X
      e.Bot.Y = e.Curr.Y
      if (ClipperLib.use_xyz) e.Bot.Z = e.Curr.Z
      //e.Top = e.Next.Curr;
      e.Top.X = e.Next.Curr.X
      e.Top.Y = e.Next.Curr.Y
      if (ClipperLib.use_xyz) e.Top.Z = e.Next.Curr.Z
    } else {
      //e.Top = e.Curr;
      e.Top.X = e.Curr.X
      e.Top.Y = e.Curr.Y
      if (ClipperLib.use_xyz) e.Top.Z = e.Curr.Z
      //e.Bot = e.Next.Curr;
      e.Bot.X = e.Next.Curr.X
      e.Bot.Y = e.Next.Curr.Y
      if (ClipperLib.use_xyz) e.Bot.Z = e.Next.Curr.Z
    }
    this.SetDx(e)
    e.PolyTyp = polyType
  }

  public FindNextLocMin(E: TEdge) {
    let E2
    for (;;) {
      while (IntPoint.op_Inequality(E.Bot, E.Prev.Bot) || IntPoint.op_Equality(E.Curr, E.Top)) E = E.Next
      if (E.Dx !== ClipperBase.horizontal && E.Prev.Dx !== ClipperBase.horizontal) break
      while (E.Prev.Dx === ClipperBase.horizontal) E = E.Prev
      E2 = E
      while (E.Dx === ClipperBase.horizontal) E = E.Next
      if (E.Top.Y === E.Prev.Bot.Y) continue
      // ie just an intermediate horz.
      if (E2.Prev.Bot.X < E.Bot.X) E = E2
      break
    }
    return E
  }

  public ProcessBound(E: TEdge, LeftBoundIsForward: boolean) {
    let EStart
    let Result = E
    let Horz

    if (Result.OutIdx === ClipperBase.Skip) {
      //check if there are edges beyond the skip edge in the bound and if so
      //create another LocMin and calling ProcessBound once more ...
      E = Result
      if (LeftBoundIsForward) {
        while (E.Top.Y === E.Next.Bot.Y) E = E.Next
        while (E !== Result && E.Dx === ClipperBase.horizontal) E = E.Prev
      } else {
        while (E.Top.Y === E.Prev.Bot.Y) E = E.Prev
        while (E !== Result && E.Dx === ClipperBase.horizontal) E = E.Next
      }
      if (E === Result) {
        if (LeftBoundIsForward) Result = E.Next
        else Result = E.Prev
      } else {
        //there are more edges in the bound beyond result starting with E
        if (LeftBoundIsForward) E = Result.Next
        else E = Result.Prev
        const locMin = new LocalMinima()
        locMin.Next = null
        locMin.Y = E.Bot.Y
        locMin.LeftBound = null
        locMin.RightBound = E
        E.WindDelta = 0
        Result = this.ProcessBound(E, LeftBoundIsForward)
        this.InsertLocalMinima(locMin)
      }
      return Result
    }

    if (E.Dx === ClipperBase.horizontal) {
      //We need to be careful with open paths because this may not be a
      //true local minima (ie E may be following a skip edge).
      //Also, consecutive horz. edges may start heading left before going right.
      if (LeftBoundIsForward) EStart = E.Prev
      else EStart = E.Next

      if (EStart.Dx === ClipperBase.horizontal) {
        //ie an adjoining horizontal skip edge
        if (EStart.Bot.X !== E.Bot.X && EStart.Top.X !== E.Bot.X) this.ReverseHorizontal(E)
      } else if (EStart.Bot.X !== E.Bot.X) this.ReverseHorizontal(E)
    }

    EStart = E
    if (LeftBoundIsForward) {
      while (Result.Top.Y === Result.Next.Bot.Y && Result.Next.OutIdx !== ClipperBase.Skip) Result = Result.Next
      if (Result.Dx === ClipperBase.horizontal && Result.Next.OutIdx !== ClipperBase.Skip) {
        //nb: at the top of a bound, horizontals are added to the bound
        //only when the preceding edge attaches to the horizontal's left vertex
        //unless a Skip edge is encountered when that becomes the top divide
        Horz = Result
        while (Horz.Prev.Dx === ClipperBase.horizontal) Horz = Horz.Prev
        if (Horz.Prev.Top.X > Result.Next.Top.X) Result = Horz.Prev
      }
      while (E !== Result) {
        E.NextInLML = E.Next
        if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.X !== E.Prev.Top.X) this.ReverseHorizontal(E)
        E = E.Next
      }
      if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.X !== E.Prev.Top.X) this.ReverseHorizontal(E)
      Result = Result.Next
      //move to the edge just beyond current bound
    } else {
      while (Result.Top.Y === Result.Prev.Bot.Y && Result.Prev.OutIdx !== ClipperBase.Skip) Result = Result.Prev
      if (Result.Dx === ClipperBase.horizontal && Result.Prev.OutIdx !== ClipperBase.Skip) {
        Horz = Result
        while (Horz.Next.Dx === ClipperBase.horizontal) Horz = Horz.Next
        if (Horz.Next.Top.X === Result.Prev.Top.X || Horz.Next.Top.X > Result.Prev.Top.X) {
          Result = Horz.Next
        }
      }
      while (E !== Result) {
        E.NextInLML = E.Prev
        if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.X !== E.Next.Top.X) this.ReverseHorizontal(E)
        E = E.Prev
      }
      if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.X !== E.Next.Top.X) this.ReverseHorizontal(E)
      Result = Result.Prev
      //move to the edge just beyond current bound
    }

    return Result
  }

  public AddPath(pg: dunno[], polyType: PolyType, Closed: boolean) {
    if (ClipperLib.use_lines) {
      if (!Closed && polyType === PolyType.ptClip) ClipperLib.Error('AddPath: Open paths must be subject.')
    } else {
      if (!Closed) ClipperLib.Error('AddPath: Open paths have been disabled.')
    }
    let highI = pg.length - 1
    if (Closed) while (highI > 0 && IntPoint.op_Equality(pg[highI], pg[0])) --highI
    while (highI > 0 && IntPoint.op_Equality(pg[highI], pg[highI - 1])) --highI
    if ((Closed && highI < 2) || (!Closed && highI < 1)) return false
    //create a new edge array ...
    const edges: TEdge[] = []
    for (let i = 0; i <= highI; i++) edges.push(new ClipperLib.TEdge())
    let IsFlat = true
    //1. Basic (first) edge initialization ...

    //edges[1].Curr = pg[1];
    edges[1].Curr.X = pg[1].X
    edges[1].Curr.Y = pg[1].Y
    if (ClipperLib.use_xyz) edges[1].Curr.Z = pg[1].Z

    const $1 = {
      Value: this.m_UseFullRange,
    }

    this.RangeTest(pg[0], $1)
    this.m_UseFullRange = $1.Value

    $1.Value = this.m_UseFullRange
    this.RangeTest(pg[highI], $1)
    this.m_UseFullRange = $1.Value

    this.InitEdge(edges[0], edges[1], edges[highI], pg[0])
    this.InitEdge(edges[highI], edges[0], edges[highI - 1], pg[highI])
    for (let i = highI - 1; i >= 1; --i) {
      $1.Value = this.m_UseFullRange
      this.RangeTest(pg[i], $1)
      this.m_UseFullRange = $1.Value

      this.InitEdge(edges[i], edges[i + 1], edges[i - 1], pg[i])
    }

    let eStart = edges[0]
    //2. Remove duplicate vertices, and (when closed) collinear edges ...
    let E = eStart,
      eLoopStop = eStart
    for (;;) {
      //console.log(E.Next, eStart);
      //nb: allows matching start and end points when not Closed ...
      if (E.Curr === E.Next.Curr && (Closed || E.Next !== eStart)) {
        if (E === E.Next) break
        if (E === eStart) eStart = E.Next
        E = this.RemoveEdge(E)
        eLoopStop = E
        continue
      }
      if (E.Prev === E.Next) break
      else if (
        Closed &&
        ClipperBase.SlopesEqual(E.Prev.Curr, E.Curr, E.Next.Curr, this.m_UseFullRange) &&
        (!this.PreserveCollinear || !this.Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr))
      ) {
        //Collinear edges are allowed for open paths but in closed paths
        //the default is to merge adjacent collinear edges into a single edge.
        //However, if the PreserveCollinear property is enabled, only overlapping
        //collinear edges (ie spikes) will be removed from closed paths.
        if (E === eStart) eStart = E.Next
        E = this.RemoveEdge(E)
        E = E.Prev
        eLoopStop = E
        continue
      }
      E = E.Next
      if (E === eLoopStop || (!Closed && E.Next === eStart)) break
    }
    if ((!Closed && E === E.Next) || (Closed && E.Prev === E.Next)) return false
    if (!Closed) {
      this.m_HasOpenPaths = true
      eStart.Prev.OutIdx = ClipperBase.Skip
    }
    //3. Do second stage of edge initialization ...
    E = eStart
    do {
      this.InitEdge2(E, polyType)
      E = E.Next
      if (IsFlat && E.Curr.Y !== eStart.Curr.Y) IsFlat = false
    } while (E !== eStart)
    //4. Finally, add edge bounds to LocalMinima list ...
    //Totally flat paths must be handled differently when adding them
    //to LocalMinima list to avoid endless loops etc ...
    if (IsFlat) {
      if (Closed) return false

      E.Prev.OutIdx = ClipperBase.Skip

      const locMin = new ClipperLib.LocalMinima()
      locMin.Next = null
      locMin.Y = E.Bot.Y
      locMin.LeftBound = null
      locMin.RightBound = E
      locMin.RightBound.Side = ClipperLib.EdgeSide.esRight
      locMin.RightBound.WindDelta = 0

      for (;;) {
        if (E.Bot.X !== E.Prev.Top.X) this.ReverseHorizontal(E)
        if (E.Next.OutIdx === ClipperBase.Skip) break
        E.NextInLML = E.Next
        E = E.Next
      }
      this.InsertLocalMinima(locMin)
      this.m_edges.push(edges)
      return true
    }
    this.m_edges.push(edges)
    let leftBoundIsForward: boolean
    let EMin: TEdge | null = null

    //workaround to avoid an endless loop in the while loop below when
    //open paths have matching start and end points ...
    if (IntPoint.op_Equality(E.Prev.Bot, E.Prev.Top)) E = E.Next

    for (;;) {
      E = this.FindNextLocMin(E)
      if (E === EMin) break
      else if (EMin === null) EMin = E
      //E and E.Prev now share a local minima (left aligned if horizontal).
      //Compare their slopes to find which starts which bound ...
      const locMin = new ClipperLib.LocalMinima()
      locMin.Next = null
      locMin.Y = E.Bot.Y
      if (E.Dx < E.Prev.Dx) {
        locMin.LeftBound = E.Prev
        locMin.RightBound = E
        leftBoundIsForward = false
        //Q.nextInLML = Q.prev
      } else {
        locMin.LeftBound = E
        locMin.RightBound = E.Prev
        leftBoundIsForward = true
        //Q.nextInLML = Q.next
      }
      locMin.LeftBound.Side = ClipperLib.EdgeSide.esLeft
      locMin.RightBound.Side = ClipperLib.EdgeSide.esRight

      if (!Closed) locMin.LeftBound.WindDelta = 0
      else if (locMin.LeftBound.Next === locMin.RightBound) locMin.LeftBound.WindDelta = -1
      else locMin.LeftBound.WindDelta = 1

      locMin.RightBound.WindDelta = -locMin.LeftBound.WindDelta
      E = this.ProcessBound(locMin.LeftBound, leftBoundIsForward)

      if (E.OutIdx === ClipperBase.Skip) E = this.ProcessBound(E, leftBoundIsForward)

      let E2 = this.ProcessBound(locMin.RightBound, !leftBoundIsForward)
      if (E2.OutIdx === ClipperBase.Skip) E2 = this.ProcessBound(E2, !leftBoundIsForward)

      if (locMin.LeftBound.OutIdx === ClipperBase.Skip) locMin.LeftBound = null
      else if (locMin.RightBound.OutIdx === ClipperBase.Skip) locMin.RightBound = null

      this.InsertLocalMinima(locMin)
      if (!leftBoundIsForward) E = E2
    }
    return true
  }

  public AddPaths(ppg: dunno[], polyType: PolyType, closed: boolean) {
    //  console.log("-------------------------------------------");
    //  console.log(JSON.stringify(ppg));
    let result = false
    for (let i = 0, ilen = ppg.length; i < ilen; ++i) {
      if (this.AddPath(ppg[i], polyType, closed)) result = true
    }
    return result
  }

  public Pt2IsBetweenPt1AndPt3(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint) {
    if (IntPoint.op_Equality(pt1, pt3) || IntPoint.op_Equality(pt1, pt2) || IntPoint.op_Equality(pt3, pt2))
      // if ((pt1 == pt3) || (pt1 == pt2) || (pt3 == pt2))
      return false
    else if (pt1.X !== pt3.X) return pt2.X > pt1.X === pt2.X < pt3.X
    else return pt2.Y > pt1.Y === pt2.Y < pt3.Y
  }

  public RemoveEdge(e: TEdge) {
    // removes e from double_linked_list (but without removing from memory)
    e.Prev.Next = e.Next
    e.Next.Prev = e.Prev
    const result = e.Next
    e.Prev = null // flag as removed (see ClipperBase.Clear)
    return result
  }

  public SetDx(e: TEdge) {
    e.Delta.X = e.Top.X - e.Bot.X
    e.Delta.Y = e.Top.Y - e.Bot.Y
    if (e.Delta.Y === 0) e.Dx = ClipperBase.horizontal
    else e.Dx = e.Delta.X / e.Delta.Y
  }

  public InsertLocalMinima(newLm: LocalMinima) {
    if (this.m_MinimaList === null) {
      this.m_MinimaList = newLm
    } else if (newLm.Y >= this.m_MinimaList.Y) {
      newLm.Next = this.m_MinimaList
      this.m_MinimaList = newLm
    } else {
      let tmpLm = this.m_MinimaList
      while (tmpLm.Next !== null && newLm.Y < tmpLm.Next.Y) tmpLm = tmpLm.Next
      newLm.Next = tmpLm.Next
      tmpLm.Next = newLm
    }
  }

  public PopLocalMinima(Y: number, current) {
    current.v = this.m_CurrentLM
    if (this.m_CurrentLM !== null && this.m_CurrentLM.Y === Y) {
      this.m_CurrentLM = this.m_CurrentLM.Next
      return true
    }
    return false
  }

  public ReverseHorizontal(e: TEdge) {
    // swap horizontal edges' top and bottom x's so they follow the natural
    // progression of the bounds - ie so their xbots will align with the
    // adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
    let tmp = e.Top.X
    e.Top.X = e.Bot.X
    e.Bot.X = tmp
    if (ClipperLib.use_xyz) {
      tmp = e.Top.Z
      e.Top.Z = e.Bot.Z
      e.Bot.Z = tmp
    }
  }

  public Reset() {
    this.m_CurrentLM = this.m_MinimaList
    if (this.m_CurrentLM === null)
      //ie nothing to process
      return
    //reset all edges ...
    this.m_Scanbeam = null
    let lm = this.m_MinimaList
    while (lm !== null) {
      this.InsertScanbeam(lm.Y)
      let e = lm.LeftBound
      if (e !== null) {
        //e.Curr = e.Bot;
        e.Curr.X = e.Bot.X
        e.Curr.Y = e.Bot.Y
        if (ClipperLib.use_xyz) e.Curr.Z = e.Bot.Z
        e.OutIdx = ClipperBase.Unassigned
      }
      e = lm.RightBound
      if (e !== null) {
        //e.Curr = e.Bot;
        e.Curr.X = e.Bot.X
        e.Curr.Y = e.Bot.Y
        if (ClipperLib.use_xyz) e.Curr.Z = e.Bot.Z
        e.OutIdx = ClipperBase.Unassigned
      }
      lm = lm.Next
    }
    this.m_ActiveEdges = null
  }

  public InsertScanbeam(Y: number) {
    //single-linked list: sorted descending, ignoring dups.
    if (this.m_Scanbeam === null) {
      this.m_Scanbeam = new Scanbeam()
      this.m_Scanbeam.Next = null
      this.m_Scanbeam.Y = Y
    } else if (Y > this.m_Scanbeam.Y) {
      const newSb = new Scanbeam()
      newSb.Y = Y
      newSb.Next = this.m_Scanbeam
      this.m_Scanbeam = newSb
    } else {
      let sb2 = this.m_Scanbeam
      while (sb2.Next !== null && Y <= sb2.Next.Y) {
        sb2 = sb2.Next
      }
      if (Y === sb2.Y) {
        return
      } //ie ignores duplicates
      const newSb1 = new Scanbeam()
      newSb1.Y = Y
      newSb1.Next = sb2.Next
      sb2.Next = newSb1
    }
  }

  public PopScanbeam(Y) {
    if (this.m_Scanbeam === null) {
      Y.v = 0
      return false
    }
    Y.v = this.m_Scanbeam.Y
    this.m_Scanbeam = this.m_Scanbeam.Next
    return true
  }

  public LocalMinimaPending() {
    return this.m_CurrentLM !== null
  }

  public CreateOutRec() {
    const result = new OutRec()
    result.Idx = ClipperBase.Unassigned
    result.IsHole = false
    result.IsOpen = false
    result.FirstLeft = null
    result.Pts = null
    result.BottomPt = null
    result.PolyNode = null
    this.m_PolyOuts.push(result)
    result.Idx = this.m_PolyOuts.length - 1
    return result
  }

  public DisposeOutRec(index: number) {
    let outRec = this.m_PolyOuts[index]
    outRec.Pts = null
    outRec = null
    this.m_PolyOuts[index] = null
  }

  public UpdateEdgeIntoAEL(e: TEdge) {
    if (e.NextInLML === null) {
      ClipperLib.Error('UpdateEdgeIntoAEL: invalid call')
    }
    const AelPrev = e.PrevInAEL
    const AelNext = e.NextInAEL
    e.NextInLML.OutIdx = e.OutIdx
    if (AelPrev !== null) {
      AelPrev.NextInAEL = e.NextInLML
    } else {
      this.m_ActiveEdges = e.NextInLML
    }
    if (AelNext !== null) {
      AelNext.PrevInAEL = e.NextInLML
    }
    e.NextInLML.Side = e.Side
    e.NextInLML.WindDelta = e.WindDelta
    e.NextInLML.WindCnt = e.WindCnt
    e.NextInLML.WindCnt2 = e.WindCnt2
    e = e.NextInLML
    e.Curr.X = e.Bot.X
    e.Curr.Y = e.Bot.Y
    e.PrevInAEL = AelPrev
    e.NextInAEL = AelNext
    if (!ClipperBase.IsHorizontal(e)) {
      this.InsertScanbeam(e.Top.Y)
    }
    return e
  }

  public SwapPositionsInAEL(edge1: TEdge, edge2: TEdge) {
    // check that one or other edge hasn't already been removed from AEL ...
    if (edge1.NextInAEL === edge1.PrevInAEL || edge2.NextInAEL === edge2.PrevInAEL) {
      return
    }

    if (edge1.NextInAEL === edge2) {
      const next = edge2.NextInAEL
      if (next !== null) {
        next.PrevInAEL = edge1
      }
      const prev = edge1.PrevInAEL
      if (prev !== null) {
        prev.NextInAEL = edge2
      }
      edge2.PrevInAEL = prev
      edge2.NextInAEL = edge1
      edge1.PrevInAEL = edge2
      edge1.NextInAEL = next
    } else if (edge2.NextInAEL === edge1) {
      const next = edge1.NextInAEL
      if (next !== null) {
        next.PrevInAEL = edge2
      }
      const prev = edge2.PrevInAEL
      if (prev !== null) {
        prev.NextInAEL = edge1
      }
      edge1.PrevInAEL = prev
      edge1.NextInAEL = edge2
      edge2.PrevInAEL = edge1
      edge2.NextInAEL = next
    } else {
      const next = edge1.NextInAEL
      const prev = edge1.PrevInAEL
      edge1.NextInAEL = edge2.NextInAEL
      if (edge1.NextInAEL !== null) {
        edge1.NextInAEL.PrevInAEL = edge1
      }
      edge1.PrevInAEL = edge2.PrevInAEL
      if (edge1.PrevInAEL !== null) {
        edge1.PrevInAEL.NextInAEL = edge1
      }
      edge2.NextInAEL = next
      if (edge2.NextInAEL !== null) {
        edge2.NextInAEL.PrevInAEL = edge2
      }
      edge2.PrevInAEL = prev
      if (edge2.PrevInAEL !== null) {
        edge2.PrevInAEL.NextInAEL = edge2
      }
    }

    if (edge1.PrevInAEL === null) {
      this.m_ActiveEdges = edge1
    } else {
      if (edge2.PrevInAEL === null) {
        this.m_ActiveEdges = edge2
      }
    }
  }

  public DeleteFromAEL(e: TEdge) {
    const AelPrev = e.PrevInAEL
    const AelNext = e.NextInAEL
    if (AelPrev === null && AelNext === null && e !== this.m_ActiveEdges) {
      return
    }
    // already deleted
    if (AelPrev !== null) {
      AelPrev.NextInAEL = AelNext
    } else {
      this.m_ActiveEdges = AelNext
    }
    if (AelNext !== null) {
      AelNext.PrevInAEL = AelPrev
    }
    e.NextInAEL = null
    e.PrevInAEL = null
  }
}
