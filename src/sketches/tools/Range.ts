import { wrap } from '../../utils/numberUtils'

let counter = 0

interface RangeOptions {
  name?: string
  initialValue?: number
  min: number
  max: number
  step?: number
  disableRandomize?: boolean
}

export default class Range {
  public name: string
  public min: number
  public max: number
  public step: number
  public inputElem: HTMLInputElement
  private _value: number
  private _disableRandomize: boolean

  constructor(options: RangeOptions) {
    this.name = options.name || `Var-${counter++}`
    this.min = options.min
    this.max = options.max
    this.step = options.step || 0.01
    this._value = options.initialValue || options.min
    this._disableRandomize = options.disableRandomize || false
  }
  public get value() {
    return this._value
  }
  public set value(value: number) {
    this._value = wrap(value, this.max, this.min)
  }
  public setValue(value: number, updateInput: boolean = true) {
    this.value = value
    if (updateInput) this.inputElem.value = String(this.value)
  }
  public randomize() {
    if (this._disableRandomize) return
    let value = Math.random() * (this.max - this.min) + this.min
    if (this.step >= 1) value = Math.round(value)
    this.setValue(value, true)
  }
}
