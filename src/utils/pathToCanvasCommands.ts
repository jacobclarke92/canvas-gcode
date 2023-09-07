/**
 * Adapted from https://github.com/mbostock/path-data
 */

const commandsMap = {
  Z: 'Z',
  M: 'M',
  L: 'L',
  C: 'C',
  Q: 'Q',
  A: 'A',
  H: 'H',
  V: 'V',
  S: 'S',
  T: 'T',
  z: 'Z',
  m: 'm',
  l: 'l',
  c: 'c',
  q: 'q',
  a: 'a',
  h: 'h',
  v: 'v',
  s: 's',
  t: 't',
} as const
type Command = keyof typeof commandsMap

export type SvgPathSegment = { type: Command; values: number[] }
export type SimplifiedSvgPathSegment = { type: Extract<Command, 'M' | 'L' | 'C' | 'Z'>; values: number[] }
type Vec2 = [x: number, y: number]

type Curve = [r1: number, r1: number, r2: number, r2: number, r3: number, r3: number]

export function pathToCanvasCommands(string: string, normalize: true): SimplifiedSvgPathSegment[]
export function pathToCanvasCommands(string: string, normalize: false): SvgPathSegment[]
export function pathToCanvasCommands(string: string, normalize = false) {
  if (!(string += '') || string.length === 0) return []
  const pathData: SvgPathSegment[] = []

  let currentIndex = 0
  const endIndex = string.length
  let prevCommand: Command | null = null

  skipOptionalSpaces()

  function parseSegment() {
    const char = string[currentIndex]
    let command = char in commandsMap ? commandsMap[char as Command] : null

    if (command === null) {
      // Possibly an implicit command. Not allowed if this is the first command.
      if (prevCommand === null) return null

      // Check for remaining coordinates in the current command.
      if ((char === '+' || char === '-' || char === '.' || (char >= '0' && char <= '9')) && prevCommand !== 'Z') {
        if (prevCommand === 'M') command = 'L'
        else if (prevCommand === 'm') command = 'l'
        else {
          // @ts-expect-error hmmm TODO: work this out
          command = prevCommand
        }
      } else {
        command = null
      }

      if (command === null) return null
    } else {
      currentIndex += 1
    }

    prevCommand = command

    let values: number[] | null = null
    const cmd = command.toUpperCase() as Uppercase<Command>

    if (cmd === 'H' || cmd === 'V') {
      values = [parseNumber()]
    } else if (cmd === 'M' || cmd === 'L' || cmd === 'T') {
      values = [parseNumber(), parseNumber()]
    } else if (cmd === 'S' || cmd === 'Q') {
      values = [parseNumber(), parseNumber(), parseNumber(), parseNumber()]
    } else if (cmd === 'C') {
      values = [parseNumber(), parseNumber(), parseNumber(), parseNumber(), parseNumber(), parseNumber()]
    } else if (cmd === 'A') {
      values = [
        parseNumber(),
        parseNumber(),
        parseNumber(),
        parseArcFlag(),
        parseArcFlag(),
        parseNumber(),
        parseNumber(),
      ]
    } else if (cmd === 'Z') {
      skipOptionalSpaces()
      values = []
    }

    if (values === null || values.indexOf(null) >= 0) {
      // Unknown command or known command with invalid values
      return null
    } else {
      return { type: command, values: values }
    }
  }

  function hasMoreData() {
    return currentIndex < endIndex
  }

  function peekSegmentType(): Command | null {
    const char = string[currentIndex]
    return char in commandsMap ? commandsMap[char as Command] : null
  }

  function initialCommandIsMoveTo() {
    // If the path is empty it is still valid, so return true.
    if (!hasMoreData()) return true

    const command = peekSegmentType()
    // Path must start with moveTo.
    return command === 'M' || command === 'm'
  }

  function isCurrentSpace() {
    const char = string[currentIndex]
    return char <= ' ' && (char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f')
  }

  function skipOptionalSpaces() {
    while (currentIndex < endIndex && isCurrentSpace()) {
      currentIndex += 1
    }

    return currentIndex < endIndex
  }

  function skipOptionalSpacesOrDelimiter() {
    if (currentIndex < endIndex && !isCurrentSpace() && string[currentIndex] !== ',') {
      return false
    }

    if (skipOptionalSpaces()) {
      if (currentIndex < endIndex && string[currentIndex] === ',') {
        currentIndex += 1
        skipOptionalSpaces()
      }
    }
    return currentIndex < endIndex
  }

  // Parse a number from an SVG path. This very closely follows genericParseNumber(...) from
  // Source/core/svg/SVGParserUtilities.cpp.
  // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-PathDataBNF
  function parseNumber() {
    let exponent = 0
    let integer = 0
    let frac = 1
    let decimal = 0
    let sign = 1
    let expsign = 1
    const startIndex = currentIndex

    skipOptionalSpaces()

    // Read the sign.
    if (currentIndex < endIndex && string[currentIndex] === '+') {
      currentIndex += 1
    } else if (currentIndex < endIndex && string[currentIndex] === '-') {
      currentIndex += 1
      sign = -1
    }

    if (
      currentIndex === endIndex ||
      ((string[currentIndex] < '0' || string[currentIndex] > '9') && string[currentIndex] !== '.')
    ) {
      // The first character of a number must be one of [0-9+-.].
      return null
    }

    // Read the integer part, build right-to-left.
    const startIntPartIndex = currentIndex

    while (currentIndex < endIndex && string[currentIndex] >= '0' && string[currentIndex] <= '9') {
      currentIndex += 1 // Advance to first non-digit.
    }

    if (currentIndex !== startIntPartIndex) {
      let scanIntPartIndex = currentIndex - 1
      let multiplier = 1

      while (scanIntPartIndex >= startIntPartIndex) {
        // @ts-expect-error js quirk
        integer += multiplier * (string[scanIntPartIndex] - '0')
        scanIntPartIndex -= 1
        multiplier *= 10
      }
    }

    // Read the decimals.
    if (currentIndex < endIndex && string[currentIndex] === '.') {
      currentIndex += 1

      // There must be a least one digit following the .
      if (currentIndex >= endIndex || string[currentIndex] < '0' || string[currentIndex] > '9') {
        return null
      }

      while (currentIndex < endIndex && string[currentIndex] >= '0' && string[currentIndex] <= '9') {
        frac *= 10
        // @ts-expect-error js quirk
        decimal += (string.charAt(currentIndex) - '0') / frac
        currentIndex += 1
      }
    }

    // Read the exponent part.
    if (
      currentIndex !== startIndex &&
      currentIndex + 1 < endIndex &&
      (string[currentIndex] === 'e' || string[currentIndex] === 'E') &&
      string[currentIndex + 1] !== 'x' &&
      string[currentIndex + 1] !== 'm'
    ) {
      currentIndex += 1

      // Read the sign of the exponent.
      if (string[currentIndex] === '+') {
        currentIndex += 1
      } else if (string[currentIndex] === '-') {
        currentIndex += 1
        expsign = -1
      }

      // There must be an exponent.
      if (currentIndex >= endIndex || string[currentIndex] < '0' || string[currentIndex] > '9') {
        return null
      }

      while (currentIndex < endIndex && string[currentIndex] >= '0' && string[currentIndex] <= '9') {
        exponent *= 10
        // @ts-expect-error js quirk
        exponent += string[currentIndex] - '0'
        currentIndex += 1
      }
    }

    let number = integer + decimal
    number *= sign

    if (exponent) {
      number *= Math.pow(10, expsign * exponent)
    }

    if (startIndex === currentIndex) {
      return null
    }

    skipOptionalSpacesOrDelimiter()

    return number
  }

  function parseArcFlag() {
    if (currentIndex >= endIndex) return null

    let flag = null
    const flagChar = string[currentIndex]

    currentIndex += 1

    if (flagChar === '0') flag = 0
    else if (flagChar === '1') flag = 1
    else return null

    skipOptionalSpacesOrDelimiter()
    return flag
  }

  if (initialCommandIsMoveTo()) {
    while (hasMoreData()) {
      const pathSeg = parseSegment()
      if (pathSeg === null) break
      pathData.push(pathSeg)
    }
  }

  if (normalize) {
    const absolutized = absolutize(pathData)
    return reduce(absolutized)
  } else {
    return pathData
  }
}

export const absolutize = (pathData: SvgPathSegment[]) => {
  const absolutizedPathData: SvgPathSegment[] = []

  let currentX = 0
  let currentY = 0

  let subpathX = null
  let subpathY = null

  for (const { type, values } of pathData) {
    switch (type) {
      case 'M': {
        const [x, y] = values

        absolutizedPathData.push({ type: 'M', values: [x, y] })

        subpathX = x
        subpathY = y

        currentX = x
        currentY = y

        break
      }

      case 'm': {
        const x = currentX + values[0]
        const y = currentY + values[1]

        absolutizedPathData.push({ type: 'M', values: [x, y] })

        subpathX = x
        subpathY = y

        currentX = x
        currentY = y
        break
      }

      case 'L': {
        const x = values[0]
        const y = values[1]

        absolutizedPathData.push({ type: 'L', values: [x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'l': {
        const x = currentX + values[0]
        const y = currentY + values[1]

        absolutizedPathData.push({ type: 'L', values: [x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'C': {
        const x1 = values[0]
        const y1 = values[1]
        const x2 = values[2]
        const y2 = values[3]
        const x = values[4]
        const y = values[5]

        absolutizedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'c': {
        const x1 = currentX + values[0]
        const y1 = currentY + values[1]
        const x2 = currentX + values[2]
        const y2 = currentY + values[3]
        const x = currentX + values[4]
        const y = currentY + values[5]

        absolutizedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'Q': {
        const x1 = values[0]
        const y1 = values[1]
        const x = values[2]
        const y = values[3]

        absolutizedPathData.push({ type: 'Q', values: [x1, y1, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'q': {
        const x1 = currentX + values[0]
        const y1 = currentY + values[1]
        const x = currentX + values[2]
        const y = currentY + values[3]

        absolutizedPathData.push({ type: 'Q', values: [x1, y1, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'A': {
        const x = values[5]
        const y = values[6]

        absolutizedPathData.push({
          type: 'A',
          values: [values[0], values[1], values[2], values[3], values[4], x, y],
        })

        currentX = x
        currentY = y
        break
      }

      case 'a': {
        const x = currentX + values[5]
        const y = currentY + values[6]

        absolutizedPathData.push({
          type: 'A',
          values: [values[0], values[1], values[2], values[3], values[4], x, y],
        })

        currentX = x
        currentY = y
        break
      }

      case 'H': {
        const x = values[0]
        absolutizedPathData.push({ type: 'H', values: [x] })
        currentX = x
        break
      }

      case 'h': {
        const x = currentX + values[0]
        absolutizedPathData.push({ type: 'H', values: [x] })
        currentX = x
        break
      }

      case 'V': {
        const y = values[0]
        absolutizedPathData.push({ type: 'V', values: [y] })
        currentY = y
        break
      }

      case 'v': {
        const y = currentY + values[0]
        absolutizedPathData.push({ type: 'V', values: [y] })
        currentY = y
        break
      }

      case 'S': {
        const x2 = values[0]
        const y2 = values[1]
        const x = values[2]
        const y = values[3]

        absolutizedPathData.push({ type: 'S', values: [x2, y2, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 's': {
        const x2 = currentX + values[0]
        const y2 = currentY + values[1]
        const x = currentX + values[2]
        const y = currentY + values[3]

        absolutizedPathData.push({ type: 'S', values: [x2, y2, x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'T': {
        const x = values[0]
        const y = values[1]

        absolutizedPathData.push({ type: 'T', values: [x, y] })

        currentX = x
        currentY = y
        break
      }

      case 't': {
        const x = currentX + values[0]
        const y = currentY + values[1]

        absolutizedPathData.push({ type: 'T', values: [x, y] })

        currentX = x
        currentY = y
      }

      case 'Z':
      case 'z': {
        absolutizedPathData.push({ type: 'Z', values: [] })

        currentX = subpathX
        currentY = subpathY
      }
    }
  }
  return absolutizedPathData
}

export const reduce = (pathData: SvgPathSegment[]): SimplifiedSvgPathSegment[] => {
  const reducedPathData: SimplifiedSvgPathSegment[] = []
  let lastType: Command

  let lastControlX: number
  let lastControlY: number

  let currentX: number
  let currentY: number

  let subpathX = null
  let subpathY = null

  for (const { type, values } of pathData) {
    switch (type) {
      case 'M': {
        const x = values[0]
        const y = values[1]

        reducedPathData.push({ type: 'M', values: [x, y] })

        subpathX = x
        subpathY = y

        currentX = x
        currentY = y
        break
      }

      case 'C': {
        const x1 = values[0]
        const y1 = values[1]
        const x2 = values[2]
        const y2 = values[3]
        const x = values[4]
        const y = values[5]

        reducedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

        lastControlX = x2
        lastControlY = y2

        currentX = x
        currentY = y
        break
      }

      case 'L': {
        const x = values[0]
        const y = values[1]

        reducedPathData.push({ type: 'L', values: [x, y] })

        currentX = x
        currentY = y
        break
      }

      case 'H': {
        const x = values[0]

        reducedPathData.push({ type: 'L', values: [x, currentY] })

        currentX = x
        break
      }

      case 'V': {
        const y = values[0]

        reducedPathData.push({ type: 'L', values: [currentX, y] })

        currentY = y
        break
      }

      case 'S': {
        const x2 = values[0]
        const y2 = values[1]
        const x = values[2]
        const y = values[3]

        let cx1: number, cy1: number

        if (lastType === 'C' || lastType === 'S') {
          cx1 = currentX + (currentX - lastControlX)
          cy1 = currentY + (currentY - lastControlY)
        } else {
          cx1 = currentX
          cy1 = currentY
        }

        reducedPathData.push({ type: 'C', values: [cx1, cy1, x2, y2, x, y] })

        lastControlX = x2
        lastControlY = y2

        currentX = x
        currentY = y
        break
      }

      case 'T': {
        const [x, y] = values
        let x1: number, y1: number

        if (lastType === 'Q' || lastType === 'T') {
          x1 = currentX + (currentX - lastControlX)
          y1 = currentY + (currentY - lastControlY)
        } else {
          x1 = currentX
          y1 = currentY
        }

        const cx1 = currentX + (2 * (x1 - currentX)) / 3
        const cy1 = currentY + (2 * (y1 - currentY)) / 3
        const cx2 = x + (2 * (x1 - x)) / 3
        const cy2 = y + (2 * (y1 - y)) / 3

        reducedPathData.push({ type: 'C', values: [cx1, cy1, cx2, cy2, x, y] })

        lastControlX = x1
        lastControlY = y1

        currentX = x
        currentY = y
        break
      }

      case 'Q': {
        const [x1, y1, x, y] = values
        const cx1 = currentX + (2 * (x1 - currentX)) / 3
        const cy1 = currentY + (2 * (y1 - currentY)) / 3
        const cx2 = x + (2 * (x1 - x)) / 3
        const cy2 = y + (2 * (y1 - y)) / 3

        reducedPathData.push({ type: 'C', values: [cx1, cy1, cx2, cy2, x, y] })

        lastControlX = x1
        lastControlY = y1

        currentX = x
        currentY = y
        break
      }

      case 'A': {
        const r1 = Math.abs(values[0])
        const r2 = Math.abs(values[1])
        const [, , angle, largeArcFlag, sweepFlag, x, y] = values

        if (r1 === 0 || r2 === 0) {
          reducedPathData.push({ type: 'C', values: [currentX, currentY, x, y, x, y] })

          currentX = x
          currentY = y
        } else {
          if (currentX !== x || currentY !== y) {
            const curves = arcToCubicCurves(currentX, currentY, x, y, r1, r2, angle, largeArcFlag, sweepFlag)
            for (const curve of curves) reducedPathData.push({ type: 'C', values: curve })

            currentX = x
            currentY = y
          }
        }
        break
      }

      case 'Z': {
        reducedPathData.push({ type, values })

        currentX = subpathX
        currentY = subpathY
        break
      }
    }

    lastType = type
  }
  return reducedPathData
}

const degToRad = (degrees: number) => (Math.PI * degrees) / 180
const rotate = (x: number, y: number, angleRad: number) => {
  const X = x * Math.cos(angleRad) - y * Math.sin(angleRad)
  const Y = x * Math.sin(angleRad) + y * Math.cos(angleRad)
  return { x: X, y: Y }
}
function arcToCubicCurves(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  angle: number,
  largeArcFlag: number,
  sweepFlag: number
): Curve[]
function arcToCubicCurves(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  angle: number,
  largeArcFlag: number,
  sweepFlag: number,
  _recursive: [f1: number, f2: number, cx: number, cy: number]
): Vec2[]
function arcToCubicCurves(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  angle: number,
  largeArcFlag: number,
  sweepFlag: number,
  _recursive?: [f1: number, f2: number, cx: number, cy: number]
) {
  const angleRad = degToRad(angle)
  let params: Vec2[] = []
  let f1: number, f2: number, cx: number, cy: number

  if (_recursive) {
    ;[f1, f2, cx, cy] = _recursive
  } else {
    const p1 = rotate(x1, y1, -angleRad)
    x1 = p1.x
    y1 = p1.y

    const p2 = rotate(x2, y2, -angleRad)
    x2 = p2.x
    y2 = p2.y

    const x = (x1 - x2) / 2
    const y = (y1 - y2) / 2
    let h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2)

    if (h > 1) {
      h = Math.sqrt(h)
      r1 = h * r1
      r2 = h * r2
    }

    const sign: -1 | 1 = largeArcFlag === sweepFlag ? -1 : 1

    const r1Pow = r1 * r1
    const r2Pow = r2 * r2

    const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x
    const right = r1Pow * y * y + r2Pow * x * x

    const k = sign * Math.sqrt(Math.abs(left / right))

    cx = (k * r1 * y) / r2 + (x1 + x2) / 2
    cy = (k * -r2 * x) / r1 + (y1 + y2) / 2

    f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)))
    f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)))

    if (x1 < cx) f1 = Math.PI - f1
    if (x2 < cx) f2 = Math.PI - f2

    if (f1 < 0) f1 = Math.PI * 2 + f1
    if (f2 < 0) f2 = Math.PI * 2 + f2

    if (sweepFlag && f1 > f2) f1 = f1 - Math.PI * 2
    if (!sweepFlag && f2 > f1) f2 = f2 - Math.PI * 2
  }

  let df = f2 - f1

  if (Math.abs(df) > (Math.PI * 120) / 180) {
    const f2old = f2
    const x2old = x2
    const y2old = y2

    if (sweepFlag && f2 > f1) f2 = f1 + ((Math.PI * 120) / 180) * 1
    else f2 = f1 + ((Math.PI * 120) / 180) * -1

    x2 = cx + r1 * Math.cos(f2)
    y2 = cy + r2 * Math.sin(f2)
    params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy])
  }

  df = f2 - f1

  const c1 = Math.cos(f1)
  const s1 = Math.sin(f1)
  const c2 = Math.cos(f2)
  const s2 = Math.sin(f2)
  const t = Math.tan(df / 4)
  const hx = (4 / 3) * r1 * t
  const hy = (4 / 3) * r2 * t

  const m1: Vec2 = [x1, y1]
  const m2: Vec2 = [x1 + hx * s1, y1 - hy * c1]
  const m3: Vec2 = [x2 + hx * s2, y2 - hy * c2]
  const m4: Vec2 = [x2, y2]

  m2[0] = 2 * m1[0] - m2[0]
  m2[1] = 2 * m1[1] - m2[1]

  if (_recursive) {
    return [m2, m3, m4].concat(params)
  } else {
    params = [m2, m3, m4].concat(params)

    const curves: Curve[] = []

    for (let i = 0; i < params.length; i += 3) {
      const r1 = rotate(params[i][0], params[i][1], angleRad)
      const r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad)
      const r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad)
      curves.push([r1.x, r1.y, r2.x, r2.y, r3.x, r3.y])
    }

    return curves
  }
}
