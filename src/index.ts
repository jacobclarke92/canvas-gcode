import GCanvas from './GCanvas'
import GCode from './GCode'
import { Sketch } from './Sketch'

import sketches from './sketches'
import { loadValue, saveValue } from './utils/localStorageUtils'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 1400
const CANVAS_BACKGROUND = '#fff'
const DRAW_STEPS_PER_FRAME = 100

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
const canvasArea = document.getElementById('canvas-area')
const sketchButtonsArea = document.getElementById('sketch-buttons-area')
const sliderArea = document.getElementById('slider-area')
const resetButton = document.getElementById('reset')
const randomizeButton = document.getElementById('randomize')
const gcodeTextarea = document.getElementById('gcode')

let currentSketchIndex = loadValue('sketchIndex', 0)
let CurrentSketch: Sketch
let rafRef: number = 0
let animateIncrement = 0

const init = () => {
  // initialize canvas
  canvas.width = CANVAS_WIDTH * window.devicePixelRatio
  canvas.height = CANVAS_HEIGHT * window.devicePixelRatio
  canvas.style.width = `${CANVAS_WIDTH}px`
  canvas.style.height = `${CANVAS_HEIGHT}px`
  if (canvasArea) canvasArea.appendChild(canvas)
  else document.body.appendChild(canvas)

  // create buttons for all sketches
  sketches.forEach((sketch, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.innerText = `${index + 1} ${sketch.name}`
    if (currentSketchIndex === index) button.classList.add('active')
    button.addEventListener('click', () => {
      const allButtons = sketchButtonsArea.getElementsByTagName('button')
      for (let i = 0; i < allButtons.length; i++) allButtons.item(i).classList.remove('active')
      button.classList.add('active')
      currentSketchIndex = saveValue('sketchIndex', index)
      initSketch(sketch)
    })
    sketchButtonsArea.appendChild(button)
  })

  // initialize first sketch
  initSketch(sketches[currentSketchIndex])

  // bind main function buttons
  resetButton.addEventListener('click', () => {
    if (!CurrentSketch) return
    CurrentSketch.reset()
    CurrentSketch.initDraw()
  })
  randomizeButton.addEventListener('click', () => {
    if (!CurrentSketch) return
    Object.keys(CurrentSketch.vs).forEach((key) => {
      CurrentSketch.vs[key].randomize()
    })
    CurrentSketch.reset()
    CurrentSketch.initDraw()
  })
}

const initSketch = (SketchClass: typeof Sketch) => {
  console.clear()
  console.log('Loading new sketch', SketchClass.name)

  animateIncrement = 0
  if (rafRef) {
    window.cancelAnimationFrame(rafRef)
    rafRef = 0
  }

  gcodeTextarea.innerHTML = SketchClass.generateGCode ? '' : '(GCode disabled for this sketch)'

  // for now just recreate things each initSketch, will probably have memory issue later
  const driver = !SketchClass.generateGCode
    ? undefined
    : new GCode({
        reset: () => { gcodeTextarea.innerHTML = '' }, // prettier-ignore
        write: (line: string) => { gcodeTextarea.innerHTML += line + '\n' }, // prettier-ignore
      })
  const gCanvas = new GCanvas({
    canvas,
    driver,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: CANVAS_BACKGROUND,
  })
  CurrentSketch = new SketchClass({ ctx: gCanvas, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
  CurrentSketch.init()
  CurrentSketch.initDraw()

  // create sliders for all sketch parameters
  sliderArea.innerHTML = ''
  Object.keys(CurrentSketch.vs).forEach((key) => {
    const valueRange = CurrentSketch.vs[key]
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(valueRange.min)
    slider.max = String(valueRange.max)
    slider.step = String(valueRange.step)
    slider.value = String(valueRange.value)

    const handleUpdate = () => {
      const v = slider.value
      CurrentSketch.vs[key].value = Number(v)
      CurrentSketch.reset()
      CurrentSketch.initDraw()
    }
    slider.addEventListener('input', (e) => handleUpdate())
    slider.addEventListener('change', (e) => handleUpdate())

    const label = document.createElement('label')
    const span = document.createElement('span')
    span.innerText = key
    label.appendChild(span)
    label.appendChild(slider)
    sliderArea.appendChild(label)
    valueRange.inputElem = slider
  })

  // begin animation loop
  animate()
}

const animate = () => {
  for (let i = 0; i < DRAW_STEPS_PER_FRAME; i++) {
    animateIncrement++
    CurrentSketch.draw(animateIncrement)
  }
  rafRef = window.requestAnimationFrame(animate)
}

window.addEventListener('load', init)
