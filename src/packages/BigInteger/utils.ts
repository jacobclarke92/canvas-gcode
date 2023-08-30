// Digit conversions
const BI_RM = '0123456789abcdefghijklmnopqrstuvwxyz'
const BI_RC = new Array()

let rr: number, vv: number
rr = '0'.charCodeAt(0)
for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv
rr = 'a'.charCodeAt(0)
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv
rr = 'A'.charCodeAt(0)
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv

export const int2char = (n: number) => BI_RM.charAt(n)

export const intAt = (s: string, i: number) => {
  const c = BI_RC[s.charCodeAt(i)]
  return c == null ? -1 : c
}

// returns bit length of the integer x
export const nBits = (x: number) => {
  let r = 1,
    t
  if ((t = x >>> 16) != 0) {
    x = t
    r += 16
  }
  if ((t = x >> 8) != 0) {
    x = t
    r += 8
  }
  if ((t = x >> 4) != 0) {
    x = t
    r += 4
  }
  if ((t = x >> 2) != 0) {
    x = t
    r += 2
  }
  if ((t = x >> 1) != 0) {
    x = t
    r += 1
  }
  return r
}

// Copyright (c) 2005-2009  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.
// Extended JavaScript BN functions, required for RSA private ops.
// Version 1.1: new BigInteger("0", 10) returns "proper" zero
// Version 1.2: square() API, isProbablePrime fix

// return index of lowest 1-bit in x, x < 2^31
export const lBit = (x: number) => {
  if (x == 0) return -1
  let r = 0
  if ((x & 0xffff) == 0) {
    x >>= 16
    r += 16
  }
  if ((x & 0xff) == 0) {
    x >>= 8
    r += 8
  }
  if ((x & 0xf) == 0) {
    x >>= 4
    r += 4
  }
  if ((x & 3) == 0) {
    x >>= 2
    r += 2
  }
  if ((x & 1) == 0) ++r
  return r
}

// return number of 1 bits in x
export const cBit = (x: number) => {
  let r = 0
  while (x != 0) {
    x &= x - 1
    ++r
  }
  return r
}
