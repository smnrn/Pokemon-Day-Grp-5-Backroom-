import type { LearningMoment, LearningRun } from "./education-model"

// Read-only local observations; these never alter mechanics or enter cloud telemetry.
export function createLocalRunRecorder(id: string) {
  let observed = 0,
    sprintSeconds = 0,
    lastSample = -1,
    previousBattery = 100
  const battery = [{ x: 0, y: 100 }]
  const timeline: LearningMoment[] = [
    {
      elapsed: 0,
      label: "RUN START",
      evidence: "Local game observation · battery initialized at 100%.",
    },
  ]
  const record = (moment: LearningMoment) => {
    if (timeline.length < 50) timeline.push(moment)
  }
  return {
    record,
    tick(elapsed: number, charge: number, sprinting: boolean, dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return
      observed += dt
      if (sprinting) sprintSeconds += dt
      if (elapsed - lastSample >= 1) {
        battery.push({ x: elapsed, y: charge })
        lastSample = elapsed
      }
      if (previousBattery > 20 && charge <= 20)
        record({
          elapsed,
          label: "LOW BATTERY",
          evidence: `Observed charge ${charge.toFixed(1)}%. Resource pressure is a condition, not a proven cause of capture.`,
        })
      if (previousBattery > 0 && charge <= 0)
        record({
          elapsed,
          label: "BATTERY EXHAUSTED",
          evidence: "Shared flashlight/radar charge reached zero.",
        })
      previousBattery = charge
    },
    finish(
      elapsed: number,
      charge: number,
      outcome: "caught" | "escaped",
    ): LearningRun {
      const last = battery[battery.length - 1]
      const samples =
        last.x === elapsed
          ? [...battery.slice(0, -1), { x: elapsed, y: charge }]
          : [...battery, { x: elapsed, y: charge }]
      return {
        id,
        source: "local game / in-memory observations",
        outcome: outcome === "caught" ? "eliminated" : "escaped",
        duration: elapsed,
        sprint: observed ? Math.min(1, sprintSeconds / observed) : null,
        crouch: null,
        battery: samples,
        timeline: [
          ...timeline,
          {
            elapsed,
            label:
              outcome === "caught" ? "CAPTURE CONFIRMED" : "ESCAPE CONFIRMED",
            evidence: `Local outcome · ${charge.toFixed(1)}% battery remaining.`,
          },
        ],
        diagnostic:
          outcome === "caught"
            ? "Pursuer contact is the confirmed ending condition. Review preceding rescue/resource observations as candidate contributors, not proof of a single cause. This recorder receives no EMF, temperature, or decibel telemetry."
            : "The exit interaction confirms an escape. Compare progress and battery trends for your next trial; one success cannot establish which choice caused survival.",
      }
    },
  }
}
