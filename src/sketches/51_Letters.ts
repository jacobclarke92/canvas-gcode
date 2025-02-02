import type { Font, RenderOptions } from 'opentype.js'
import { parse as parseFontFile } from 'opentype.js'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

export default class Letters extends Sketch {
  fonts: { [key: number]: Font } = {}

  init() {
    const fonts = [
      //
      'Danfo[ELSH].ttf',
      'DMSans[opsz,wght].ttf',
      'DynaPuff[wdth,wght].ttf',
      'Montserrat[wght].ttf',
      'NotoEmoji[wght].ttf',
      'Prociono-Regular.ttf',
      'Silkscreen-Bold.ttf',
      'Silkscreen-Regular.ttf',
      'SpaceMono-Bold.ttf',
      'SpaceMono-Regular.ttf',
    ]

    this.addVar('seed', { initialValue: 1234, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 0.1, min: 0, max: 0.4, step: 0.001 })
    this.addVar('baseOffsetX', { initialValue: 35, min: -100, max: 100, step: 1 })
    this.addVar('baseOffsetY', { initialValue: -15, min: -100, max: 100, step: 1 })
    this.addVar('fontIndex', { initialValue: 9, min: 0, max: fonts.length - 1, step: 1 })
    this.addVar('divisionSpan', { initialValue: 5, min: 0.5, max: 50, step: 0.5 })
    this.addVar('letterSpacing', { initialValue: 0.1, min: -0.5, max: 1.5, step: 0.01 })
    this.addVar('suckIn', { initialValue: 18, min: 0, max: 20, step: 0.01 })
    this.addVar('suckInWonk', { initialValue: 0.75, min: 0, max: 1, step: 0.01 })
    this.addVar('wonkMinX', { initialValue: 0.01, min: -20, max: 0, step: 0.01 })
    this.addVar('wonkMaxX', { initialValue: 0, min: 0, max: 20, step: 0.01 })
    this.addVar('wonkMinY', { initialValue: 0.01, min: -20, max: 0, step: 0.01 })
    this.addVar('wonkMaxY', { initialValue: 0, min: 0, max: 20, step: 0.01 })

    Promise.all(
      fonts.map((font, i) =>
        fetch(`/fonts/${fonts[i]}`)
          .then((res) => res.arrayBuffer())
          .then((buffer) => {
            this.fonts[i] = parseFontFile(buffer)
          })
      )
    ).then(() => {
      this.actualInit()
    })
  }

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    if (Object.keys(this.fonts).length > 0) this.actualInit()
  }

  actualInit() {
    const {
      baseOffsetX,
      baseOffsetY,
      fontIndex,
      letterSpacing,
      suckIn,
      suckInWonk,
      wonkMinX,
      wonkMaxX,
      wonkMinY,
      wonkMaxY,
      divisionSpan,
    } = this.vars

    const text = 'BLACK\nON\nBLACK'
    const fontSize = 50

    const letterChars = text.split('')
    const letterGlyphs = letterChars.map((char) => this.fonts[fontIndex].charToGlyph(char))
    const fontSettings: RenderOptions = { kerning: true, letterSpacing }
    const letterPaths = letterGlyphs.map((glyph) => glyph.getPath(2, 82, fontSize, fontSettings))

    let offsetX = baseOffsetX
    let offsetY = baseOffsetY

    let lineCount = 0

    for (let l = 0; l < letterPaths.length; l++) {
      const char = letterChars[l]
      const prevChar = letterChars[l - 1]
      const prevGlyph = letterGlyphs[l - 1]
      const glyph = letterGlyphs[l]
      const path = letterPaths[l]
      const svgPathString = path.toPathData(2)
      const pathCommands = pathToCanvasCommands(svgPathString, true)

      if (char === ' ') {
        offsetX += fontSize
        continue
      }
      if (char === '\n') {
        offsetX = baseOffsetX + fontSize * 0.75 * lineCount
        offsetY += fontSize // * 1.5
        lineCount++
        continue
      }

      const prevBB = prevGlyph ? prevGlyph.getBoundingBox() : null
      const lastLetterOffsetWidth =
        (prevChar
          ? this.fonts[fontIndex].getAdvanceWidth(prevChar, fontSize, fontSettings)
          : // (prevBB.x2 - prevBB.x1) * 0.075
            0) + (prevGlyph ? this.fonts[fontIndex].getKerningValue(prevGlyph, glyph) : 0)

      offsetX += lastLetterOffsetWidth

      // const bb = glyph.getBoundingBox()
      // const letterWidth = (bb.x2 - bb.x1) * 0.075
      const letterWidth =
        this.fonts[fontIndex].getAdvanceWidth(letterChars[l], fontSize, fontSettings) * 0.75
      const letterHeight = fontSize * 2

      const midPt = new Point(letterWidth / 1.3333 + offsetX, letterHeight / 1.6 + offsetY)
      // this.ctx.strokeSvgPath(pathCommands)
      // this.ctx.translate(offsetX, 0)

      const shape = svgPathToShape(pathCommands)
      const ptGroups = shape.getPointGroups({ divisions: divisionSpan, interpolateLines: true })

      console.log(letterChars[l], '\n', svgPathString, '\n', ptGroups, '\n---------')

      for (const pts of ptGroups) {
        if (pts.length <= 2) continue
        this.ctx.beginPath()
        this.ctx.moveTo(
          ...new Point(
            offsetX + pts[0].x + randFloatRange(wonkMaxX, wonkMinX),
            offsetY + pts[0].y + randFloatRange(wonkMaxY, wonkMinY)
          ).toArray()
        )
        for (let i = 1; i < pts.length; i++) {
          const pt = new Point(
            offsetX + pts[i].x + randFloatRange(wonkMaxX, wonkMinX),
            offsetY + pts[i].y + randFloatRange(wonkMaxY, wonkMinY)
          )
          const distToMid = pt.distanceTo(midPt)

          const inverseSuckIn = this.vs.suckIn.max - suckIn
          this.ctx.lineTo(
            ...pt
              .moveTowards(
                midPt,
                inverseSuckIn < 0.5 ? 0 : (distToMid / inverseSuckIn) * randFloatRange(suckInWonk)
              )
              .toArray()
          )
          // const debugHex = Math.floor((i / pts.length) * 255)
          // debugDot(this.ctx, offsetX + pts[i].x, offsetY + pts[i].y, '#0000' + debugHex.toString(16))
        }
        this.ctx.stroke()
        // this.ctx.toolDiameter = 0.5
        // this.ctx.fill()
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
