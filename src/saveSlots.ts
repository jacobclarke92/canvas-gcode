import type { Sketch } from './Sketch'
import { loadValue, saveValue } from './utils/localStorageUtils'

export const saveNewPreset = (sketch: Sketch) => {
  const saveData = Object.keys(sketch.vs).reduce(
    (acc, key) => ({ ...acc, [key]: sketch.vs[key].value }),
    {} as { [key: string]: number }
  )
  const sketchName = sketch.constructor.name
  const sketchSaveData = loadValue(sketchName, [])
  saveValue(sketchName, [...sketchSaveData, saveData])
  renderSketchSaveSlots(sketch)
}

const saveSlotArea = document.getElementById('save-slots')

export const renderSketchSaveSlots = (sketch: Sketch, onLoad?: () => void) => {
  saveSlotArea.innerHTML = ''
  const presets = loadValue(sketch.constructor.name, [])
  presets.forEach((preset, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.innerText = `${index + 1}`
    button.addEventListener('click', () => {
      onLoad?.()
      sketch.reset()
      console.log('Loading:', preset)
      Object.keys(preset).forEach((key) => {
        sketch.vs[key].setValue(preset[key], true)
      })
      sketch.initDraw()
    })
    saveSlotArea.appendChild(button)
  })
}
