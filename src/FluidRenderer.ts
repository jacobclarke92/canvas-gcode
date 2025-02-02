import type { FluidSimulator } from './FluidSimulator'
import { hexToRgb, sciColor } from './utils/colorUtils'

export class FluidRenderer {
  fluidSim: FluidSimulator
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number

  dataCanvas: HTMLCanvasElement
  dataCtx: CanvasRenderingContext2D
  dataImgData: ImageData
  dataPixels: ImageData['data']

  constructor(
    fluidSim: FluidSimulator,
    canvas: HTMLCanvasElement,
    size?: { width: number; height: number }
  ) {
    this.fluidSim = fluidSim
    this.canvas = canvas

    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this.width = size?.width || canvas.width
    this.height = size?.height || canvas.height

    const scale = (size?.height || canvas.height) / fluidSim.gridH
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(scale, scale)
    this.ctx.imageSmoothingEnabled = false // -> nearest-neighbor interpolation

    // temp canvas to store original values
    this.dataCanvas = document.createElement('canvas')
    this.dataCanvas.width = fluidSim.gridW
    this.dataCanvas.height = fluidSim.gridH
    this.dataCtx = this.dataCanvas.getContext('2d')
    this.dataImgData = this.dataCtx.getImageData(
      0,
      0,
      this.dataCanvas.width,
      this.dataCanvas.height
    )
    this.dataPixels = this.dataImgData.data
  }

  drawStreamline() {
    const h = this.fluidSim.cellSize
    const segLen = h * 0.2
    const numSegments = 15

    this.ctx.strokeStyle = '#000000'
    this.ctx.lineWidth = 0.1

    for (let i = 1; i < this.fluidSim.gridW - 1; i += 5) {
      for (let j = 1; j < this.fluidSim.gridH - 1; j += 5) {
        let x = (i + 0.5) * h
        let y = (j + 0.5) * h

        this.ctx.beginPath()
        this.ctx.moveTo(x / h, y / h)

        for (let n = 0; n < numSegments; n++) {
          const u = this.fluidSim.interpolateFromField(x, y, this.fluidSim.velocityFieldX)
          const v = this.fluidSim.interpolateFromField(x, y, this.fluidSim.velocityFieldY)
          const l = Math.sqrt(u * u + v * v)
          x += (u / l) * segLen
          y += (v / l) * segLen
          if (x > this.fluidSim.gridW * this.fluidSim.cellSize) break
          this.ctx.lineTo(x / h, y / h)
        }
        this.ctx.stroke()
      }
    }
  }

  // TODO : buffer draw
  drawPressure() {
    const fl = this.fluidSim
    let pMin: number, pMax: number
    pMin = pMax = fl.pressureField[0]
    for (let i = 0; i < fl.gridW * fl.gridH; i++) {
      pMin = Math.min(pMin, fl.pressureField[i])
      pMax = Math.max(pMax, fl.pressureField[i])
    }
    for (let i = 0; i < fl.gridW; i++) {
      for (let j = 0; j < fl.gridH; j++) {
        const p = fl.pressureField[i + fl.gridW * j]
        const color = sciColor(p, pMin, pMax)
        const ptr = 4 * (j * this.dataCanvas.width + i)
        this.dataPixels[ptr + 0] = color[0]
        this.dataPixels[ptr + 1] = color[1]
        this.dataPixels[ptr + 2] = color[2]
        this.dataPixels[ptr + 3] = 255
      }
    }
    // put data into data_canvas
    this.dataCtx.putImageData(this.dataImgData, 0, 0)
    // draw into original canvas
    this.ctx.drawImage(this.dataCanvas, 0, 0)
  }

  draw(opts: { showDye?: boolean; showObstacle?: boolean; showStreamline?: boolean } = {}) {
    const obstacleColor = hexToRgb(0x9bb6e0) //obstacle #9bb6e0
    // console.log(this.fluidSim.rDye)
    // debugger
    for (let i = 0; i < this.fluidSim.totalGridCells; i++) {
      let color = [255, 255, 255]
      if (opts.showDye) {
        color[0] = 255 * this.fluidSim.rDyeField[i]
        color[1] = 255 * this.fluidSim.gDyeField[i]
        color[2] = 255 * this.fluidSim.bDyeField[i]
      }
      if (this.fluidSim.solidMaskField[i] == 0 && opts.showObstacle) color = obstacleColor.slice()

      //   console.log(color)

      //   console.log(obstacleColor)

      const p = 4 * i
      this.dataPixels[p + 0] = color[0]
      this.dataPixels[p + 1] = color[1]
      this.dataPixels[p + 2] = color[2]
      this.dataPixels[p + 3] = 255
    }

    // put data into data_canvas
    this.dataCtx.putImageData(this.dataImgData, 0, 0)
    // draw into original canvas
    this.ctx.drawImage(this.dataCanvas, 0, 0)

    if (opts.showStreamline) this.drawStreamline()
  }
}
