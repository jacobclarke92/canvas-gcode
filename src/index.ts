import throttle from 'lodash-es/throttle'

import GCode from './drivers/GCodeDriver'
import GCanvas from './GCanvas'
import { renderSketchSaveSlots, saveNewPreset } from './saveSlots'
import type { Sketch } from './Sketch'
import sketches from './sketches'
import { renderSketchSliders, updateSliderValues } from './sliders'
import { loadValue, saveValue } from './utils/localStorageUtils'

const CANVAS_WIDTH = 297 - 16
const CANVAS_HEIGHT = 210 - 16
const CANVAS_BACKGROUND = '#fff'
const VIRTUAL_SCALE = 4
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
  canvas.style.display = 'block'
  canvas.width = CANVAS_WIDTH * VIRTUAL_SCALE * window.devicePixelRatio
  canvas.height = CANVAS_HEIGHT * VIRTUAL_SCALE * window.devicePixelRatio
  canvas.style.width = `${CANVAS_WIDTH * VIRTUAL_SCALE}px`
  canvas.style.height = `${CANVAS_HEIGHT * VIRTUAL_SCALE}px`

  let downloadLink: HTMLAnchorElement | null = null
  if (canvasArea) {
    canvasArea.appendChild(canvas)

    const canvasOverlay = document.createElement('div')
    canvasOverlay.style.position = 'absolute'
    canvasOverlay.style.top = '0'
    canvasOverlay.style.left = '0'
    canvasOverlay.style.width = canvas.style.width
    canvasOverlay.style.height = canvas.style.height
    canvasOverlay.style.pointerEvents = 'none'
    canvasOverlay.style.backgroundSize = 'cover'
    canvasOverlay.style.mixBlendMode = 'multiply'
    canvasArea.appendChild(canvasOverlay)

    const downloadButton = document.createElement('button')
    downloadButton.type = 'button'
    downloadButton.textContent = 'Download Image'
    downloadButton.onclick = () => {
      downloadLink = document.createElement('a')
      downloadLink.setAttribute('download', 'CanvasAsImage.png')
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        downloadLink.setAttribute('href', url)
        downloadLink.click()
      })
    }
    canvasArea.appendChild(downloadButton)

    const clearOverlayButton = document.createElement('button')
    clearOverlayButton.type = 'button'
    clearOverlayButton.textContent = 'Clear Overlay'
    clearOverlayButton.style.display = 'none'
    clearOverlayButton.onclick = () => {
      canvasOverlay.style.backgroundImage = ''
      clearOverlayButton.style.display = 'none'
    }
    const overlayImageButton = document.createElement('button')
    overlayImageButton.type = 'button'
    overlayImageButton.textContent = 'Overlay Image'
    overlayImageButton.onclick = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        clearOverlayButton.style.display = ''
        const url = URL.createObjectURL(file)
        canvasOverlay.style.backgroundImage = `url(${url})`
      }
      input.click()
    }
    canvasArea.appendChild(overlayImageButton)
    canvasArea.appendChild(clearOverlayButton)
  } else document.body.appendChild(canvas)

  // create buttons for all sketches
  sketches.forEach((sketch, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.innerText = `${index + 1} ${sketch.name}`
    if (downloadLink) downloadLink.setAttribute('download', `${sketch.name}.png`)
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

  if (window.location.hash) {
    const hash = window.location.hash.slice(1).toLowerCase()
    const index = sketches.findIndex((s) => s.name.toLowerCase() === hash)
    if (index !== -1) currentSketchIndex = index
  }

  const initialLoadSketch = sketches[currentSketchIndex]
  if (downloadLink) downloadLink.setAttribute('download', `${initialLoadSketch.name}.png`)
  initSketch(initialLoadSketch)

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
  CurrentSketch = new SketchClass({
    ctx: gCanvas,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  })
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
  const steps = sketches[currentSketchIndex].disableOverclock ? 1 : DRAW_STEPS_PER_FRAME
  for (let i = 0; i < steps; i++) {
    animateIncrement++
    CurrentSketch.draw(animateIncrement)
  }
  rafRef = window.requestAnimationFrame(animate)
}

window.addEventListener('load', init)
