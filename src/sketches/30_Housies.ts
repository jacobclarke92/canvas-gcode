import * as clipperLib from 'js-angusj-clipper/web'

import { clipper } from '../GCanvas'
import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type SubPath from '../SubPath'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import {
  getLineIntersectionPoints,
  lineIntersectsWithAny,
  pointsToLines,
  trimLineToIntersectionPoints,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { flipCoin, randFloatRange, randIntRange } from '../utils/numberUtils'
import { penUp } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Housies extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('speedUp', { name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('seed', { name: 'seed', initialValue: 3129, min: 1000, max: 5000, step: 1 }) // prettier-ignore

    this.addVar('outerGap', { initialValue: 12, min: -25, max: 25, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('houseGap', { initialValue: 2, min: 0, max: 25, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('offsetY', { initialValue: 160, min: -25, max: 320, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('housesOnBlock', { initialValue: 4, min: 1, max: 25, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('blocks', { initialValue: 1, min: 1, max: 25, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('blockGap', { initialValue: 8, min: 0, max: 25, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('perspective', { initialValue: 2, min: 0, max: 10, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('maxHouseHeightRatio', { initialValue: 1.5, min: 0.2, max: 5, step: 0.01, disableRandomize: true }) // prettier-ignore
    this.addVar('windowCrowding', { initialValue: 20, min: 1, max: 40, step: 1.05 }) // prettier-ignore
    this.addVar('windowSpacing', { initialValue: 12, min: 1, max: 25, step: 1 }) // prettier-ignore
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
    const { maxHouseHeightRatio } = this.vars

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
      houseBlockHeight * 0.5,
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

    const subPaths = this.ctx.path!.subPaths
    if (!intersected) console.log('intersect path', this.ctx.path)

    this.ctx.endPath()

    // Draw supports
    if (!intersected) {
      const bottomShapeCenter = new Point(
        startX + bottomShapeOffsetX + bottomShapeWidth / 2,
        startY - bottomShapeHeight * 0.35
      )
      const topShapeCenter = new Point(
        startX + topShapeOffsetX + topShapeWidth / 2,
        startY - topShapeOffsetY - topShapeHeight / 2
      )
      const angle = Point.angleBetween(bottomShapeCenter, topShapeCenter)
      const perpAngle = angle + Math.PI / 2
      const bottomShapeSupportWidth = bottomShapeWidth * 0.5
      const topShapeSupportWidth = topShapeWidth * 0.5

      let support1line1: Line = [
        new Point(
          bottomShapeCenter.x + (Math.cos(perpAngle) * bottomShapeSupportWidth) / 2,
          bottomShapeCenter.y + (Math.sin(perpAngle) * bottomShapeSupportWidth) / 2
        ),
        new Point(
          topShapeCenter.x + (Math.cos(perpAngle) * topShapeSupportWidth) / 2,
          topShapeCenter.y + (Math.sin(perpAngle) * topShapeSupportWidth) / 2
        ),
      ]

      let support1line2: Line = [
        new Point(
          bottomShapeCenter.x + (Math.cos(perpAngle) * bottomShapeSupportWidth) / 2.5,
          bottomShapeCenter.y + (Math.sin(perpAngle) * bottomShapeSupportWidth) / 2.5
        ),
        new Point(
          topShapeCenter.x + (Math.cos(perpAngle) * topShapeSupportWidth) / 2.5,
          topShapeCenter.y + (Math.sin(perpAngle) * topShapeSupportWidth) / 2.5
        ),
      ]

      let support2line1: Line = [
        new Point(
          bottomShapeCenter.x - (Math.cos(perpAngle) * bottomShapeSupportWidth) / 2,
          bottomShapeCenter.y - (Math.sin(perpAngle) * bottomShapeSupportWidth) / 2
        ),
        new Point(
          topShapeCenter.x - (Math.cos(perpAngle) * topShapeSupportWidth) / 2,
          topShapeCenter.y - (Math.sin(perpAngle) * topShapeSupportWidth) / 2
        ),
      ]

      let support2line2: Line = [
        new Point(
          bottomShapeCenter.x - (Math.cos(perpAngle) * bottomShapeSupportWidth) / 2.5,
          bottomShapeCenter.y - (Math.sin(perpAngle) * bottomShapeSupportWidth) / 2.5
        ),
        new Point(
          topShapeCenter.x - (Math.cos(perpAngle) * topShapeSupportWidth) / 2.5,
          topShapeCenter.y - (Math.sin(perpAngle) * topShapeSupportWidth) / 2.5
        ),
      ]

      const lines = [
        ...pointsToLines(subPaths[0].getPoints(), true),
        ...pointsToLines(subPaths[1].getPoints(), true),
      ]

      support1line1 = trimLineToIntersectionPoints(support1line1, lines)
      support1line2 = trimLineToIntersectionPoints(support1line2, lines)
      support2line1 = trimLineToIntersectionPoints(support2line1, lines)
      support2line2 = trimLineToIntersectionPoints(support2line2, lines)

      this.ctx.strokeLine(...support1line1)
      this.ctx.strokeLine(...support1line2)
      this.ctx.strokeLine(...support2line1)
      this.ctx.strokeLine(...support2line2)
    }

    // Draw door
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(startX + bottomShapeOffsetX + bottomShapeWidth / 2 - doorWidth / 2, startY)
    this.ctx.lineToRelative(0, -doorHeight)
    this.ctx.arcToRelative(doorWidth / 2, -doorWidth * 2, doorWidth, 0, doorWidth / 2)
    this.ctx.lineTo(startX + bottomShapeOffsetX + bottomShapeWidth / 2 + doorWidth / 2, startY)
    this.ctx.stroke()
    this.ctx.endPath()
    this.ctx.restore()

    // Draw some windows
    this.drawWindows(subPaths)

    // ClipperLib.Clipper.PointInPolygon

    console.log({ intersected })
  }

  drawWindows(subPaths: SubPath[]) {
    const { windowCrowding, windowSpacing, housesOnBlock } = this.vars
    for (let p = 0; p < subPaths.length; p++) {
      const subPath = subPaths[p]
      const offsetPaths = this.ctx.offsetPath(
        subPath,
        (-Math.max(windowSpacing, 5) * 2) / housesOnBlock
      )
      if (!offsetPaths.length) continue
      for (const offsetPath of offsetPaths) {
        const path = new Path(offsetPath)
        const bounds = path.getBounds()
        // this.ctx.strokeBounds(bounds)
        // this.ctx.strokePath(offsetPath)

        const area = clipper.area(offsetPath) / housesOnBlock
        const numWindows = Math.floor(area / windowCrowding)
        const windowPts: Point[] = []
        let i = 0
        let panic = 0
        while (i < numWindows && panic < 100) {
          const pt = new Point(
            randFloatRange(bounds.left, bounds.right),
            randFloatRange(
              bounds.top,
              p > 0 ? bounds.bottom : bounds.bottom - (bounds.bottom - bounds.top) * 0.2
            )
          )

          if (clipper.pointInPolygon(pt, offsetPath) !== clipperLib.PointInPolygonResult.Inside) {
            panic++
            continue
          }

          if (
            windowPts.some(
              (windowPt) => Point.distance(windowPt, pt) < (windowSpacing * 4) / housesOnBlock
            )
          ) {
            panic++
            continue
          }

          windowPts.push(pt)
          // debugDot(this.ctx, pt, 'black')
          i++
        }

        const averageWindowSize = Math.sqrt(area) / housesOnBlock

        for (const windowPt of windowPts) {
          const windowWidth = randFloatRange(averageWindowSize, averageWindowSize + 2)
          const windowHeight = randFloatRange(averageWindowSize + 1, averageWindowSize + 3)
          this.ctx.strokeRect(
            windowPt.x - windowWidth / 2,
            windowPt.y - windowHeight / 2,
            windowWidth,
            windowHeight
          )
          if (flipCoin()) {
            this.ctx.strokeLine(
              windowPt.x - windowWidth / 2,
              windowPt.y,
              windowPt.x + windowWidth / 2,
              windowPt.y
            )
            this.ctx.strokeLine(
              windowPt.x,
              windowPt.y - windowHeight / 2,
              windowPt.x,
              windowPt.y + windowHeight / 2
            )
          } else {
            // add curtains
            this.ctx.beginPath()
            this.ctx.moveTo(windowPt.x - windowWidth * 0.2, windowPt.y - windowHeight / 2)
            this.ctx.quadraticCurveTo(
              windowPt.x - windowWidth * 0.2,
              windowPt.y,
              windowPt.x - windowWidth / 2,
              windowPt.y + windowHeight * 0.4
            )
            this.ctx.moveTo(windowPt.x + windowWidth * 0.2, windowPt.y - windowHeight / 2)
            this.ctx.quadraticCurveTo(
              windowPt.x + windowWidth * 0.2,
              windowPt.y,
              windowPt.x + windowWidth / 2,
              windowPt.y + windowHeight * 0.4
            )
            this.ctx.stroke()
            this.ctx.endPath()
          }
        }
      }
    }
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    this.stopDraw = false
  }

  draw(): void {
    if (this.stopDraw) return
    const { outerGap, offsetY } = this.vars
    const effectiveWidth = this.cw - outerGap * 2
    const effectiveHeight = this.ch - outerGap * 2

    const { houseGap, housesOnBlock, blocks, blockGap, perspective } = this.vars

    for (let block = 0; block < blocks; block++) {
      const currentHousesOnBlock = housesOnBlock + (blocks - 1 - block) * perspective
      const houseWidth =
        (effectiveWidth - houseGap * (currentHousesOnBlock - 1)) / currentHousesOnBlock

      for (let houseIndex = 0; houseIndex < currentHousesOnBlock; houseIndex++) {
        const startX = outerGap + houseIndex * (houseWidth + houseGap)
        const startY = offsetY

        this.drawHouse({
          startX,
          startY: startY - (blocks - block) * blockGap + blockGap / (blocks - block),
          houseBlockWidth: houseWidth,
          index: houseIndex,
          row: block,
        })
      }
      this.stopDraw = true
      penUp(this)
    }
  }
}
