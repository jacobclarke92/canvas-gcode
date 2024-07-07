import { Barrett } from './Barrett'
import { Classic } from './Classic'
import { Montgomery } from './Montgomery'
import type { OpFunc } from './ops'
import { op_and, op_andNot, op_or, op_xor } from './ops'
import { cBit, int2char, intAt, lBit, nBits } from './utils'

export let BIGINT_USED = false

const BI_FP = 52

const lowPrimes = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193,
  197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307,
  311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421,
  431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547,
  557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659,
  661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797,
  809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929,
  937, 941, 947, 953, 967, 971, 977, 983, 991, 997,
]
const lpLim = (1 << 26) / lowPrimes[lowPrimes.length - 1]

// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.
// Basic JavaScript BN library - subset useful for RSA encryption.
// Bits per digit
let dBits: number

// JavaScript engine analysis
const canary = 0xdeadbeefcafe
const j_lm = (canary & 0xffffff) == 0xefcafe

const navigator_appName = navigator.appName
if (j_lm && navigator_appName == 'Microsoft Internet Explorer') {
  // BigInteger.prototype.am = am2;
  dBits = 30
} else if (j_lm && navigator_appName != 'Netscape') {
  // BigInteger.prototype.am = am1;
  dBits = 26
} else {
  // Mozilla/Netscape seems to prefer am3
  // BigInteger.prototype.am = am3;
  dBits = 28
}

// return new, unset BigInteger
export const nbi = () => new BigInteger(null, undefined, undefined)

// return bigint initialized to value
export const nbv = (i: number) => {
  const v = nbi()
  v.fromInt(i)
  return v
}

export class BigInteger extends Array<number> {
  public static ZERO = nbv(0)
  public static ONE = nbv(1)

  public DB = dBits
  public DM = (1 << dBits) - 1
  public DV = 1 << dBits

  public FV = Math.pow(2, BI_FP)
  public F1 = BI_FP - dBits
  public F2 = 2 * dBits - BI_FP

  public s: number
  public t: number

  public am: (i: number, x: number, w: BigInteger, j: number, c: number, n: number) => number

  constructor(a: number | string | null, b?: number | null, c?: number) {
    super()
    // This test variable can be removed,
    // but at least for performance tests it is useful piece of knowledge
    // This is the only ClipperLib related variable in BigInteger library
    BIGINT_USED = true
    if (a != null) {
      if (typeof a === 'number' && !b) this.fromInt(a) // faster conversion
      else if (typeof a === 'number') this.fromNumber(a, b, c)
      else if (b === null && typeof a !== 'string') this.fromString(a, 256)
      else this.fromString(a, b)
    }

    if (j_lm && navigator_appName == 'Microsoft Internet Explorer') this.am = this.am2
    else if (j_lm && navigator_appName != 'Netscape') this.am = this.am1
    // Mozilla/Netscape seems to prefer am3
    else this.am = this.am3
  }

  public fromInt(x: number) {
    this.t = 1
    this.s = x < 0 ? -1 : 0
    if (x > 0) this[0] = x
    else if (x < -1) this[0] = x + this.DV
    else this.t = 0
  }

  public fromNumber(a: number, b: number, c?: number) {
    // if (typeof b === 'number') {

    if (a < 2) this.fromInt(1)
    else {
      this.fromNumber(a, c)
      if (!this.testBit(a - 1))
        // force MSB set
        this.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, this)
      if (this.isEven()) this.dAddOffset(1, 0) // force odd
      while (!this.isProbablePrime(b)) {
        this.dAddOffset(2, 0)
        if (this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a - 1), this)
      }
    }
    /*
    } else {
      const x = new Array<number>(),
        t = a & 7
      x.length = (a >> 3) + 1
      b.nextBytes(x)
      if (t > 0) x[0] &= (1 << t) - 1
      else x[0] = 0
      this.fromString(x, 256)
    }
    */
  }

  // (protected) copy this to r
  public copyTo(r: BigInteger) {
    for (let i = this.t - 1; i >= 0; --i) r[i] = this[i]
    r.t = this.t
    r.s = this.s
  }

  // (protected) set from string and radix
  public fromString(s: string, b: number) {
    let k: number
    if (b == 16) k = 4
    else if (b == 8) k = 3
    else if (b == 256) k = 8 // byte array
    else if (b == 2) k = 1
    else if (b == 32) k = 5
    else if (b == 4) k = 2
    else {
      this.fromRadix(s, b)
      return
    }
    this.t = 0
    this.s = 0
    let i = s.length,
      mi = false,
      sh = 0
    while (--i >= 0) {
      const x = k == 8 ? parseInt(s[i]) & 0xff : intAt(s, i)
      if (x < 0) {
        if (s.charAt(i) == '-') mi = true
        continue
      }
      mi = false
      if (sh == 0) this[this.t++] = x
      else if (sh + k > this.DB) {
        this[this.t - 1] |= (x & ((1 << (this.DB - sh)) - 1)) << sh
        this[this.t++] = x >> (this.DB - sh)
      } else this[this.t - 1] |= x << sh
      sh += k
      if (sh >= this.DB) sh -= this.DB
    }
    if (k == 8 && (parseInt(s[0]) & 0x80) != 0) {
      this.s = -1
      if (sh > 0) this[this.t - 1] |= ((1 << (this.DB - sh)) - 1) << sh
    }
    this.clamp()
    if (mi) BigInteger.ZERO.subTo(this, this)
  }

  // (protected) clamp off excess high words
  public clamp() {
    const c = this.s & this.DM
    while (this.t > 0 && this[this.t - 1] == c) --this.t
  }

  // (protected) r = this << n*DB
  public dlShiftTo(n: number, r: BigInteger) {
    for (let i = this.t - 1; i >= 0; --i) r[i + n] = this[i]
    for (let i = n - 1; i >= 0; --i) r[i] = 0
    r.t = this.t + n
    r.s = this.s
  }

  // (protected) r = this >> n*DB
  public drShiftTo(n: number, r: BigInteger) {
    for (let i = n; i < this.t; ++i) r[i - n] = this[i]
    r.t = Math.max(this.t - n, 0)
    r.s = this.s
  }

  // (protected) r = this << n
  public lShiftTo(n: number, r: BigInteger) {
    const bs = n % this.DB
    const cbs = this.DB - bs
    const bm = (1 << cbs) - 1
    const ds = Math.floor(n / this.DB)
    let c = (this.s << bs) & this.DM
    for (let i = this.t - 1; i >= 0; --i) {
      r[i + ds + 1] = (this[i] >> cbs) | c
      c = (this[i] & bm) << bs
    }
    for (let i = ds - 1; i >= 0; --i) r[i] = 0
    r[ds] = c
    r.t = this.t + ds + 1
    r.s = this.s
    r.clamp()
  }

  public rShiftTo(n: number, r: BigInteger) {
    r.s = this.s
    const ds = Math.floor(n / this.DB)
    if (ds >= this.t) {
      r.t = 0
      return
    }
    const bs = n % this.DB
    const cbs = this.DB - bs
    const bm = (1 << bs) - 1
    r[0] = this[ds] >> bs
    for (let i = ds + 1; i < this.t; ++i) {
      r[i - ds - 1] |= (this[i] & bm) << cbs
      r[i - ds] = this[i] >> bs
    }
    if (bs > 0) r[this.t - ds - 1] |= (this.s & bm) << cbs
    r.t = this.t - ds
    r.clamp()
  }

  // (protected) r = this >> n
  public shiftTo(n: number, r: BigInteger) {
    r.s = this.s
    const ds = Math.floor(n / this.DB)
    if (ds >= this.t) {
      r.t = 0
      return
    }
    const bs = n % this.DB
    const cbs = this.DB - bs
    const bm = (1 << bs) - 1
    r[0] = this[ds] >> bs
    for (let i = ds + 1; i < this.t; ++i) {
      r[i - ds - 1] |= (this[i] & bm) << cbs
      r[i - ds] = this[i] >> bs
    }
    if (bs > 0) r[this.t - ds - 1] |= (this.s & bm) << cbs
    r.t = this.t - ds
    r.clamp()
  }

  // (protected) r = this - a
  public subTo(a: BigInteger, r: BigInteger) {
    const m = Math.min(a.t, this.t)
    let i = 0,
      c = 0
    while (i < m) {
      c += this[i] - a[i]
      r[i++] = c & this.DM
      c >>= this.DB
    }
    if (a.t < this.t) {
      c -= a.s
      while (i < this.t) {
        c += this[i]
        r[i++] = c & this.DM
        c >>= this.DB
      }
      c += this.s
    } else {
      c += this.s
      while (i < a.t) {
        c -= a[i]
        r[i++] = c & this.DM
        c >>= this.DB
      }
      c -= a.s
    }
    r.s = c < 0 ? -1 : 0
    if (c < -1) r[i++] = this.DV + c
    else if (c > 0) r[i++] = c
    r.t = i
    r.clamp()
  }

  // (protected) r = this * a, r != this,a (HAC 14.12)
  // "this" should be the larger one if appropriate.
  public multiplyTo(a: BigInteger, r: BigInteger) {
    const x = this.abs(),
      y = a.abs()
    let i = x.t
    r.t = i + y.t
    while (--i >= 0) r[i] = 0
    for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t)
    r.s = 0
    r.clamp()
    if (this.s != a.s) BigInteger.ZERO.subTo(r, r)
  }

  // (protected) r = this^2, r != this (HAC 14.16)
  public squareTo(r: BigInteger) {
    const x = this.abs()
    let i = (r.t = 2 * x.t)
    while (--i >= 0) r[i] = 0
    for (i = 0; i < x.t - 1; ++i) {
      const c = x.am(i, x[i], r, 2 * i, 0, 1)
      if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
        r[i + x.t] -= x.DV
        r[i + x.t + 1] = 1
      }
    }
    if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1)
    r.s = 0
    r.clamp()
  }

  // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
  // r != q, this != m.  q or r may be null.
  public divRemTo(m: BigInteger, q: BigInteger, r: BigInteger) {
    const pm = m.abs()
    if (pm.t <= 0) return
    const pt = this.abs()
    if (pt.t < pm.t) {
      if (q != null) q.fromInt(0)
      if (r != null) this.copyTo(r)
      return
    }
    if (r == null) r = nbi()
    const y = nbi(),
      ts = this.s,
      ms = m.s
    const nsh = this.DB - nBits(pm[pm.t - 1]) // normalize modulus
    if (nsh > 0) {
      pm.lShiftTo(nsh, y)
      pt.lShiftTo(nsh, r)
    } else {
      pm.copyTo(y)
      pt.copyTo(r)
    }
    const ys = y.t
    const y0 = y[ys - 1]
    if (y0 == 0) return
    const yt = y0 * (1 << this.F1) + (ys > 1 ? y[ys - 2] >> this.F2 : 0)
    const d1 = this.FV / yt,
      d2 = (1 << this.F1) / yt,
      e = 1 << this.F2,
      t = q == null ? nbi() : q
    let i = r.t,
      j = i - ys
    y.dlShiftTo(j, t)
    if (r.compareTo(t) >= 0) {
      r[r.t++] = 1
      r.subTo(t, r)
    }
    BigInteger.ONE.dlShiftTo(ys, t)
    t.subTo(y, y) // "negative" y so we can replace sub with am later
    while (y.t < ys) y[y.t++] = 0
    while (--j >= 0) {
      // Estimate quotient digit
      let qd = r[--i] == y0 ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2)
      if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
        // Try it out
        y.dlShiftTo(j, t)
        r.subTo(t, r)
        while (r[i] < --qd) r.subTo(t, r)
      }
    }
    if (q != null) {
      r.drShiftTo(ys, q)
      if (ts != ms) BigInteger.ZERO.subTo(q, q)
    }
    r.t = ys
    r.clamp()
    if (nsh > 0) r.rShiftTo(nsh, r) // Denormalize remainder
    if (ts < 0) BigInteger.ZERO.subTo(r, r)
  }

  // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
  // justification:
  //         xy == 1 (mod m)
  //         xy =  1+km
  //   xy(2-xy) = (1+km)(1-km)
  // x[y(2-xy)] = 1-k^2m^2
  // x[y(2-xy)] == 1 (mod m^2)
  // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
  // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
  // JS multiply "overflows" differently from C/C++, so care is needed here.
  public invDigit() {
    if (this.t < 1) return 0
    const x = this[0]
    if ((x & 1) == 0) return 0
    let y = x & 3 // y == 1/x mod 2^2
    y = (y * (2 - (x & 0xf) * y)) & 0xf // y == 1/x mod 2^4
    y = (y * (2 - (x & 0xff) * y)) & 0xff // y == 1/x mod 2^8
    y = (y * (2 - (((x & 0xffff) * y) & 0xffff))) & 0xffff // y == 1/x mod 2^16
    // last step - calculate inverse mod DV directly;
    // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
    y = (y * (2 - ((x * y) % this.DV))) % this.DV // y == 1/x mod 2^dbits
    // we really want the negative inverse, and -DV < y < DV
    return y > 0 ? this.DV - y : -y
  }

  // (protected) r = this + a
  public addTo(a: BigInteger, r: BigInteger) {
    let i = 0,
      c = 0
    const m = Math.min(a.t, this.t)
    while (i < m) {
      c += this[i] + a[i]
      r[i++] = c & this.DM
      c >>= this.DB
    }
    if (a.t < this.t) {
      c += a.s
      while (i < this.t) {
        c += this[i]
        r[i++] = c & this.DM
        c >>= this.DB
      }
      c += this.s
    } else {
      c += this.s
      while (i < a.t) {
        c += a[i]
        r[i++] = c & this.DM
        c >>= this.DB
      }
      c += a.s
    }
    r.s = c < 0 ? -1 : 0
    if (c > 0) r[i++] = c
    else if (c < -1) r[i++] = this.DV + c
    r.t = i
    r.clamp()
  }

  // (protected) true iff this is even
  public isEven() {
    return (this.t > 0 ? this[0] & 1 : this.s) == 0
  }

  // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
  public exp(e: number, z: Classic | Montgomery | Barrett) {
    if (e > 0xffffffff || e < 1) return BigInteger.ONE
    const g = z.convert(this)
    let r = nbi(),
      r2 = nbi(),
      i = nBits(e) - 1
    g.copyTo(r)
    while (--i >= 0) {
      z.sqrTo(r, r2)
      if ((e & (1 << i)) > 0) z.mulTo(r2, g, r)
      else {
        const t = r
        r = r2
        r2 = t
      }
    }
    return z.revert(r)
  }

  // (public)
  public clone() {
    const r = nbi()
    this.copyTo(r)
    return r
  }

  // (public) return value as integer
  public intValue() {
    if (this.s < 0) {
      if (this.t == 1) return this[0] - this.DV
      else if (this.t == 0) return -1
    } else if (this.t == 1) return this[0]
    else if (this.t == 0) return 0
    // assumes 16 < DB < 32
    return ((this[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this[0]
  }

  // (public) return value as byte
  public byteValue() {
    return this.t == 0 ? this.s : (this[0] << 24) >> 24
  }

  // (public) return value as short (assumes DB>=16)
  public shortValue() {
    return this.t == 0 ? this.s : (this[0] << 16) >> 16
  }

  // (protected) return x s.t. r^x < DV
  public chunkSize(r: number) {
    return Math.floor((Math.LN2 * this.DB) / Math.log(r))
  }

  // (public) 0 if this == 0, 1 if this > 0
  public signum() {
    if (this.s < 0) return -1
    else if (this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0
    else return 1
  }

  // (protected) convert to radix string
  public toRadix(b: number | null) {
    if (b === null) b = 10
    if (this.signum() === 0 || b < 2 || b > 36) return '0'
    const cs = this.chunkSize(b)
    const a = Math.pow(b, cs)
    const d = nbv(a)
    const y = nbi()
    const z = nbi()
    let r = ''

    this.divRemTo(d, y, z)
    while (y.signum() > 0) {
      r = (a + z.intValue()).toString(b).substr(1) + r
      y.divRemTo(d, y, z)
    }
    return z.intValue().toString(b) + r
  }

  // (protected) convert from radix string
  public fromRadix(s: string, b: number | null) {
    this.fromInt(0)
    if (b === null) b = 10
    const cs = this.chunkSize(b)
    const d = Math.pow(b, cs)
    let mi = false,
      j = 0,
      w = 0
    for (let i = 0; i < s.length; ++i) {
      const x = intAt(s, i)
      if (x < 0) {
        if (s.charAt(i) == '-' && this.signum() === 0) mi = true
        continue
      }
      w = b * w + x
      if (++j >= cs) {
        this.dMultiply(d)
        this.dAddOffset(w, 0)
        j = 0
        w = 0
      }
    }
    if (j > 0) {
      this.dMultiply(Math.pow(b, j))
      this.dAddOffset(w, 0)
    }
    if (mi) BigInteger.ZERO.subTo(this, this)
  }

  // (public) convert to bigendian byte array
  public toByteArray() {
    let i = this.t
    const r = new Array<number>()
    r[0] = this.s
    let p = this.DB - ((i * this.DB) % 8),
      d,
      k = 0
    if (i-- > 0) {
      if (p < this.DB && (d = this[i] >> p) != (this.s & this.DM) >> p)
        r[k++] = d | (this.s << (this.DB - p))
      while (i >= 0) {
        if (p < 8) {
          d = (this[i] & ((1 << p) - 1)) << (8 - p)
          d |= this[--i] >> (p += this.DB - 8)
        } else {
          d = (this[i] >> (p -= 8)) & 0xff
          if (p <= 0) {
            p += this.DB
            --i
          }
        }
        if ((d & 0x80) != 0) d |= -256
        if (k == 0 && (this.s & 0x80) != (d & 0x80)) ++k
        if (k > 0 || d != this.s) r[k++] = d
      }
    }
    return r
  }

  public equals(a: BigInteger) {
    return this.compareTo(a) == 0
  }

  public min(a: BigInteger) {
    return this.compareTo(a) < 0 ? this : a
  }

  public max(a: BigInteger) {
    return this.compareTo(a) > 0 ? this : a
  }

  // (protected) r = this op a (bitwise)
  public bitwiseTo(a: BigInteger, op: OpFunc, r: BigInteger) {
    const m = Math.min(a.t, this.t)
    let i: number, f: number
    for (i = 0; i < m; ++i) r[i] = op(this[i], a[i])
    if (a.t < this.t) {
      f = a.s & this.DM
      for (i = m; i < this.t; ++i) r[i] = op(this[i], f)
      r.t = this.t
    } else {
      f = this.s & this.DM
      for (i = m; i < a.t; ++i) r[i] = op(f, a[i])
      r.t = a.t
    }
    r.s = op(this.s, a.s)
    r.clamp()
  }

  // (public) return string representation in given radix
  // @ts-expect-error we're overwriting toString
  public toString(b: number | null): string {
    if (this.s < 0) return '-' + this.negate().toString(b)
    let k: number
    if (b == 16) k = 4
    else if (b == 8) k = 3
    else if (b == 2) k = 1
    else if (b == 32) k = 5
    else if (b == 4) k = 2
    else return this.toRadix(b)
    const km = (1 << k) - 1
    let d: number,
      m = false,
      r = '',
      i = this.t
    let p = this.DB - ((i * this.DB) % k)
    if (i-- > 0) {
      if (p < this.DB && (d = this[i] >> p) > 0) {
        m = true
        r = int2char(d)
      }
      while (i >= 0) {
        if (p < k) {
          d = (this[i] & ((1 << p) - 1)) << (k - p)
          d |= this[--i] >> (p += this.DB - k)
        } else {
          d = (this[i] >> (p -= k)) & km
          if (p <= 0) {
            p += this.DB
            --i
          }
        }
        if (d > 0) m = true
        if (m) r += int2char(d)
      }
    }
    return m ? r : '0'
  }

  // (public) -this
  public negate() {
    const r = nbi()
    BigInteger.ZERO.subTo(this, r)
    return r
  }

  // (public) |this|
  public abs() {
    return this.s < 0 ? this.negate() : this
  }

  // (public) return + if this > a, - if this < a, 0 if equal
  public compareTo(a: BigInteger) {
    let r = this.s - a.s
    if (r != 0) return r
    let i = this.t
    r = i - a.t
    if (r != 0) return this.s < 0 ? -r : r
    while (--i >= 0) if ((r = this[i] - a[i]) != 0) return r
    return 0
  }

  // (public) return the number of bits in "this"
  public bitLength() {
    if (this.t <= 0) return 0
    return this.DB * (this.t - 1) + nBits(this[this.t - 1] ^ (this.s & this.DM))
  }

  // (public) this mod a
  public mod(a: BigInteger) {
    const r = nbi()
    this.abs().divRemTo(a, null, r)
    if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r)
    return r
  }

  public and(a: BigInteger) {
    const r = nbi()
    this.bitwiseTo(a, op_and, r)
    return r
  }

  public or(a: BigInteger) {
    const r = nbi()
    this.bitwiseTo(a, op_or, r)
    return r
  }

  public xor(a: BigInteger) {
    const r = nbi()
    this.bitwiseTo(a, op_xor, r)
    return r
  }

  public andNot(a: BigInteger) {
    const r = nbi()
    this.bitwiseTo(a, op_andNot, r)
    return r
  }

  // (public) ~this
  public not() {
    const r = nbi()
    for (let i = 0; i < this.t; ++i) r[i] = this.DM & ~this[i]
    r.t = this.t
    r.s = ~this.s
    return r
  }

  // (public) this << n
  public shiftLeft(n: number) {
    const r = nbi()
    if (n < 0) this.rShiftTo(-n, r)
    else this.lShiftTo(n, r)
    return r
  }

  // (public) this >> n
  public shiftRight(n: number) {
    const r = nbi()
    if (n < 0) this.lShiftTo(-n, r)
    else this.rShiftTo(n, r)
    return r
  }

  // (public) returns index of lowest 1-bit (or -1 if none)
  public getLowestSetBit() {
    for (let i = 0; i < this.t; ++i) {
      if (this[i] != 0) return i * this.DB + lBit(this[i])
    }
    if (this.s < 0) return this.t * this.DB
    return -1
  }

  // (public) return number of set bits
  public bitCount() {
    let r = 0
    const x = this.s & this.DM
    for (let i = 0; i < this.t; ++i) r += cBit(this[i] ^ x)
    return r
  }

  // (public) true iff nth bit is set
  public testBit(n: number) {
    const j = Math.floor(n / this.DB)
    if (j >= this.t) return this.s != 0
    return (this[j] & (1 << n % this.DB)) != 0
  }

  // (protected) this op (1<<n)
  public changeBit(n: number, op: OpFunc) {
    const r = BigInteger.ONE.shiftLeft(n)
    this.bitwiseTo(r, op, r)
    return r
  }

  // (public) this | (1<<n)
  public setBit(n: number) {
    return this.changeBit(n, op_or)
  }

  // (public) this & ~(1<<n)
  public clearBit(n: number) {
    return this.changeBit(n, op_andNot)
  }

  // (public) this ^ (1<<n)
  public flipBit(n: number) {
    return this.changeBit(n, op_xor)
  }

  // (public) this + a
  public add(a: BigInteger) {
    const r = nbi()
    this.addTo(a, r)
    return r
  }

  // (public) this - a
  public subtract(a: BigInteger) {
    const r = nbi()
    this.subTo(a, r)
    return r
  }

  // (public) this * a
  public multiply(a: BigInteger) {
    const r = nbi()
    this.multiplyTo(a, r)
    return r
  }

  // (public) this^2
  public square() {
    const r = nbi()
    this.squareTo(r)
    return r
  }

  // (public) this / a
  public divide(a: BigInteger) {
    const r = nbi()
    this.divRemTo(a, r, null)
    return r
  }

  // (public) this % a
  public remainder(a: BigInteger) {
    const r = nbi()
    this.divRemTo(a, null, r)
    return r
  }

  // (public) [this/a,this%a]
  public divideAndRemainder(a: BigInteger) {
    const q = nbi(),
      r = nbi()
    this.divRemTo(a, q, r)
    return new Array<BigInteger>(q, r)
  }

  // (protected) this *= n, this >= 0, 1 < n < DV
  public dMultiply(n: number) {
    this[this.t] = this.am(0, n - 1, this, 0, 0, this.t)
    ++this.t
    this.clamp()
  }

  // (protected) this += n << w words, this >= 0
  public dAddOffset(n: number, w: number) {
    if (n == 0) return
    while (this.t <= w) this[this.t++] = 0
    this[w] += n
    while (this[w] >= this.DV) {
      this[w] -= this.DV
      if (++w >= this.t) this[this.t++] = 0
      ++this[w]
    }
  }

  // (public) this^e % m, 0 <= e < 2^32
  public modPowInt(e: number, m: BigInteger) {
    let z
    if (e < 256 || m.isEven()) z = new Classic(m)
    else z = new Montgomery(m)
    return this.exp(e, z)
  }

  // am: Compute w_j += (x*this_i), propagate carries,
  // c is initial carry, returns final carry.
  // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
  // We need to select the fastest one that works in this environment.
  // am1: use a single mult and divide to get the high bits,
  // max digit bits should be 26 because
  // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
  private am1(i: number, x: number, w: BigInteger, j: number, c: number, n: number) {
    while (--n >= 0) {
      const v = x * this[i++] + w[j] + c
      c = Math.floor(v / 0x4000000)
      w[j++] = v & 0x3ffffff
    }
    return c
  }

  // am2 avoids a big mult-and-extract completely.
  // Max digit bits should be <= 30 because we do bitwise ops
  // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
  private am2(i: number, x: number, w: BigInteger, j: number, c: number, n: number) {
    const xl = x & 0x7fff,
      xh = x >> 15
    while (--n >= 0) {
      let l = this[i] & 0x7fff
      const h = this[i++] >> 15
      const m = xh * l + h * xl
      l = xl * l + ((m & 0x7fff) << 15) + w[j] + (c & 0x3fffffff)
      c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30)
      w[j++] = l & 0x3fffffff
    }
    return c
  }

  // Alternately, set max digit bits to 28 since some
  // browsers slow down when dealing with 32-bit numbers.
  private am3(i: number, x: number, w: BigInteger, j: number, c: number, n: number) {
    const xl = x & 0x3fff,
      xh = x >> 14
    while (--n >= 0) {
      let l = this[i] & 0x3fff
      const h = this[i++] >> 14
      const m = xh * l + h * xl
      l = xl * l + ((m & 0x3fff) << 14) + w[j] + c
      c = (l >> 28) + (m >> 14) + xh * h
      w[j++] = l & 0xfffffff
    }
    return c
  }

  // (public) this^e % m (HAC 14.85)
  public modPow(e: BigInteger, m: BigInteger) {
    let i = e.bitLength(),
      k: number,
      r = nbv(1),
      z: Classic | Barrett | Montgomery

    if (i <= 0) return r
    else if (i < 18) k = 1
    else if (i < 48) k = 3
    else if (i < 144) k = 4
    else if (i < 768) k = 5
    else k = 6

    if (i < 8) z = new Classic(m)
    else if (m.isEven()) z = new Barrett(m)
    else z = new Montgomery(m)
    // pre-computation
    let n = 3
    const g = new Array<BigInteger>(),
      k1 = k - 1,
      km = (1 << k) - 1
    g[1] = z.convert(this)
    if (k > 1) {
      const g2 = nbi()
      z.sqrTo(g[1], g2)
      while (n <= km) {
        g[n] = nbi()
        z.mulTo(g2, g[n - 2], g[n])
        n += 2
      }
    }
    let j = e.t - 1,
      w: number,
      is1 = true,
      r2 = nbi(),
      t: BigInteger
    i = nBits(e[j]) - 1
    while (j >= 0) {
      if (i >= k1) w = (e[j] >> (i - k1)) & km
      else {
        w = (e[j] & ((1 << (i + 1)) - 1)) << (k1 - i)
        if (j > 0) w |= e[j - 1] >> (this.DB + i - k1)
      }
      n = k
      while ((w & 1) == 0) {
        w >>= 1
        --n
      }
      if ((i -= n) < 0) {
        i += this.DB
        --j
      }
      if (is1) {
        // ret == 1, don't bother squaring or multiplying it
        g[w].copyTo(r)
        is1 = false
      } else {
        while (n > 1) {
          z.sqrTo(r, r2)
          z.sqrTo(r2, r)
          n -= 2
        }
        if (n > 0) z.sqrTo(r, r2)
        else {
          t = r
          r = r2
          r2 = t
        }
        z.mulTo(r2, g[w], r)
      }
      while (j >= 0 && (e[j] & (1 << i)) == 0) {
        z.sqrTo(r, r2)
        t = r
        r = r2
        r2 = t
        if (--i < 0) {
          i = this.DB - 1
          --j
        }
      }
    }
    return z.revert(r)
  }
  // (public) gcd(this,a) (HAC 14.54)
  public gdc(a: BigInteger) {
    let x = this.s < 0 ? this.negate() : this.clone()
    let y = a.s < 0 ? a.negate() : a.clone()
    if (x.compareTo(y) < 0) {
      const t = x
      x = y
      y = t
    }
    let i = x.getLowestSetBit(),
      g = y.getLowestSetBit()
    if (g < 0) return x
    if (i < g) g = i
    if (g > 0) {
      x.rShiftTo(g, x)
      y.rShiftTo(g, y)
    }
    while (x.signum() > 0) {
      if ((i = x.getLowestSetBit()) > 0) x.rShiftTo(i, x)
      if ((i = y.getLowestSetBit()) > 0) y.rShiftTo(i, y)
      if (x.compareTo(y) >= 0) {
        x.subTo(y, x)
        x.rShiftTo(1, x)
      } else {
        y.subTo(x, y)
        y.rShiftTo(1, y)
      }
    }
    if (g > 0) y.lShiftTo(g, y)
    return y
  }

  // (protected) this % n, n < 2^26
  public modInt(n: number) {
    if (n <= 0) return 0
    const d = this.DV % n
    let r = this.s < 0 ? n - 1 : 0
    if (this.t > 0)
      if (d == 0) r = this[0] % n
      else for (let i = this.t - 1; i >= 0; --i) r = (d * r + this[i]) % n
    return r
  }

  // (public) 1/this % m (HAC 14.61)
  public modInverse(m: BigInteger) {
    const ac = m.isEven()
    if ((this.isEven() && ac) || m.signum() == 0) return BigInteger.ZERO
    const u = m.clone(),
      v = this.clone()
    const a = nbv(1),
      b = nbv(0),
      c = nbv(0),
      d = nbv(1)
    while (u.signum() != 0) {
      while (u.isEven()) {
        u.rShiftTo(1, u)
        if (ac) {
          if (!a.isEven() || !b.isEven()) {
            a.addTo(this, a)
            b.subTo(m, b)
          }
          a.rShiftTo(1, a)
        } else if (!b.isEven()) b.subTo(m, b)
        b.rShiftTo(1, b)
      }
      while (v.isEven()) {
        v.rShiftTo(1, v)
        if (ac) {
          if (!c.isEven() || !d.isEven()) {
            c.addTo(this, c)
            d.subTo(m, d)
          }
          c.rShiftTo(1, c)
        } else if (!d.isEven()) d.subTo(m, d)
        d.rShiftTo(1, d)
      }
      if (u.compareTo(v) >= 0) {
        u.subTo(v, u)
        if (ac) a.subTo(c, a)
        b.subTo(d, b)
      } else {
        v.subTo(u, v)
        if (ac) c.subTo(a, c)
        d.subTo(b, d)
      }
    }
    if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO
    if (d.compareTo(m) >= 0) return d.subtract(m)
    if (d.signum() < 0) d.addTo(m, d)
    else return d
    if (d.signum() < 0) return d.add(m)
    else return d
  }

  // (public) test primality with certainty >= 1-.5^t
  public isProbablePrime(t: number) {
    let i: number
    const x = this.abs()
    if (x.t == 1 && x[0] <= lowPrimes[lowPrimes.length - 1]) {
      for (i = 0; i < lowPrimes.length; ++i) if (x[0] == lowPrimes[i]) return true
      return false
    }
    if (x.isEven()) return false
    i = 1
    while (i < lowPrimes.length) {
      let m = lowPrimes[i],
        j = i + 1
      while (j < lowPrimes.length && m < lpLim) m *= lowPrimes[j++]
      m = x.modInt(m)
      while (i < j) if (m % lowPrimes[i++] == 0) return false
    }
    return x.millerRabin(t)
  }

  // (protected) true if probably prime (HAC 4.24, Miller-Rabin)
  public millerRabin(t: number) {
    const n1 = this.subtract(BigInteger.ONE)
    const k = n1.getLowestSetBit()
    if (k <= 0) return false
    const r = n1.shiftRight(k)
    t = (t + 1) >> 1
    if (t > lowPrimes.length) t = lowPrimes.length
    const a = nbi()
    for (let i = 0; i < t; ++i) {
      //Pick bases at random, instead of starting at 2
      a.fromInt(lowPrimes[Math.floor(Math.random() * lowPrimes.length)])
      let y = a.modPow(r, this)
      if (y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
        let j = 1
        while (j++ < k && y.compareTo(n1) != 0) {
          y = y.modPowInt(2, this)
          if (y.compareTo(BigInteger.ONE) == 0) return false
        }
        if (y.compareTo(n1) != 0) return false
      }
    }
    return true
  }

  // (protected) r = lower n words of "this * a", a.t <= n
  // "this" should be the larger one if appropriate.
  public multiplyLowerTo(a: BigInteger, n: number, r: BigInteger) {
    let i = Math.min(this.t + a.t, n)
    r.s = 0 // assumes a,this >= 0
    r.t = i
    while (i > 0) r[--i] = 0
    let j: number
    for (j = r.t - this.t; i < j; ++i) r[i + this.t] = this.am(0, a[i], r, i, 0, this.t)
    for (j = Math.min(a.t, n); i < j; ++i) this.am(0, a[i], r, i, 0, n - i)
    r.clamp()
  }

  // (protected) r = "this * a" without lower n words, n > 0
  // "this" should be the larger one if appropriate.
  public multiplyUpperTo(a: BigInteger, n: number, r: BigInteger) {
    --n
    let i = (r.t = this.t + a.t - n)
    r.s = 0 // assumes a,this >= 0
    while (--i >= 0) r[i] = 0
    for (i = Math.max(n - this.t, 0); i < a.t; ++i)
      r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n)
    r.clamp()
    r.drShiftTo(1, r)
  }
}

export class Int128 extends BigInteger {
  public static op_Equality(val1: BigInteger, val2: BigInteger) {
    if (val1.compareTo(val2) == 0) return true
    else return false
  }
  public static op_Inequality(val1: BigInteger, val2: BigInteger) {
    if (val1.compareTo(val2) != 0) return true
    else return false
  }

  public static op_GreaterThan(val1: BigInteger, val2: BigInteger) {
    if (val1.compareTo(val2) > 0) return true
    else return false
  }

  public static op_LessThan(val1: BigInteger, val2: BigInteger) {
    if (val1.compareTo(val2) < 0) return true
    else return false
  }

  public static op_Addition(lhs: number, rhs: number) {
    return new Int128(lhs, undefined, undefined).add(new Int128(rhs, undefined, undefined))
  }

  public static op_Subtraction(lhs: number, rhs: number) {
    return new Int128(lhs, undefined, undefined).subtract(new Int128(rhs, undefined, undefined))
  }

  public static Int128Mul(lhs: number, rhs: number) {
    return new Int128(lhs, undefined, undefined).multiply(new Int128(rhs, undefined, undefined))
  }

  public static op_Division(lhs: BigInteger, rhs: BigInteger) {
    return lhs.divide(rhs)
  }

  public IsNegative() {
    if (this.compareTo(Int128.ZERO) == -1) return true
    else return false
  }

  public ToDouble() {
    return parseFloat(this.toString(null)) // This could be something faster
  }
}
