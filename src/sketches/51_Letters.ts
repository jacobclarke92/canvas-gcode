import type { Font, RenderOptions } from 'opentype.js'
import { parse as parseTtf } from 'opentype.js'

import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Letters extends Sketch {
  font: Font

  init() {
    this.addVar('seed', { initialValue: 1234, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 0.1, min: 0, max: 0.4, step: 0.001 })

    fetch('/fonts/primetime.ttf')
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        this.font = parseTtf(buffer)
        this.actualInit()
      })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
  }

  actualInit() {
    const text = 'JOURNEY'
    const fontSize = 50
    const scale = (1 / this.font.unitsPerEm) * fontSize

    const letterChars = text.split('')
    const letterGlyphs = letterChars.map((char) => this.font.charToGlyph(char))
    const fontSettings: RenderOptions = { kerning: true, letterSpacing: 0.1 }
    const letterPaths = letterGlyphs.map((glyph) => glyph.getPath(2, 82, fontSize, fontSettings))

    for (let l = 0; l < letterPaths.length; l++) {
      const prevChar = letterChars[l - 1]
      const prevGlyph = letterGlyphs[l - 1]
      const glyph = letterGlyphs[l]
      const path = letterPaths[l]
      const pathCommands = pathToCanvasCommands(path.toPathData(2), true)

      const offsetX =
        (prevChar ? this.font.getAdvanceWidth(prevChar, fontSize, fontSettings) : 0) +
        (prevGlyph ? this.font.getKerningValue(prevGlyph, glyph) : 0)

      this.ctx.strokeSvgPath(pathCommands)
      this.ctx.translate(offsetX, 0)

      const shape = svgPathToShape(pathCommands)
      const pts = shape.getPoints(20)

      // for (const pt of pts) {
      //   debugDot(this.ctx, pt)
      // }

      // const pts = shape.getPoints(20)
      // return pts.map((pt) => new IntPoint(pt.x + 2.2, pt.y + 18))
      // console.log(pts)
    }
  }

  draw(increment: number): void {
    //
  }
}
