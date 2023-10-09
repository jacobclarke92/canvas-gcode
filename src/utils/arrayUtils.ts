import { random } from './random'

export const shuffle = <T>(array: T[]) =>
  array
    .map((value) => ({ value, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
