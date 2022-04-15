import GCanvas from './GCanvas'

export interface SketchConfig {
  ctx: CanvasRenderingContext2D | GCanvas
  width: number
  height: number
}

export class Sketch {
  public ctx: CanvasRenderingContext2D | GCanvas
  public canvasWidth: number
  public canvasHeight: number

  constructor(config: SketchConfig) {
    this.ctx = config.ctx
    this.canvasWidth = config.width
    this.canvasHeight = config.height
  }

  init(): void {}

  draw(increment: number): void {}
}
