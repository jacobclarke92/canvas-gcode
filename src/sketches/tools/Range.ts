import type { Sketch } from '../../Sketch'
import { randIntRange, wrap } from '../../utils/numberUtils'

let counter = 0

export interface RangeOptions {
  name?: string
  initialValue?: number
  min: number
  max: number
  step?: number
  disableRandomize?: boolean
  requires?: string
}

export default class Range {
  public name: string
  public min: number
  public max: number
  public step: number
  public inputElem: HTMLInputElement
  public container: HTMLElement
  public requires?: string
  protected _value: number
  protected _disableRandomize: boolean
  protected _sketch: Sketch

  constructor(options: RangeOptions, sketch?: Sketch) {
    this.name = options.name || `Var-${counter++}`
    this.min = options.min
    this.max = options.max
    this.step = options.step || 0.01
    this.requires = options.requires
    this._value = options.initialValue || options.min
    this._disableRandomize = options.disableRandomize || false
    this._sketch = sketch
    if (this._sketch) this._sketch.vars[this.name] = this._value
  }
  public get value() {
    return this._value
  }
  public set value(value: number) {
    this._value = wrap(value, this.max, this.min)
    if (this._sketch) this._sketch.vars[this.name] = this._value
  }
  public setValue(value: number, updateInput = true) {
    this.value = value
    if (updateInput && this.inputElem) this.inputElem.value = String(this.value)
  }
  public randomize() {
    if (this._disableRandomize) return
    const pieces = Math.round((this.max - this.min) / this.step)
    let value = this.min + randIntRange(pieces) * this.step
    if (this.step >= 1) value = Math.round(value)
    this.setValue(value, true)
  }
}

interface BooleanRangeOptions {
  name?: string
  initialValue?: boolean
  disableRandomize?: boolean
  requires?: string
}

export class BooleanRange extends Range {
  constructor(options: BooleanRangeOptions, sketch?: Sketch) {
    super({ ...options, min: 0, max: 1, step: 1, initialValue: options.initialValue ? 1 : 0 })
    this._value = options.initialValue ? 1 : 0
    if (this._sketch) this._sketch.flags[this.name] = options.initialValue
  }
  public get value() {
    return this._value
  }
  public set value(value: number) {
    this._value = value ? 1 : 0
    if (this._sketch) this._sketch.flags[this.name] = !!value
  }
  public setValue(value: number, updateInput = true) {
    this.value = value ? 1 : 0
    if (updateInput && this.inputElem) this.inputElem.checked = Boolean(this.value)
  }
}
