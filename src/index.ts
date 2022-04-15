import { Sketch } from './Sketch'
import InitialSketch from './sketches/01_InitialSketch'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 1400
const CANVAS_BACKGROUND = '#fff'
const DRAW_STEPS_PER_FRAME = 100

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')

let CurrentSketch: Sketch

const init = () => {
  // initialize canvas
  canvas.width = CANVAS_WIDTH * window.devicePixelRatio
  canvas.height = CANVAS_HEIGHT * window.devicePixelRatio
  canvas.style.width = `${CANVAS_WIDTH}px`
  canvas.style.height = `${CANVAS_HEIGHT}px`
  document.body.appendChild(canvas)

  // scale drawable area to match device pixel ratio
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)

  // set BG color
  ctx.fillStyle = CANVAS_BACKGROUND
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  CurrentSketch = new InitialSketch({ ctx, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
  CurrentSketch.init()
  // begin animation loop
  animate()
}

let animateIncrement = 0
const animate = () => {
  for (let i = 0; i < DRAW_STEPS_PER_FRAME; i++) {
    animateIncrement++
    CurrentSketch.draw(animateIncrement)
  }
  window.requestAnimationFrame(animate)
}

window.addEventListener('load', init)
