export const panicker = (amt = 10000) => {
  let i = amt
  return () => {
    if (i-- < 0) {
      debugger
      return true
    }
    return false
  }
}
