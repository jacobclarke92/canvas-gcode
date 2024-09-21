import type GCanvas from '../GCanvas'
import type Point from '../Point'
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

  ctx.beginPath()
  ctx.fillStyle = color
  ctx.circle(x, y, 0.75)
  ctx.fill()
  ctx.closePath()
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
