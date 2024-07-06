import type {
  AllCommandParams,
  ArcParams,
  BezierCurveParams,
  DriverStream,
  LinearParams,
  RapidParams,
  Unit,
  ZeroParams,
} from './Driver'
import Driver from './Driver'

type Stream = {
  write: (str: string) => void
  reset: () => void
}

export default class GCode extends Driver {
  public stream: Stream

  constructor(stream?: DriverStream) {
    super(stream)
    this.stream = stream || {
      write: (str) => console.log(str),
      reset: () => {
        //
      },
    }
  }

  public reset() {
    this.stream.reset()
    this.init()
  }

  public send(
    code: string,
    params?: Partial<AllCommandParams>,
    comment?: string
  ) {
    let command = `${code}`
    if (params) {
      const keys = 'zabcijkfpqstxy'.split('') as (keyof AllCommandParams)[]
      keys.forEach((k) => {
        if (params[k] === undefined || params[k] === null || isNaN(params[k]))
          return
        command += ` ${k.toUpperCase()}${params[k]}`
      })
    }
    if (comment) command += ` (${comment})`
    this.stream.write(command)
  }

  public init() {
    // this.send('G00 (move as fast as it can or is programmed to)')
    // this.send('G90 (absolute position mode)')
    // this.send('G80 (cancel any previously used canned cycles)')
    this.send('G17 (select the xy plane)')
    // this.send('G28 (rapid to home position)')
    // this.send('M3 S0 (activate servo)')
  }

  public unit(name: Unit) {
    this.send({ inch: 'G20', mm: 'G21' }[name] + ` (select ${name} unit)`)
  }
  public speed(n: number) {
    this.send(`S${n} (set speed to ${n})`)
  }
  public feed(n: number) {
    this.send(`F${n} (set feed to ${n})`)
  }
  public coolant(type: 'mist' | 'flood' | 'off') {
    if (type === 'mist') this.send('M07') // special
    else if (type) this.send('M08') // flood
    else this.send('M09') // off
  }
  public zero(params: ZeroParams, comment?: string) {
    this.send('G28.3', params, comment)
  }
  // tool selection
  public atc(id: number, comment?: string) {
    this.send('M6', { t: id })
  }
  public rapid(params: RapidParams, comment?: string) {
    this.send('G0', params, comment)
  }
  public linear(params: LinearParams, comment?: string) {
    this.send('G1', params, comment)
  }
  public arcCW(params: ArcParams, comment?: string) {
    this.send('G3', params, comment)
  }
  public arcCCW(params: ArcParams, comment?: string) {
    this.send('G2', params, comment)
  }
  // this is not widely supported
  // public bezierCurve(params: BezierCurveParams) {
  //   this.send('G5', params)
  // }
  public comment(string: string) {
    this.send(`(${string})`)
  }
  public meta(params: { [key: string]: any }) {
    let comment = '('
    for (const k in params) {
      comment += `${k}=${params[k]}`
    }
    comment += ')'
    this.send(comment)
  }
}
