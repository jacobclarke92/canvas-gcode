import type { BigInteger } from './BigInteger'

// Modular reduction using "classic" algorithm
export class Classic {
  public m: BigInteger

  constructor(m: BigInteger) {
    this.m = m
  }

  public convert(x: BigInteger) {
    if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m)
    else return x
  }
  public revert(x: BigInteger) {
    return x
  }
  public reduce(x: BigInteger) {
    x.divRemTo(this.m, null, x)
  }
  public mulTo(x: BigInteger, y: BigInteger, r: BigInteger) {
    x.multiplyTo(y, r)
    this.reduce(r)
  }
  public sqrTo(x: BigInteger, r: BigInteger) {
    x.squareTo(r)
    this.reduce(r)
  }
}
