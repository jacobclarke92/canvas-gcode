import { deg360 } from '../constants/angles'
import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class Peeking extends Sketch {
  init() {
    this.addVar('gutter', { presentation: true, initialValue: 5, min: 0, max: 100, step: 0.1 })
    this.addVar('repeats', { initialValue: 32, min: 5, max: 128, step: 1 })
    this.addVar('lean', { initialValue: 0, min: 0, max: 32, step: 0.01 })
    this.addVar('whitespace', { initialValue: 0, min: 0, max: 12, step: 0.5 })
    this.addVar('waviness', { initialValue: 2, min: 0, max: 12, step: 0.1 })
    this.addVar('wavePeriod', { initialValue: 1, min: 0, max: 12, step: 0.1 })
    this.addVar('waveCompoundPeriod', { initialValue: 1, min: -1.5, max: 1.5, step: 0.01 })
    this.addVar('nthLine', { initialValue: 2, min: 1, max: 12, step: 1 })
    this.addVar('offset', { initialValue: 0, min: 0, max: 12, step: 1 })
    this.addVar('belowThickness', { initialValue: 0.6, min: 0.05, max: 3, step: 0.01 })
    this.addVar('aboveThickness', { initialValue: 1, min: 0.05, max: 3, step: 0.01 })
    this.vs.mirrorPalette = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  palette = ['#041fb9', '#6e1ced', '#ff00ff', '#f68b08' /*, '#ffd100'*/]

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)
    const {
      gutter,
      repeats,
      lean,
      whitespace,
      waviness,
      wavePeriod,
      waveCompoundPeriod,
      nthLine,
      offset,
      belowThickness,
      aboveThickness,
    } = this.vars
    const mirrorPalette = !!this.vs.mirrorPalette.value

    const linesPerGroup = mirrorPalette ? this.palette.length * 2 - 2 : this.palette.length
    const extraGutter = Math.max(lean, waviness * 2)
    const effectiveWidth = this.cw - (gutter * 2 + extraGutter)
    const effectiveHeight = this.ch - gutter * 2

    const repeatWidth = (effectiveWidth - whitespace * (repeats - 1)) / repeats
    const lineGap = repeatWidth / linesPerGroup
    const colorCount = this.palette.length

    this.ctx.ctx.lineWidth = belowThickness
    let reverseDirection = false
    for (let c = 0; c < colorCount; c++) {
      for (let i = 0; i < repeats; i++) {
        const x = gutter + waviness + i * repeatWidth + i * whitespace

        for (let j = 0; j < linesPerGroup; j++) {
          const s = mirrorPalette ? (j >= colorCount ? colorCount - (j - (colorCount - 2)) : j) : j
          if (s !== c) continue
          const color = this.palette[s]
          this.ctx.beginPath()
          if (reverseDirection) {
            this.ctx.moveTo(x + j * lineGap + lean, gutter + effectiveHeight)
            this.ctx.lineToRelative(-lean, -effectiveHeight)
          } else {
            this.ctx.moveTo(x + j * lineGap, gutter)
            this.ctx.lineToRelative(lean, effectiveHeight)
          }
          this.ctx.strokeStyle = color
          this.ctx.stroke()
          reverseDirection = !reverseDirection
        }
      }
      const lastColor = c === colorCount - 1
      if (lastColor) {
        penUp(this)
        this.ctx.driver.wait(3000)
      }
      stopAndWigglePen(this, lastColor ? 'Big boi time' : `Color ${c + 1}`)
    }

    this.ctx.ctx.lineWidth = aboveThickness
    this.ctx.strokeStyle = '#000'
    const sineRes = 0.5
    let waveCompound = 0
    for (let i = offset; i < repeats * linesPerGroup; i += nthLine) {
      const percentX = (i - offset) / (repeats * linesPerGroup)
      const baseX =
        gutter + waviness + i * lineGap + Math.floor(i / linesPerGroup) * whitespace + lineGap / 2
      this.ctx.beginPath()
      waveCompound += waveCompoundPeriod / 10
      for (let y = 0; y < effectiveHeight + sineRes; y += sineRes) {
        y = Math.min(y, effectiveHeight)
        const percentY = y / effectiveHeight
        const x = baseX + Math.sin((percentY + waveCompound) * (wavePeriod * deg360)) * waviness
        if (y === 0) this.ctx.moveTo(x, y + gutter)
        else this.ctx.lineTo(x, y + gutter)
      }
      this.ctx.stroke()
    }
  }

  draw(increment: number): void {
    //
  }
}
