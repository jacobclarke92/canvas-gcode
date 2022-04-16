export default class Point {
  public x: number
  public y: number
  public z: number
  public a: number
  constructor(x: number = 0, y: number = 0, z?: number, a?: number) {
    this.x = isNaN(x) ? 0 : x
    this.y = isNaN(y) ? 0 : y
    this.z = isNaN(z) ? 0 : z
    this.a = isNaN(a) ? 0 : a
  }
  static distance(point1: Point, point2: Point) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
  }
  clone() {
    return new Point(this.x, this.y)
  }
  round() {
    return new Point(Math.round(this.x), Math.round(this.y))
  }
  equals(point: Point) {
    return this.x === point.x && this.y === point.y
  }
  add(point: Point) {
    return new Point(this.x + point.x, this.y + point.y)
  }
  midpoint(point: Point) {
    return new Point((this.x + point.x) / 2, (this.y + point.y) / 2)
  }
  subtract(point: Point) {
    return new Point(this.x - point.x, this.y - point.y)
  }
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }
  multiply(point: Point | number) {
    return typeof point === 'number'
      ? new Point(this.x * point, this.y * point)
      : new Point(this.x * point.x, this.y * point.y)
  }
  scale(scale: number) {
    return this.multiply(scale)
  }
  divide(point: Point) {
    return new Point(this.x / point.x, this.y / point.y)
  }
  normalize() {
    return this.multiply(1 / this.magnitude())
  }
  set(x: number, y: number) {
    this.x = x
    this.y = y
  }
  dot(point: Point): number {
    return this.x * point.x + this.y * point.y
  }
  translate(x: number, y: number) {
    return new Point(this.x + x, this.y + y)
  }
  moveAlongAngle(angle: number, distance: number) {
    return this.translate(Math.cos(angle) * distance, Math.sin(angle) * distance)
  }
  rotate(angle: number) {
    const x = this.x * Math.cos(angle) - this.y * Math.sin(angle)
    const y = this.x * Math.sin(angle) + this.y * Math.cos(angle)
    return new Point(x, y)
  }
  angleTo(point: Point) {
    return Math.atan2(point.y - this.y, point.x - this.x)
  }
  distanceTo(point: Point) {
    return Math.sqrt(Math.pow(point.x - this.x, 2) + Math.pow(point.y - this.y, 2))
  }
  angleBetween(point: Point) {
    return Math.acos(this.dot(point) / (this.magnitude() * point.magnitude()))
  }
  toUnit() {
    return this.multiply(1 / this.magnitude())
  }
}
