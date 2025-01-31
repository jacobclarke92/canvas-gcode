import { Sketch } from '../Sketch'
import { perlin2, seedNoise, simplex2 } from '../utils/noise'
import { oklabRange, oklabToRgb } from '../utils/oklabUtils'
import { initPen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Genuary16_Palette extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutterX', { initialValue: 20, min: 0, max: 120, step: 0.25 })
    this.addVar('gutterY', { initialValue: 20, min: 0, max: 120, step: 0.25 })
    this.addVar('blockSize', { initialValue: 2, min: 0.25, max: 100, step: 0.25 })
    this.addVar('gap', { initialValue: 0, min: 0, max: 1, step: 0.01 })
    this.addVar('noiseOffset', { initialValue: 3.65, min: 0, max: 10, step: 0.01 })
    this.addVar('noiseDiv', { initialValue: 42, min: 1, max: 100, step: 1 })
    this.addVar('colorPowA', { initialValue: 1.4, min: 0.01, max: 2, step: 0.01 })
    this.addVar('colorPowB', { initialValue: 0.5, min: 0.01, max: 2, step: 0.01 })
  }

  initDraw(): void {
    const { seed, gutterX, gutterY, blockSize, gap, noiseOffset, noiseDiv, colorPowA, colorPowB } =
      this.vars
    seedRandom(seed)
    seedNoise(seed)
    initPen(this)
    // Challenge: generative palette

    const canvasW = this.cw - gutterX * 2
    const canvasH = this.ch - gutterY * 2

    const cols = Math.floor(canvasW / blockSize)
    const rows = Math.floor(canvasH / blockSize)

    const offsetX = gutterX + (canvasW - cols * blockSize) / 2
    const offsetY = gutterY + (canvasH - rows * blockSize) / 2

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const asinX = Math.pow(Math.sin((x / noiseDiv) % Math.PI), colorPowA)
        const asinY = Math.pow(Math.sin((y / noiseDiv) % Math.PI), colorPowA)
        const bsinX = Math.pow(Math.sin(((cols - x) / noiseDiv) % Math.PI), colorPowB)
        const bsinY = Math.pow(Math.sin(((rows - y) / noiseDiv) % Math.PI), colorPowB)
        const color = oklabToRgb({
          L: simplex2(noiseOffset + y / noiseDiv, noiseOffset + x / noiseDiv) * 0.5 + 0.5,
          a:
            simplex2(noiseOffset + asinX, noiseOffset + asinY) * oklabRange.a.range -
            (oklabRange.a.min + oklabRange.a.max) / 2,
          b:
            simplex2(noiseOffset + bsinX, noiseOffset + bsinY) * oklabRange.b.range -
            (oklabRange.b.min + oklabRange.b.max) / 2,
        })

        this.ctx.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
        this.ctx.ctx.fillRect(
          offsetX + x * blockSize,
          offsetY + y * blockSize,
          blockSize * (1 - gap),
          blockSize * (1 - gap)
        )
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
