export class DoublePoint {
  public X = 0
  public Y = 0
  constructor(...args: [] | [x: number, y: number] | [dp: DoublePoint]) {
    if (args.length === 1) {
      this.X = args[0].X
      this.Y = args[0].Y
    } else if (args.length === 2) {
      this.X = args[0]
      this.Y = args[1]
    }
  }
}
