// Taken from here: https://stackoverflow.com/a/19301306

let m_w = 123456789
let m_z = 987654321
const mask = 0xffffffff

// Takes any integer
export const seedRandom = (integer: number) => {
  m_w = (123456789 + integer) & mask
  m_z = (987654321 - integer) & mask
}

// Returns number between 0 (inclusive) and 1.0 (exclusive),
// just like Math.random().
export const random = () => {
  m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask
  m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask
  const result = ((m_z << 16) + (m_w & 65535)) >>> 0
  return result / 4294967296
}

seedRandom(0)
