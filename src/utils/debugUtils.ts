import GCanvas from '../GCanvas'

export const debugDot = (ctx: GCanvas, x: number, y: number, color: string = '#ff0000') => {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.circle(x, y, 2)
  ctx.fill()
  ctx.closePath()
}
