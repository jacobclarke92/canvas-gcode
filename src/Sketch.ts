export interface SketchConfig {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

export class Sketch {
  public ctx: CanvasRenderingContext2D
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
