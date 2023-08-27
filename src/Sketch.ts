import GCanvas from './GCanvas'
import Range from './sketches/tools/Range'

export interface SketchConfig {
  ctx: GCanvas
  width: number
  height: number
}

export class Sketch {
  public ctx: GCanvas
  public canvasWidth: number
  public canvasHeight: number
  /** canvas width */
  public cw: number
  /** canvas height */
  public ch: number
  /** canvas center x */
  public cx: number
  /** canvas center y */
  public cy: number
  /** editable values object */
  public vs: { [key: string]: Range } = {}
  static generateGCode: boolean = true

  constructor(config: SketchConfig) {
    this.ctx = config.ctx
    this.canvasWidth = this.cw = config.width
    this.canvasHeight = this.ch = config.height
    this.cx = this.canvasWidth / 2
    this.cy = this.canvasHeight / 2
  }

  init(): void {}
  initDraw(): void {}
  draw(increment: number): void {}
  reset(): void {
    // Object.keys(this.vs).forEach((key) => {
    //   this.vs[key].randomize()
    // })
    this.ctx.reset()
  }
}
