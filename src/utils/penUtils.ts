import type { Sketch } from '../Sketch'

export const initPen = (sketch: Sketch) => {
  sketch.ctx.motion.retract(2000)
  sketch.ctx.motion.plunge(5000)
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

export const stopAndWigglePen = (sketch: Sketch, message?: string) => {
  sketch.ctx.driver.comment('----------')
  sketch.ctx.driver.comment('stop and wiggle pen')
  if (message) sketch.ctx.driver.comment(message)
  sketch.ctx.motion.retract()
  sketch.ctx.driver.wait(3000)
  const [x, y] = sketch.ctx.motion.position.toArray()
  for (let i = 0; i < 10; i++) {
    sketch.ctx.motion.linear({ x: x + 5, y })
    sketch.ctx.motion.linear({ x: x - 5, y })
  }
  sketch.ctx.driver.wait(8000)
  sketch.ctx.motion.plunge(5000)
  sketch.ctx.motion.retract(2000)
  sketch.ctx.motion.plunge(5000)
  sketch.ctx.motion.retract(2000)
  sketch.ctx.driver.comment('----------')
}
