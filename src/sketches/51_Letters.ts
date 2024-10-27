import type { Font, RenderOptions } from 'opentype.js'
import { parse as parseTtf } from 'opentype.js'

import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Letters extends Sketch {
  font: Font

  init() {
    this.addVar('seed', { initialValue: 1234, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 0.1, min: 0, max: 0.4, step: 0.001 })
    this.addVar('wonkMinX', { initialValue: 0.01, min: -20, max: 0, step: 0.01 })
    this.addVar('wonkMaxX', { initialValue: 0, min: 0, max: 20, step: 0.01 })
    this.addVar('wonkMinY', { initialValue: 0.01, min: -20, max: 0, step: 0.01 })
    this.addVar('wonkMaxY', { initialValue: 0, min: 0, max: 20, step: 0.01 })

    fetch('/fonts/primetime.ttf')
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        this.font = parseTtf(buffer)
        this.actualInit()
      })
  }

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    if (this.font) this.actualInit()
  }

  actualInit() {
    const { wonkMinX, wonkMaxX, wonkMinY, wonkMaxY } = this.vars

    const text = 'JOURNEY'
    const fontSize = 50

    const letterChars = text.split('')
    const letterGlyphs = letterChars.map((char) => this.font.charToGlyph(char))
    const fontSettings: RenderOptions = { kerning: true, letterSpacing: 0.4 }
    const letterPaths = letterGlyphs.map((glyph) => glyph.getPath(2, 82, fontSize, fontSettings))

    let offsetX = 0

    for (let l = 0; l < letterPaths.length; l++) {
      const prevChar = letterChars[l - 1]
      const prevGlyph = letterGlyphs[l - 1]
      const glyph = letterGlyphs[l]
      const path = letterPaths[l]
      const pathCommands = pathToCanvasCommands(path.toPathData(2), true)

      const lastLetterOffsetWidth =
        (prevChar ? this.font.getAdvanceWidth(prevChar, fontSize, fontSettings) : 0) +
        (prevGlyph ? this.font.getKerningValue(prevGlyph, glyph) : 0)

      offsetX += lastLetterOffsetWidth

      // this.ctx.strokeSvgPath(pathCommands)
      // this.ctx.translate(offsetX, 0)

      const shape = svgPathToShape(pathCommands)
      const ptGroups = shape.getPointGroups({ divisions: 5, interpolateLines: true })

      console.log(letterChars[l], ptGroups)

      for (const pts of ptGroups) {
        if (pts.length <= 2) continue
        this.ctx.beginPath()
        this.ctx.moveTo(
          offsetX + pts[0].x + randFloatRange(wonkMaxX, wonkMinX),
          pts[0].y + randFloatRange(wonkMaxY, wonkMinY)
        )
        for (let i = 1; i < pts.length; i++) {
          this.ctx.lineTo(
            offsetX + pts[i].x + randFloatRange(wonkMaxX, wonkMinX),
            pts[i].y + randFloatRange(wonkMaxY, wonkMinY)
          )
          // debugDot(this.ctx, offsetX + pts[i].x, pts[i].y)
        }
        this.ctx.stroke()
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
