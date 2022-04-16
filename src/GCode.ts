import { Unit } from './GCanvas'

export type AllCommandParams = {
  x: number
  y: number
  z: number
  a: number
  b: number
  c: number
  i: number
  j: number
  k: number
  f: number
  t: number
}

export type ArcParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'i' | 'j' | 'f'>>
export type EllipseParams = ArcParams
export type RapidParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'f'>>
export type LinearParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'f' | 'a'>>
export type ZeroParams = Partial<Pick<AllCommandParams, 'a'>>

type Stream = {
  write: (str: string) => void
  reset: () => void
}

export default class GCode {
  public stream: Stream

  constructor(stream?: Stream) {
    this.stream = stream || {
      write: (str) => console.log(str),
      reset: () => {},
    }
  }

  public reset() {
    this.stream.reset()
  }

  public send(code: string, params?: Partial<AllCommandParams>) {
    let command = `${code}`
    if (params) {
      const keys = 'xyzabcijkft'.split('') as (keyof AllCommandParams)[]
      keys.forEach((k) => {
        if (params[k] === undefined || params[k] === null || isNaN(params[k])) return
        command += ` ${k.toUpperCase()}${params[k]}`
      })
    }
    this.stream.write(command)
  }

  public init() {
    this.send('G90') // Absolute mode
  }
  public unit(name: Unit) {
    this.send({ inch: 'G20', mm: 'G21' }[name])
  }
  public speed(n: number) {
    this.send('S' + n)
  }
  public feed(n: number) {
    this.send('F' + n)
  }
  public coolant(type: 'mist' | 'flood' | 'off') {
    if (type === 'mist') this.send('M07') // special
    else if (type) this.send('M08') // flood
    else this.send('M09') // off
  }
  public zero(params: ZeroParams) {
    this.send('G28.3', params)
  }
  // tool selection
  public atc(id: number) {
    this.send('M6', { t: id })
  }
  public rapid(params: RapidParams) {
    this.send('G0', params)
  }
  public linear(params: LinearParams) {
    this.send('G1', params)
  }
  public arcCW(params: ArcParams) {
    this.send('G2', params)
  }
  public arcCCW(params: ArcParams) {
    this.send('G3', params)
  }
  public meta(params: { [key: string]: any }) {
    let comment = '('
    for (var k in params) {
      comment += `${k}=${params[k]}`
    }
    comment += ')'
    this.send(comment)
  }
}
