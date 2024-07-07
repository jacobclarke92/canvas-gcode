import * as clipperLib from 'js-angusj-clipper/web'

import { Sketch } from '../Sketch'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Housies extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.seed = new Range({ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }, this) // prettier-ignore

    this.vs.outerGap = new Range({ initialValue: 12, min: -25, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.houseGap = new Range({ initialValue: 2, min: 0, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.housesOnBlock = new Range({ initialValue: 4, min: 1, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.blocks = new Range({ initialValue: 1, min: 1, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.blockGap = new Range({ initialValue: 8, min: 0, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.perspective = new Range({ initialValue: 2, min: 0, max: 10, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.maxHouseHeightRatio = new Range({ initialValue: 1.5, min: 0.2, max: 5, step: 0.01, disableRandomize: true }, this) // prettier-ignore
  }

  private stopDraw = false
  private possibleBottomShapes = [
    //
    'rectangle',
    'triangle',
    'pentagon',
    'hexagon',
  ] as const
  private possibleTopShapes = [
    //
    'rectangle',
    'circle',
    'triangle',
    'pentagon',
    // 'hexagon',
  ] as const

  drawGon({
    centerX,
    centerY,
    diameter,
    sides,
  }: {
    centerX: number
    centerY: number
    diameter: number
    sides: number
  }): void {
    let angle = sides % 2 === 1 ? -(Math.PI * 2) / (sides * 4) : 0
    const segmentAngle = (Math.PI * 2) / sides
    const radius = (diameter / 2) * (1 + 1 / sides)
    for (let i = 0; i < sides; i++) {
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      if (i === 0) this.ctx.moveTo(x, y)
      else this.ctx.lineTo(x, y)
      angle += segmentAngle
    }
  }

  drawShape({
    width,
    height,
    startX,
    startY,
    offsetX,
    offsetY,
    shape,
  }: {
    width: number
    height: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    shape: (typeof this.possibleBottomShapes)[number] | (typeof this.possibleTopShapes)[number]
  }) {
    switch (shape) {
      case 'rectangle': {
        this.ctx.rect(startX + offsetX, startY - (offsetY + height), width, height)
        break
      }
      case 'triangle': {
        this.ctx.moveTo(startX + offsetX, startY - offsetY)
        this.ctx.lineToRelative(width / 2, -height)
        this.ctx.lineToRelative(width / 2, height)
        this.ctx.lineToRelative(-width, 0)
        break
      }
      case 'circle': {
        this.ctx.circle(startX + offsetX + width / 2, startY - offsetY - height / 2, width / 2)
        break
      }
      case 'pentagon': {
        const diameter = (width + height) / 2
        const centerX = startX + offsetX + width / 2
        const centerY = startY - offsetY - diameter / 2
        this.drawGon({ centerX, centerY, diameter, sides: 5 })
        break
      }
      case 'hexagon': {
        const diameter = (width + height) / 2
        const centerX = startX + offsetX + width / 2
        const centerY = startY - offsetY - diameter / 2
        this.drawGon({ centerX, centerY, diameter, sides: 6 })
        break
      }
    }
  }

  drawHouse({
    startX,
    startY,
    houseBlockWidth,
    index,
    row,
  }: {
    startX: number
    startY: number
    houseBlockWidth: number
    index: number
    row: number
  }): void {
    console.log('------')
    const { maxHouseHeightRatio = 1.5 } = this.vars

    const houseBlockHeight = houseBlockWidth * maxHouseHeightRatio

    const bottomShapeAlign = ['left', 'center', 'right'][randIntRange(3)]

    const bottomShape =
      this.possibleBottomShapes[randIntRange(this.possibleBottomShapes.length - 1)]
    const topShape = this.possibleTopShapes[randIntRange(this.possibleTopShapes.length - 1)]

    const bottomShapeWidth = randFloatRange(houseBlockWidth * 0.8, houseBlockWidth * 0.25)
    const bottomShapeHeight = randFloatRange(houseBlockHeight * 0.75, houseBlockHeight * 0.5)
    let bottomShapeOffsetX = 0
    if (bottomShapeAlign === 'center')
      bottomShapeOffsetX += (houseBlockWidth - bottomShapeWidth) / 2
    else if (bottomShapeAlign === 'right') bottomShapeOffsetX += houseBlockWidth - bottomShapeWidth

    const topShapeWidth = randFloatRange(houseBlockWidth, houseBlockWidth / 2)
    const topShapeHeight = randFloatRange(
      houseBlockHeight * 0.75,
      Math.max(bottomShapeHeight, houseBlockHeight * 0.25)
    )
    const topShapeOffsetX = randFloatRange(houseBlockWidth - topShapeWidth)
    const topShapeOffsetY = randFloatRange(houseBlockHeight - topShapeHeight, bottomShapeHeight / 2)

    const doorWidth = Math.min(3, bottomShapeWidth / 4)
    const doorHeight = doorWidth * 1.75

    // this.ctx.strokeRect(
    //   startX,
    //   startY - houseBlockHeight,
    //   houseBlockWidth,
    //   houseBlockHeight,
    //   { debug: true }
    // )

    // draw bottom shape
    this.ctx.beginPath()
    this.drawShape({
      shape: bottomShape,
      startX,
      startY,
      width: bottomShapeWidth,
      height: bottomShapeHeight,
      offsetX: bottomShapeOffsetX,
      offsetY: 0,
    })

    // draw top shape
    this.drawShape({
      shape: topShape,
      startX,
      startY,
      width: topShapeWidth,
      height: topShapeHeight,
      offsetX: topShapeOffsetX,
      offsetY: topShapeOffsetY,
    })

    const { intersected } = this.ctx.clipCurrentPath({
      clipType: clipperLib.ClipType.Union,
    })

    this.ctx.stroke({ cutout: row > 0 })
    this.ctx.closePath()

    // Draw door
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(startX + bottomShapeOffsetX + bottomShapeWidth / 2 - doorWidth / 2, startY)
    this.ctx.lineToRelative(0, -doorHeight)
    this.ctx.arcToRelative(doorWidth / 2, -doorWidth * 2, doorWidth, 0, doorWidth / 2)
    this.ctx.lineTo(startX + bottomShapeOffsetX + bottomShapeWidth / 2 + doorWidth / 2, startY)
    this.ctx.stroke()
    this.ctx.closePath()
    this.ctx.restore()

    console.log({ intersected })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    this.stopDraw = false
  }

  draw(): void {
    if (this.stopDraw) return
    const outerGap = this.vs.outerGap.value
    const effectiveWidth = this.cw - outerGap * 2
    const effectiveHeight = this.ch - outerGap * 2

    const { houseGap = 2, housesOnBlock = 4, blocks = 1, blockGap = 8, perspective = 2 } = this.vars

    for (let block = 0; block < blocks; block++) {
      const currentHousesOnBlock = housesOnBlock + (blocks - 1 - block) * perspective
      const houseWidth =
        (effectiveWidth - houseGap * (currentHousesOnBlock - 1)) / currentHousesOnBlock

      for (let houseIndex = 0; houseIndex < currentHousesOnBlock; houseIndex++) {
        const startX = outerGap + houseIndex * (houseWidth + houseGap)
        const startY = 100

        this.drawHouse({
          startX,
          startY: startY - (blocks - block) * blockGap + blockGap / (blocks - block),
          houseBlockWidth: houseWidth,
          index: houseIndex,
          row: block,
        })
      }
      this.stopDraw = true
    }
  }
}
