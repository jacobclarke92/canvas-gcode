import type { Sketch } from './Sketch'
import { floatString } from './utils/numberUtils'

const sliderArea = document.getElementById('slider-area')

interface SliderDOM {
  slider: HTMLInputElement
  labelSpan: HTMLSpanElement
  valueSpan: HTMLElement
}

let sliders: { [key: string]: SliderDOM } = {}

export const renderSketchSliders = (sketch: Sketch, onUpdate?: () => void) => {
  sliders = {}
  sliderArea.innerHTML = ''
  Object.keys(sketch.vs).forEach((key) => {
    const valueRange = sketch.vs[key]
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(valueRange.min)
    slider.max = String(valueRange.max)
    slider.step = String(valueRange.step)
    slider.value = String(valueRange.value)
    slider.setAttribute(`data-slider`, key)

    const label = document.createElement('label')
    const span = document.createElement('span')
    const value = document.createElement('small')

    const handleUpdate = (newValue?: number) => {
      const v = newValue === undefined ? Number(slider.value) : newValue
      value.innerText = floatString(v, 6)
      sketch.vs[key].value = v
      sketch.reset()
      sketch.initDraw()
      onUpdate?.()
    }
    slider.addEventListener('input', (e) => handleUpdate())
    slider.addEventListener('change', (e) => handleUpdate())

    value.addEventListener('click', () => {
      const newValue = window.prompt(`${key}: `, String(slider.value))
      if (newValue === null) return
      const parsedValue = parseFloat(newValue)
      if (isNaN(parsedValue)) return
      handleUpdate(parsedValue)
    })

    value.innerText = floatString(Number(slider.value))
    span.innerText = key
    span.appendChild(value)
    label.appendChild(span)
    label.appendChild(slider)
    sliderArea.appendChild(label)
    valueRange.inputElem = slider

    sliders[key] = { slider, labelSpan: span, valueSpan: value }
  })
}

export const updateSliderValues = (sketch: Sketch) => {
  Object.keys(sliders).forEach((key) => {
    const { slider, valueSpan } = sliders[key]
    slider.value = String(sketch.vs[key].value)
    valueSpan.innerText = floatString(sketch.vs[key].value)
  })
}
