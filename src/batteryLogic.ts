export const BATTERY_CAPACITY = 100
export const FLASHLIGHT_DRAIN = .2
export const RADAR_DRAIN = .35

export function devicePower(charge: number, flashlight: boolean, radar: boolean, interrupted = false) {
  const available = charge > 0 && !interrupted
  return { flashlight: available && flashlight, radar: available && radar }
}
export function drainBattery(charge: number, seconds: number, flashlight: boolean, radar: boolean) {
  const rate = (flashlight ? FLASHLIGHT_DRAIN : 0) + (radar ? RADAR_DRAIN : 0)
  return Math.max(0, Math.min(BATTERY_CAPACITY, charge) - Math.max(0, seconds) * rate)
}
