export class DoublePoint {
  public x = 0
  public y = 0
  constructor(...args: [] | [x: number, y: number] | [dp: DoublePoint]) {
    if (args.length === 1) {
      this.x = args[0].x
      this.y = args[0].y
    } else if (args.length === 2) {
      this.x = args[0]
      this.y = args[1]
    }
  }
}
