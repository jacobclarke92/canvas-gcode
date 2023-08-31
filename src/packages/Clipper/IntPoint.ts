import { ClipperLib } from '.'
import { Clipper } from './Clipper'
import { DoublePoint } from './DoublePoint'

export class IntPoint {
  public x: number
  public y: number
  public z: number
  constructor(...args: [] | [dp: DoublePoint | IntPoint] | [x: number, y: number] | [x: number, y: number, z: number]) {
    this.x = 0
    this.y = 0

    if (ClipperLib.USE_XYZ) {
      this.z = 0
      if (args.length === 3) {
        this.x = args[0]
        this.y = args[1]
        this.z = args[2]
      } else if (args.length === 2) {
        this.x = args[0]
        this.y = args[1]
        this.z = 0
      } else if (args.length === 1) {
        if (args[0] instanceof DoublePoint) {
          const dp = args[0]
          this.x = Clipper.round(dp.x)
          this.y = Clipper.round(dp.y)
          this.z = 0
        } else {
          const pt = args[0]
          if (typeof pt.z === 'undefined') pt.z = 0
          this.x = pt.x
          this.y = pt.y
          this.z = pt.z
        }
      } else {
        this.x = 0
        this.y = 0
        this.z = 0
      }
    } else {
      if (args.length === 2) {
        this.x = args[0]
        this.y = args[1]
      } else if (args.length === 1) {
        if (args[0] instanceof DoublePoint) {
          const dp = args[0]
          this.x = Clipper.round(dp.x)
          this.y = Clipper.round(dp.y)
        } else {
          const pt = args[0]
          this.x = pt.x
          this.y = pt.y
        }
      } else {
        this.x = 0
        this.y = 0
      }
    }
  }

  public static op_Equality(a: IntPoint, b: IntPoint) {
    return a.x === b.x && a.y === b.y
  }

  public static op_Inequality(a: IntPoint, b: IntPoint) {
    return a.x !== b.x || a.y !== b.y
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
