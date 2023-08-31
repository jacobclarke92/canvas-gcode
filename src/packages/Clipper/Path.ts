import type { IntPoint } from './IntPoint'

export class Path extends Array<IntPoint> {
  public push: typeof Array.prototype.push
  constructor(...args: [] | [count: number] | [points: IntPoint[]]) {
    super(...(Array.isArray(args[0]) ? args[0] : []))
    if (typeof args[0] === 'number') this.length = args[0]
    return []
  }
}

export class Paths extends Array<Path> {
  public push: typeof Array.prototype.push
  constructor(...args: [] | [count: number] | [paths: Path[]]) {
    super(...(Array.isArray(args[0]) ? args[0] : []))
    if (typeof args[0] === 'number') this.length = args[0]
    return []
  }
}
