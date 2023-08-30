import { DoublePoint } from './DoublePoint'
import { ClipperLib } from '.'
import { Clipper } from './Clipper'

export class IntPoint {
  public X: number
  public Y: number
  public Z: number
  constructor(...args: [] | [dp: DoublePoint] | [x: number, y: number] | [x: number, y: number, z: number]) {
    this.X = 0
    this.Y = 0

    if (ClipperLib.use_xyz) {
      this.Z = 0
      if (args.length === 3) {
        this.X = args[0]
        this.Y = args[1]
        this.Z = args[2]
      } else if (args.length === 2) {
        this.X = args[0]
        this.Y = args[1]
        this.Z = 0
      } else if (args.length === 1) {
        if (args[0] instanceof DoublePoint) {
          const dp = args[0]
          this.X = Clipper.Round(dp.X)
          this.Y = Clipper.Round(dp.Y)
          this.Z = 0
        } else {
          const pt = args[0]
          if (typeof pt.Z === 'undefined') pt.Z = 0
          this.X = pt.X
          this.Y = pt.Y
          this.Z = pt.Z
        }
      } else {
        this.X = 0
        this.Y = 0
        this.Z = 0
      }
    } else {
      if (args.length === 2) {
        this.X = args[0]
        this.Y = args[1]
      } else if (args.length === 1) {
        if (args[0] instanceof DoublePoint) {
          const dp = args[0]
          this.X = Clipper.Round(dp.X)
          this.Y = Clipper.Round(dp.Y)
        } else {
          const pt = args[0]
          this.X = pt.X
          this.Y = pt.Y
        }
      } else {
        this.X = 0
        this.Y = 0
      }
    }
  }

  public static op_Equality(a: IntPoint, b: IntPoint) {
    return a.X === b.X && a.Y === b.Y
  }

  public static op_Inequality(a: IntPoint, b: IntPoint) {
    return a.X !== b.X || a.Y !== b.Y
  }

  /*
    public Equals(obj: unknown) {
      if (obj === null) return false
      if (obj instanceof IntPoint) {
        const a = Cast(obj, IntPoint)
        return this.X == a.X && this.Y == a.Y
      } else return false
    }
    */
}

export class IntPoint0 extends IntPoint {
  constructor() {
    super(0, 0)
    if (ClipperLib.use_xyz) this.Z = 0
  }
}

export class IntPoint1 extends IntPoint {
  constructor(pt: IntPoint) {
    super(pt.X, pt.Y)

    if (ClipperLib.use_xyz) {
      if (typeof pt.Z === 'undefined') this.Z = 0
      else this.Z = pt.Z
    }
  }
}

export class IntPoint1dp extends IntPoint {
  constructor(dp: DoublePoint) {
    super(dp)
    this.X = Clipper.Round(dp.X)
    this.Y = Clipper.Round(dp.Y)
    if (ClipperLib.use_xyz) this.Z = 0
  }
}

export class IntPoint2 extends IntPoint {
  constructor(x: number, y: number, z?: number) {
    super(x, y)
    this.X = x
    this.Y = y
    if (ClipperLib.use_xyz) {
      if (typeof z === 'undefined') this.Z = 0
      else this.Z = z
    }
  }
}
