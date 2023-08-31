import { ClipperLib } from '.'
import { Clipper } from './Clipper'
import { DoublePoint } from './DoublePoint'

export class IntPoint {
  public X: number
  public Y: number
  public Z: number
  constructor(...args: [] | [dp: DoublePoint | IntPoint] | [x: number, y: number] | [x: number, y: number, z: number]) {
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
