import GCanvas from '../GCanvas'
import Point from '../Point'
import { OverloadedFunctionWithOptionals } from '../types'

export const debugDot: OverloadedFunctionWithOptionals<
  [ctx: GCanvas, pt: Point] | [ctx: GCanvas, x: number, y: number],
  [color: string]
> = (...args) => {
  const ctx = args[0]
  const x =
    args.length === 2 || (args.length === 3 && typeof args[2] !== 'number') ? (args[1] as Point).x : (args[1] as number)
  const y =
    args.length === 2 || (args.length === 3 && typeof args[2] !== 'number') ? (args[1] as Point).y : (args[2] as number)
  const color = args.length === 3 && typeof args[2] === 'string' ? args[2] : args[3] || '#ff0000'

  ctx.beginPath()
  ctx.fillStyle = color
  ctx.circle(x, y, 2)
  ctx.fill()
  ctx.closePath()
}
