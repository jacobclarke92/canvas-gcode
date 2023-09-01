export enum ClipType {
  intersection = 0,
  union = 1,
  difference = 2,
  xor = 3,
}
export enum PolyType {
  subject = 0,
  clip = 1,
}
export enum PolyFillType {
  evenOdd = 0,
  nonZero = 1,
  positive = 2,
  negative = 3,
}
export enum JoinType {
  square = 0,
  round = 1,
  miter = 2,
}
export enum EndType {
  openSquare = 0,
  openRound = 1,
  openButt = 2,
  closedLine = 3,
  closedPolygon = 4,
}
export enum EdgeSide {
  left = 0,
  right = 1,
}
export enum Direction {
  rightToLeft = 0,
  leftToRight = 1,
}
export enum NodeType {
  any = 0,
  open = 1,
  closed = 2,
}
