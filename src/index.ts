import { throttle } from 'lodash'

import GCode from './drivers/GCodeDriver'
import GCanvas from './GCanvas'
import { renderSketchSaveSlots, saveNewPreset } from './saveSlots'
import type { Sketch } from './Sketch'
import sketches from './sketches'
import { renderSketchSliders, updateSliderValues } from './sliders'
import { loadValue, saveValue } from './utils/localStorageUtils'

const CANVAS_WIDTH = 140
const CANVAS_HEIGHT = 100
const CANVAS_BACKGROUND = '#fff'
const VIRTUAL_SCALE = 8
const DRAW_STEPS_PER_FRAME = 100

const canvas = document.createElement('canvas')
const canvasArea = document.getElementById('canvas-area')
const sketchButtonsArea = document.getElementById('sketch-buttons-area')
const saveButton = document.getElementById('save-button')
const resetButton = document.getElementById('reset')
const randomizeButton = document.getElementById('randomize')
const gcodeTextarea = document.getElementById('gcode')

let currentSketchIndex = loadValue('sketchIndex', 0)
let CurrentSketch: Sketch
let rafRef = 0
let animateIncrement = 0

const init = () => {
  // initialize canvas
  canvas.width = CANVAS_WIDTH * VIRTUAL_SCALE * window.devicePixelRatio
  canvas.height = CANVAS_HEIGHT * VIRTUAL_SCALE * window.devicePixelRatio
  canvas.style.width = `${CANVAS_WIDTH * VIRTUAL_SCALE}px`
  canvas.style.height = `${CANVAS_HEIGHT * VIRTUAL_SCALE}px`
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
    animateIncrement = 0
    CurrentSketch.reset()
    CurrentSketch.initDraw()
  })
  randomizeButton.addEventListener('click', () => {
    if (!CurrentSketch) return
    animateIncrement = 0
    Object.keys(CurrentSketch.vs).forEach((key) => {
      CurrentSketch.vs[key].randomize()
    })
    updateSliderValues(CurrentSketch)
    CurrentSketch.reset()
    CurrentSketch.initDraw()
  })
  saveButton.addEventListener('click', () => {
    if (!CurrentSketch) return
    saveNewPreset(CurrentSketch)
  })
}

const _setGCodeHTML = (str: string) => (gcodeTextarea.innerHTML = str)
const setGCodeHTML = throttle(_setGCodeHTML, 1000)

let gCodeString = ''
const setGCode = (str: string) => {
  gCodeString = str
  setGCodeHTML(gCodeString)
}
const appendGCode = (str: string) => {
  gCodeString += str + '\n'
  setGCodeHTML(gCodeString)
}

const initSketch = (SketchClass: typeof Sketch) => {
  console.clear()
  console.log('Loading new sketch', SketchClass.name)

  animateIncrement = 0
  if (rafRef) {
    window.cancelAnimationFrame(rafRef)
    rafRef = 0
  }

  setGCode(SketchClass.generateGCode ? '' : '(GCode disabled for this sketch)')

  // for now just recreate things each initSketch, will probably have memory issue later
  const driver = !SketchClass.generateGCode
    ? undefined
    : new GCode({
        reset: () => { setGCode('') }, // prettier-ignore
        write: (line: string) => { appendGCode(line) }, // prettier-ignore
      })
  const gCanvas = new GCanvas({
    canvas,
    driver,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    virtualScale: VIRTUAL_SCALE,
    background: CANVAS_BACKGROUND,
  })
  CurrentSketch = new SketchClass({ ctx: gCanvas, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
  CurrentSketch.init()
  CurrentSketch.initDraw()

  // create sliders for all sketch parameters
  renderSketchSliders(CurrentSketch, () => {
    animateIncrement = 0
  })

  // populate save slots from localStorage
  renderSketchSaveSlots(CurrentSketch, () => {
    animateIncrement = 0
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
