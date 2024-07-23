export class IntRectangle {
  public left: number
  public top: number
  public right: number
  public bottom: number
  constructor(
    ...args: [] | [ir: IntRectangle] | [left: number, top: number, right: number, bottom: number]
  ) {
    if (args.length === 4) {
      this.left = args[0]
      this.top = args[1]
      this.right = args[2]
      this.bottom = args[3]
    } else if (args.length === 1) {
      this.left = args[0].left
      this.top = args[0].top
      this.right = args[0].right
      this.bottom = args[0].bottom
    } else {
      this.left = 0
      this.top = 0
      this.right = 0
      this.bottom = 0
    }
  }
}
