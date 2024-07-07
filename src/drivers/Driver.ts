/* eslint-disable @typescript-eslint/no-empty-function */
export type Unit = 'mm' | 'inch'

export type DriverStream = {
  write: (str: string) => void
  reset: () => void
}

export type AllCommandParams = {
  x: number
  y: number
  z: number
  a: number
  b: number
  c: number
  e: number
  f: number
  i: number
  j: number
  k: number
  p: number
  q: number
  s: number
  t: number
}

export type ArcParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'i' | 'j' | 'f'>>
export type BezierCurveParams = Partial<
  Pick<AllCommandParams, 'x' | 'y' | 'z' | 'i' | 'j' | 'p' | 'q' | 'f' | 's'>
>
export type EllipseParams = ArcParams
export type RapidParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'f'>>
export type LinearParams = Partial<Pick<AllCommandParams, 'x' | 'y' | 'z' | 'f' | 'a'>>
export type ZeroParams = Partial<Pick<AllCommandParams, 'a'>>

export default class Driver {
  public stream: DriverStream

  constructor(stream?: DriverStream) {
    this.stream = stream || {
      write: (str) => console.log(str),
      reset: () => {},
    }
  }

  public reset() {
    this.stream.reset()
  }

  public send(...args: any[]) {}
  public init() {}
  public wait(ms: number) {}
  public unit(name: Unit) {}
  public speed(n: number) {}
  public feed(n: number) {}
  public coolant(type: 'mist' | 'flood' | 'off') {}
  public zero(params: ZeroParams) {}
  // tool selection
  public atc(id: number) {}
  public rapid(params: RapidParams) {}
  public linear(params: LinearParams) {}
  public arcCW(params: ArcParams) {}
  public arcCCW(params: ArcParams) {}
  // public bezierCurve(params: BezierCurveParams) {}
  public comment(string: string) {}
  public meta(params: { [key: string]: any }) {}
}
