import type GCanvas from '../GCanvas'
import Point from '../Point'
import type { OverloadedFunctionWithOptionals } from '../types'

export const debugDot: OverloadedFunctionWithOptionals<
  [ctx: GCanvas, pt: Point] | [ctx: GCanvas, x: number, y: number],
  [color: string]
> = (...args) => {
  const ctx = args[0]
  const x =
    args.length === 2 || (args.length === 3 && typeof args[2] !== 'number')
      ? (args[1] as Point).x
      : (args[1] as number)
  const y =
    args.length === 2 || (args.length === 3 && typeof args[2] !== 'number')
      ? (args[1] as Point).y
      : (args[2] as number)
  const color = args.length === 3 && typeof args[2] === 'string' ? args[2] : args[3] || '#ff0000'

  const prevFillStyle = ctx.ctx.fillStyle
  ctx.ctx.beginPath()
  ctx.ctx.fillStyle = color
  ctx.ctx.arc(x, y, 0.75, 0, Math.PI * 2)
  ctx.ctx.fill()
  ctx.ctx.closePath()
  ctx.ctx.fillStyle = prevFillStyle
}

export const debugLine: OverloadedFunctionWithOptionals<
  | [ctx: GCanvas, start: Point, end: Point]
  | [ctx: GCanvas, x1: number, y1: number, x2: number, y2: number],
  [color: string]
> = (...args) => {
  const ctx = args[0]
  const start =
    args.length === 3 || args.length === 4
      ? (args[1] as Point)
      : new Point(args[1] as number, args[2] as number)
  const end =
    args.length === 3 || args.length === 4
      ? (args[2] as Point)
      : new Point(args[3] as number, args[4] as number)
  const color = args.length === 4 ? args[3] : args.length === 6 ? args[5] : '#ff0000'

  const prevStrokeStyle = ctx.ctx.strokeStyle
  ctx.ctx.beginPath()
  ctx.ctx.strokeStyle = color
  ctx.ctx.moveTo(start.x, start.y)
  ctx.ctx.lineTo(end.x, end.y)
  ctx.ctx.stroke()
  ctx.ctx.closePath()
  ctx.ctx.strokeStyle = prevStrokeStyle
}

type DebugOptions = { stroke?: string; fill?: string; size?: number; decimals?: number }
const defaultDebugOptions = {
  stroke: 'black',
  fill: 'white',
  size: 4,
  decimals: 2,
} as Required<DebugOptions>
export const debugText = (
  ctx: GCanvas,
  text: number | string,
  pt: Point | [x: number, y: number],
  options?: DebugOptions
) => {
  const { stroke, fill, size, decimals } = { ...defaultDebugOptions, ...options }
  const point = Array.isArray(pt) ? pt : pt.toArray()
  if (typeof text === 'string' && text.indexOf('\n') !== -1) {
    const parts = text.split('\n')
    const lineHeight = size * 1.1
    const height = lineHeight * (parts.length - 1)
    parts.forEach((part, i) => {
      debugText(ctx, part, [point[0], point[1] - height / 2 + i * lineHeight], options)
    })
    return
  }
  ctx.ctx.textAlign = 'center'
  ctx.ctx.textBaseline = 'middle'
  ctx.ctx.font = `${size}px Impact`
  const prevStrokeWidth = ctx.ctx.lineWidth
  const prevStrokeStyle = ctx.ctx.strokeStyle
  const prevFillStyle = ctx.ctx.fillStyle
  ctx.ctx.lineWidth = size / 2.5
  ctx.ctx.strokeStyle = stroke
  ctx.ctx.fillStyle = fill
  ctx.ctx.strokeText(typeof text === 'string' ? text : text.toFixed(decimals), ...point)
  ctx.ctx.fillText(typeof text === 'string' ? text : text.toFixed(decimals), ...point)
  ctx.ctx.lineWidth = prevStrokeWidth
  ctx.ctx.strokeStyle = prevStrokeStyle
  ctx.ctx.fillStyle = prevFillStyle
}
