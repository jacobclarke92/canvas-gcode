import type { IntPoint } from './IntPoint'

export class Path extends Array<IntPoint> {
  public push: typeof Array.prototype.push
  constructor(...args: /*ConstructorParameters<typeof Array<IntPoint>> |*/ [] | [count: number]) {
    super()
    if (args.length) this.length = args[0]
    this.push = Array.prototype.push
    return []
  }
}

export class Paths extends Array<Path> {
  public push: typeof Array.prototype.push
  constructor() {
    super()
    this.push = Array.prototype.push
    return []
  }
}
