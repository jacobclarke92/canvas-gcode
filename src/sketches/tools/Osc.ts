import { deg1, deg90 } from '../../constants/angles'
import Point from '../../Point'

interface OscOptions {
  radius?: number | Point | ((i: number) => Point | number)
  offset?: Point
  speed?: number | ((i: number) => number)
  phase?: number
  offsetPhase?: number
}

export default class Osc {
  public value = new Point()
  public radius: Point
  public offset: Point
  public speed: number
  public phase: number
  public offsetPhase = -deg90 // start drawing from top middle
  private theta: Point
  private speedFunc: Exclude<OscOptions['speed'], number>
  private radiusFunc: Exclude<OscOptions['radius'], number | Point>
  constructor(options: OscOptions) {
    if (typeof options.speed === 'function') {
      this.speedFunc = options.speed
      this.speed = this.speedFunc(0)
    } else this.speed = options.speed || deg1

    if (options.radius === undefined) this.radius = new Point(1, 1)
    else if (typeof options.radius === 'function') {
      this.radiusFunc = options.radius
      const radius = this.radiusFunc(0)
      this.radius = typeof radius === 'number' ? new Point(radius, radius) : radius
    } else
      this.radius =
        typeof options.radius === 'number'
          ? new Point(options.radius, options.radius)
          : options.radius.clone()

    this.offset = options.offset ? options.offset.clone() : new Point(0, 0)
    this.offsetPhase = options.offsetPhase || 0
    this.phase = options.phase || 0
    this.theta = new Point(this.phase, this.phase)
    this.process()
  }
  public get x() {
    return this.value.x
  }
  public get y() {
    return this.value.y
  }
  public reset() {
    this.theta = new Point(this.phase, this.phase)
  }
  public step(increment: number) {
    if (this.speedFunc) {
      const val = this.speedFunc(increment)
      if (typeof val === 'number' && !isNaN(val)) this.speed = val
    }
    if (this.radiusFunc) {
      const val = this.radiusFunc(increment)
      this.radius = typeof val === 'number' ? new Point(val, val) : val
    }
    this.theta.x = this.theta.x + this.speed
    this.theta.y = this.theta.y + this.speed
    this.process()
  }
  private process() {
    this.value.x = this.offset.x + Math.cos(this.offsetPhase + this.theta.x) * this.radius.x
    this.value.y = this.offset.y + Math.sin(this.offsetPhase + this.theta.y) * this.radius.y
    if (isNaN(this.value.x)) debugger
  }
}
