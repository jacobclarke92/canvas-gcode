import type { Sketch } from './Sketch'
import { BooleanRange } from './sketches/tools/Range'
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
    sketch.vs[key].name = key
  })
  Object.keys(sketch.vs).forEach((key) => {
    const valueRange = sketch.vs[key]
    const isCheckbox = valueRange instanceof BooleanRange
    const dependents = Object.values(sketch.vs).filter((v) => v.name !== key && v.requires === key)

    const slider = document.createElement('input')
    slider.setAttribute(`data-slider`, key)
    if (isCheckbox) {
      slider.type = 'checkbox'
      slider.checked = Boolean(valueRange.value)
    } else {
      slider.type = 'range'
      slider.min = String(valueRange.min)
      slider.max = String(valueRange.max)
      slider.step = String(valueRange.step)
      slider.value = String(valueRange.value)
    }

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
      if (dependents.length)
        dependents.forEach((dep) => {
          dep.container.style.display = v ? 'block' : 'none'
        })
    }

    if (isCheckbox) {
      slider.addEventListener('click', (e) => {
        console.log('CHECKED', slider.checked)
        handleUpdate(slider.checked ? 1 : 0)
      })
    } else {
      slider.addEventListener('input', (e) => handleUpdate())
      slider.addEventListener('change', (e) => handleUpdate())
    }

    if (!isCheckbox)
      value.addEventListener('click', () => {
        const newValue = window.prompt(`${key}: `, String(slider.value))
        if (newValue === null) return
        const parsedValue = parseFloat(newValue)
        if (isNaN(parsedValue)) return
        handleUpdate(parsedValue)
      })

    value.innerText = floatString(Number(isCheckbox ? slider.checked : slider.value))
    span.innerText = key
    span.appendChild(value)
    label.appendChild(span)
    label.appendChild(slider)
    sliderArea.appendChild(label)
    valueRange.inputElem = slider
    valueRange.container = label
    if (valueRange.presentation) label.style.opacity = '0.5'

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
