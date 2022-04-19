import Driver, {
  AllCommandParams,
  ArcParams,
  DriverStream,
  LinearParams,
  RapidParams,
  Unit,
  ZeroParams,
} from './Driver'

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
  public comment(string: string) {
    this.send(`(${string})`)
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
