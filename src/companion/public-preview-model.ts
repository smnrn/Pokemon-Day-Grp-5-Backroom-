import { regression, SPECIMENS } from "./analytics.ts"

export function publicBatteryScenario(flashlight: boolean, sprint: boolean) {
  const drain = 0.08 + (flashlight ? 0.12 : 0) + (sprint ? 0.08 : 0)
  const blackout = 100 / drain
  const points = Array.from({ length: 9 }, (_, index) => {
    const x = (blackout * index) / 8
    return { x, y: Math.max(0, 100 - drain * x) }
  })
  return { drain, blackout, points, fit: regression(points) }
}

export function referenceCluster(
  emf: number,
  temperature: number,
  audio: number,
) {
  const vector = [
    emf / 100,
    Math.max(0, Math.min(1, (40 - temperature) / 60)),
    audio / 100,
  ]
  const distances = SPECIMENS.slice(0, 3).map((specimen) =>
    Math.hypot(...vector.map((value, index) => value - specimen.vector[index])),
  )
  const index = distances.reduce(
    (best, value, current) => (value < distances[best] ? current : best),
    0,
  )
  return { vector, distances, index, distance: distances[index] }
}
