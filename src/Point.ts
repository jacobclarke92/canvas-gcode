import { ClipperLib } from './packages/Clipper'
import { IntPoint } from './packages/Clipper/IntPoint'

export default class Point extends IntPoint {
  // public x: number
  // public y: number
  // public z: number
  public a: number
  constructor(x = 0, y = 0, z = 0, a?: number) {
    super(...(ClipperLib.USE_XYZ ? [x, y, z] : [x, y]))
    this.a = isNaN(a) ? 0 : a
  }
  public static distance(point1: Point, point2: Point) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
  }
  public static angleBetween(point1: Point, point2: Point) {
    // return Math.acos(point1.dot(point2) / (point1.magnitude() * point2.magnitude()))
    return Math.atan2(point2.y - point1.y, point2.x - point1.x)
  }
  public clone() {
    return new Point(this.x, this.y)
  }
  public round() {
    return new Point(Math.round(this.x), Math.round(this.y))
  }
  public equals(point: Point) {
    return this.x === point.x && this.y === point.y
  }
  public add(point: Point) {
    return new Point(this.x + point.x, this.y + point.y)
  }
  public midpoint(point: Point) {
    return new Point((this.x + point.x) / 2, (this.y + point.y) / 2)
  }
  public subtract(point: Point) {
    return new Point(this.x - point.x, this.y - point.y)
  }
  public magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }
  public angle() {
    return Math.atan2(this.y, this.x)
  }
  public multiply(point: Point | number) {
    return typeof point === 'number'
      ? new Point(this.x * point, this.y * point)
      : new Point(this.x * point.x, this.y * point.y)
  }
  public scale(scale: number) {
    return this.multiply(scale)
  }
  public divide(point: Point | number) {
    return typeof point === 'number'
      ? new Point(this.x / point, this.y / point)
      : new Point(this.x / point.x, this.y / point.y)
  }
  public normalize() {
    return this.multiply(1 / this.magnitude())
  }
  public set(x: number, y: number) {
    this.x = x
    this.y = y
  }
  public dot(point: Point): number {
    return this.x * point.x + this.y * point.y
  }
  public cross(point: Point): number {
    return this.x * point.y - this.y * point.x
  }
  public translate(x: number, y: number) {
    return new Point(this.x + x, this.y + y)
  }
  public moveAlongAngle(angle: number, distance: number) {
    return this.translate(Math.cos(angle) * distance, Math.sin(angle) * distance)
  }
  public moveTowards(point: Point, distance: number) {
    const angle = this.angleTo(point)
    return this.moveAlongAngle(angle, distance)
  }
  public rotate(angle: number) {
    const x = this.x * Math.cos(angle) - this.y * Math.sin(angle)
    const y = this.x * Math.sin(angle) + this.y * Math.cos(angle)
    return new Point(x, y)
  }
  public angleTo(point: Point) {
    return Math.atan2(point.y - this.y, point.x - this.x)
  }
  public distanceTo(point: Point) {
    return Math.sqrt(Math.pow(point.x - this.x, 2) + Math.pow(point.y - this.y, 2))
  }
  public angleBetween(point: Point) {
    return Math.acos(this.dot(point) / (this.magnitude() * point.magnitude()))
  }
  public toUnit() {
    return this.multiply(1 / this.magnitude())
  }
  public toArray(): [x: number, y: number] {
    return [this.x, this.y]
  }
}
