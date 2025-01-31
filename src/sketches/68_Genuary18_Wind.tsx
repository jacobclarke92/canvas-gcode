import FFT from 'fft.js'

import { Sketch } from '../Sketch'

class FluidSolver {
  public n: number
  public fft: FFT
  public u: Float32Array
  public v: Float32Array
  public u0: Float32Array
  public v0: Float32Array

  constructor(n: number) {
    this.n = n
    this.fft = new FFT(n) // Initialize FFT with size `n`
    this.u = new Float32Array(n * n)
    this.v = new Float32Array(n * n)
    this.u0 = new Float32Array((n + 2) * n)
    this.v0 = new Float32Array((n + 2) * n)
  }

  private FFT(s: number, data: Float32Array): void {
    const complexArray = this.fft.createComplexArray() // Create a complex array
    const outputArray = this.fft.createComplexArray() // Create an output array
    this.fft.toComplexArray(data, complexArray) // Convert real data to complex array

    if (s === 1) {
      this.fft.transform(outputArray, complexArray) // Forward FFT
    } else {
      this.fft.inverseTransform(outputArray, complexArray) // Inverse FFT
    }

    this.fft.fromComplexArray(complexArray, data) // Convert back to real data
  }

  public stableSolve(visc: number, dt: number): void {
    const n = this.n
    let x, y, f, r, U0, U1, V0, V1, s, t
    let i, j, i0, j0, i1, j1

    // Add forces and update velocities
    for (i = 0; i < n * n; i++) {
      this.u[i] += dt * this.u0[i]
      this.u0[i] = this.u[i]
      this.v[i] += dt * this.v0[i]
      this.v0[i] = this.v[i]
    }

    // Advect velocities
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        x = i - dt * this.u0[i + n * j] * n
        y = j - dt * this.v0[i + n * j] * n
        i0 = Math.floor(x)
        s = x - i0
        i0 = (n + (i0 % n)) % n
        i1 = (i0 + 1) % n
        j0 = Math.floor(y)
        t = y - j0
        j0 = (n + (j0 % n)) % n
        j1 = (j0 + 1) % n
        this.u[i + n * j] =
          (1 - s) * ((1 - t) * this.u0[i0 + n * j0] + t * this.u0[i0 + n * j1]) +
          s * ((1 - t) * this.u0[i1 + n * j0] + t * this.u0[i1 + n * j1])
        this.v[i + n * j] =
          (1 - s) * ((1 - t) * this.v0[i0 + n * j0] + t * this.v0[i0 + n * j1]) +
          s * ((1 - t) * this.v0[i1 + n * j0] + t * this.v0[i1 + n * j1])
      }
    }

    // Copy velocities to extended arrays for FFT
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        this.u0[i + (n + 2) * j] = this.u[i + n * j]
        this.v0[i + (n + 2) * j] = this.v[i + n * j]
      }
    }

    // Perform FFT
    this.FFT(1, this.u0)
    this.FFT(1, this.v0)

    // Apply viscosity in frequency domain
    for (i = 0; i <= n; i += 2) {
      x = 0.5 * i
      for (j = 0; j < n; j++) {
        y = j <= n / 2 ? j : j - n
        r = x * x + y * y
        if (r === 0.0) continue
        f = Math.exp(-r * dt * visc)
        U0 = this.u0[i + (n + 2) * j]
        V0 = this.v0[i + (n + 2) * j]
        U1 = this.u0[i + 1 + (n + 2) * j]
        V1 = this.v0[i + 1 + (n + 2) * j]
        this.u0[i + (n + 2) * j] = f * ((1 - (x * x) / r) * U0 - ((x * y) / r) * V0)
        this.u0[i + 1 + (n + 2) * j] = f * ((1 - (x * x) / r) * U1 - ((x * y) / r) * V1)
        this.v0[i + (n + 2) * j] = f * (((-y * x) / r) * U0 + (1 - (y * y) / r) * V0)
        this.v0[i + 1 + (n + 2) * j] = f * (((-y * x) / r) * U1 + (1 - (y * y) / r) * V1)
      }
    }

    // Perform inverse FFT
    this.FFT(-1, this.u0)
    this.FFT(-1, this.v0)

    // Normalize and update velocities
    f = 1.0 / (n * n)
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        this.u[i + n * j] = f * this.u0[i + (n + 2) * j]
        this.v[i + n * j] = f * this.v0[i + (n + 2) * j]
      }
    }
  }

  public render(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const n = this.n
    const imageData = ctx.createImageData(n, n)

    let maxValue = 0

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const index = (i + j * n) * 4
        const value = Math.sqrt(
          this.u[i + n * j] * this.u[i + n * j] + this.v[i + n * j] * this.v[i + n * j]
        )
        if (value > maxValue) maxValue = value
        // if (i === 10 && j === 10) console.log(value)
        const color = Math.floor(255 * value)
        imageData.data[index] = color
        imageData.data[index + 1] = color
        imageData.data[index + 2] = color
        imageData.data[index + 3] = 255
      }
    }
    // console.log(maxValue)

    ctx.putImageData(imageData, 0, 0)
  }
}

export default class Genuary18_Wind extends Sketch {
  static disableOverclock = true

  init() {
    this.addVar('sizeSqrt', { initialValue: 7, min: 3, max: 12, step: 1 })
    this.addVar('timeStep', { initialValue: 0.01, min: 0.01, max: 1, step: 0.01 })
    this.addVar('viscosity', { initialValue: 0.1, min: 0.01, max: 1, step: 0.01 })
  }

  solver: FluidSolver

  initDraw(): void {
    const { sizeSqrt } = this.vars

    const size = Math.pow(2, sizeSqrt)
    this.solver = new FluidSolver(size)

    // Add initial forces
    for (let i = 0; i < size * size; i++) {
      this.solver.u[i] = (Math.random() - 0.5) * 10 // Random noise in u
      this.solver.v[i] = (Math.random() - 0.5) * 10 // Random noise in v
    }
  }

  addForce(solver: FluidSolver, x: number, y: number, force: number) {
    const n = solver.n
    const index = Math.floor(x) + Math.floor(y) * n
    solver.u[index] += force * (Math.random() - 0.5)
    solver.v[index] += force * (Math.random() - 0.5)
  }

  draw(increment: number): void {
    //
    const { sizeSqrt, timeStep, viscosity } = this.vars

    const size = Math.pow(2, sizeSqrt)

    this.addForce(
      this.solver,
      Math.round(Math.cos(increment / 100) * (size - 20)) + 10,
      Math.round(size / 2),
      12
    )

    this.solver.stableSolve(viscosity, timeStep)
    this.solver.render(this.ctx.canvasElement)
  }
}
