import type { Sketch } from '../Sketch'

export const initPen = (sketch: Sketch) => {
  sketch.ctx.motion.retract(2000)
  sketch.ctx.motion.plunge(8000)
  sketch.ctx.motion.retract(2000)
}

export const plotBounds = (sketch: Sketch) => {
  sketch.ctx.strokeRect(0, 0, 2, 2)
  sketch.ctx.strokeRect(sketch.cw - 2, 0, 2, 2)
  sketch.ctx.strokeRect(sketch.cw - 2, sketch.ch - 2, 2, 2)
  sketch.ctx.strokeRect(0, sketch.ch - 2, 2, 2)
}

export const penUp = (sketch: Sketch) => {
  sketch.ctx.motion.retract()
}
