import Point from './Point'

export default class Matrix {
  public a: number
  public b: number
  public c: number
  public d: number
  public tx: number
  public ty: number

  constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.tx = tx
    this.ty = ty
  }

  static translation(tx: number, ty: number) {
    return new Matrix(1, 0, 0, 1, tx, ty)
  }

  static scale(sx: number, sy?: number, aboutPoint?: Point) {
    if (sy === undefined) sy = sx
    let scaleMatrix = new Matrix(sx, 0, 0, sy)
    if (aboutPoint) {
      scaleMatrix = Matrix.translation(aboutPoint.x, aboutPoint.y)
        .concat(scaleMatrix)
        .concat(Matrix.translation(-aboutPoint.x, -aboutPoint.y))
    }
    return scaleMatrix
  }

  static rotation(theta: number, aboutPoint?: Point) {
    let rotationMatrix = new Matrix(Math.cos(theta), Math.sin(theta), -Math.sin(theta), Math.cos(theta))
    if (aboutPoint) {
      rotationMatrix = Matrix.translation(aboutPoint.x, aboutPoint.y)
        .concat(rotationMatrix)
        .concat(Matrix.translation(-aboutPoint.x, -aboutPoint.y))
    }
    return rotationMatrix
  }

  clone() {
    return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty)
  }
  concat(matrix: Matrix) {
    return new Matrix(
      this.a * matrix.a + this.c * matrix.b,
      this.b * matrix.a + this.d * matrix.b,
      this.a * matrix.c + this.c * matrix.d,
      this.b * matrix.c + this.d * matrix.d,
      this.a * matrix.tx + this.c * matrix.ty + this.tx,
      this.b * matrix.tx + this.d * matrix.ty + this.ty
    )
  }

  /**
   * Given a point in the pre-transform coordinate space, returns the coordinates of
   * that point after the transformation occurs. Unlike the standard transformation
   * applied using the transform new Point() method, the deltaTransformnew Point() method's
   * transformation does not consider the translation parameters tx and ty.
   */
  deltaTransformPoint(point: Point) {
    return new Point(this.a * point.x + this.c * point.y, this.b * point.x + this.d * point.y)
  }
  inverse() {
    const determinant = this.a * this.d - this.b * this.c
    return new Matrix(
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.ty - this.d * this.tx) / determinant,
      (this.b * this.tx - this.a * this.ty) / determinant
    )
  }
  rotate(theta: number, aboutPoint?: Point) {
    return this.concat(Matrix.rotation(theta, aboutPoint))
  }
  scale(sx: number, sy?: number, aboutPoint?: Point) {
    return this.concat(Matrix.scale(sx, sy, aboutPoint))
  }
  translate(tx: number, ty: number) {
    return this.concat(Matrix.translation(tx, ty))
  }
  transformPoint(point: Point) {
    return new Point(this.a * point.x + this.c * point.y + this.tx, this.b * point.x + this.d * point.y + this.ty)
  }
}
