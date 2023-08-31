import type { BigInteger } from './BigInteger'

export class NullExp {
  public convert(x: unknown) {
    return x
  }
  public revert(x: unknown) {
    return x
  }
  public mulTo(x: BigInteger, y: BigInteger, r: BigInteger) {
    x.multiplyTo(y, r)
  }
  public sqrTo(x: BigInteger, r: BigInteger) {
    x.squareTo(r)
  }
}
