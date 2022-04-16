export const loadValue = <T extends any>(key: string, fallbackSetValue?: T): T | null => {
  const encodedValue = localStorage.getItem(key)
  if (encodedValue === null) {
    if (fallbackSetValue !== undefined) {
      saveValue(key, fallbackSetValue)
      return fallbackSetValue
    } else return null
  }
  return JSON.parse(encodedValue)
}
export const saveValue = <T extends any>(key: string, value: T): T => {
  const encodedValue = JSON.stringify(value)
  localStorage.setItem(key, encodedValue)
  return value
}
