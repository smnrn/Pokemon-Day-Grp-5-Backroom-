import { clamp, kmeans, mean, regression, type Session } from "./analytics.ts"

export const PILLARS = {
  descriptive: {
    number: "01",
    name: "DESCRIPTIVE",
    question: "WHAT IS HAPPENING?",
    explanation:
      "Aggregates raw (X, Y) coordinates, sensor logs, and session records into visual summaries. A summary describes the selected data source; it does not establish a cause.",
  },
  diagnostic: {
    number: "02",
    name: "DIAGNOSTIC",
    question: "WHY IS IT HAPPENING?",
    explanation:
      "Uses normalized Euclidean distance and comparisons of preceding signals to investigate encounters. A decibel surge near an elimination is a candidate explanation, not proof of causation. Missing sensors cannot be inferred.",
  },
  predictive: {
    number: "03",
    name: "PREDICTIVE",
    question: "WHAT WILL HAPPEN NEXT?",
    explanation:
      "Fits y = mx + b to estimate Time-to-Blackout under current consumption assumptions. Kaplan–Meier estimates survival over time; the separate logistic model estimates escape odds. These are conditional estimates, not exact guarantees.",
  },
  prescriptive: {
    number: "04",
    name: "PRESCRIPTIVE",
    question: "WHAT SHOULD WE DO?",
    explanation:
      "Evaluates action trade-offs and association-rule support, confidence, and lift to propose a protocol. High confidence alone is not enough: compare lift, sample support, and the cost of the action.",
  },
} as const
export type Pillar = keyof typeof PILLARS
export const LEARNING_OVERLAY_EVENT = "silph:learning-overlay"

export const HYPOTHESES = [
  [
    {
      label: "A. Boost Flashlight Output",
      delta: -45,
      cost: "Higher electrical load; more illumination.",
      reasoning:
        "Increasing an emitting device strengthens the high-EMF feature you are trying to reduce. Test the emission hypothesis against the centroid instead of assuming more visibility always helps.",
    },
    {
      label: "B. Cut Electronics & Go Dark",
      delta: 38,
      cost: "Lower electrical load; less visual information.",
      reasoning:
        "This intervention reduces the feature most associated with the high-EMF cluster. The visibility trade-off remains: compare a controlled before/after sample before treating the association as a cause.",
    },
    {
      label: "C. Crouch & Hold Breath",
      delta: -8,
      cost: "Lower noise; electrical load unchanged.",
      reasoning:
        "Reducing sound targets an acoustic feature, not the dominant electromagnetic feature in this scenario. Which variable would you expect to change in a controlled test?",
    },
  ],
  [
    {
      label: "A. Observe While Moving",
      delta: 38,
      cost: "Retains visual evidence; movement still costs resources.",
      reasoning:
        "Your hypothesis preserves observation while changing exposure time. Compare it with the low-temperature, low-acoustic signature and account for the battery cost of continuing to observe.",
    },
    {
      label: "B. Look Away & Sprint",
      delta: -45,
      cost: "Fast movement; loses visual evidence and stamina.",
      reasoning:
        "This changes multiple variables at once and removes your strongest observational channel. Can you isolate which change affected the response?",
    },
    {
      label: "C. Freeze in Place",
      delta: -12,
      cost: "Conserves movement; prolongs exposure.",
      reasoning:
        "Conserving stamina is not the same as reducing exposure. What would the time-to-encounter trend predict if your position never changes?",
    },
  ],
  [
    {
      label: "A. Sprint Toward the Signal",
      delta: -45,
      cost: "More movement noise and stamina consumption.",
      reasoning:
        "A high-acoustic signature suggests testing sound sensitivity. Generating more noise strengthens, rather than weakens, that candidate signal.",
    },
    {
      label: "B. Keep Every Device Running",
      delta: -16,
      cost: "More sensing; greater resource drain.",
      reasoning:
        "Extra observations can help, but equipment use has a cost. Which sensor adds information relevant to the acoustic hypothesis, and which only steepens the battery slope?",
    },
    {
      label: "C. Reduce Your Acoustic Footprint",
      delta: 38,
      cost: "Less noise; slower movement.",
      reasoning:
        "This intervention targets the dominant acoustic feature. Compare the next sound sample against the previous one, while checking whether slower movement increases total exposure time.",
    },
  ],
] as const
export const DIAGNOSTIC_QUESTIONS = [
  "Which equipment on your person emits electromagnetic radiation? What single variable could you change to test that relationship?",
  "The temperature-drop feature dominates while the acoustic feature stays low. Which observation channel would help you distinguish a spectral hypothesis from a noisy encounter?",
  "The acoustic feature dominates this cluster. Which movement or equipment choice changes the signal you generate, rather than simply changing what you can see?",
]
export function hypothesisImpact(
  cluster: number,
  choice: number,
  baseline = 50,
) {
  const option = HYPOTHESES[cluster]?.[choice]
  if (!option) return null
  return {
    ...option,
    probability: clamp(baseline + option.delta, 0, 100),
    baseline,
  }
}

export type LearningMoment = {
  elapsed: number
  label: string
  evidence: string
}
export type LearningRun = {
  id: string
  source: string
  outcome: "escaped" | "eliminated"
  duration: number
  sprint: number | null
  crouch: number | null
  battery: {
    x: number
    y: number
  }[]
  timeline: LearningMoment[]
  diagnostic: string
}
export function behaviorArchetype(
  sprint: number | null,
  crouch: number | null,
) {
  if (sprint === null) return "INSUFFICIENT MOVEMENT EVIDENCE"
  const centers =
    crouch === null
      ? [[0.8], [0.35], [0.08]]
      : [
          [0.8, 0.1],
          [0.35, 0.7],
          [0.08, 0.15],
        ]
  const vector =
    crouch === null ? [clamp(sprint)] : [clamp(sprint), clamp(crouch)]
  const fit = kmeans([vector], centers, 1)
  return ["Panicked Sprinter", "Cautious Analyst", "Low-Movement Observer"][
    fit.labels[0]
  ]
}
export function learningRunFromSession(session: Session): LearningRun | null {
  if (session.outcome === "active") return null
  const endingIndex = session.events.findIndex(
    (e) => e.event === "death" || e.event === "escape",
  )
  const rows = session.events.slice(0, endingIndex + 1)
  const last = rows[rows.length - 1]
  const preceding = rows.slice(Math.max(0, rows.length - 4), -1)
  const lowStamina = preceding.some((e) => e.stamina < 25)
  const chase = preceding.some((e) => e.event === "chase")
  return {
    id: session.id,
    source: [...new Set(rows.map((e) => e.source))].join(" / "),
    outcome: last.event === "escape" ? "escaped" : "eliminated",
    duration: last.elapsed,
    sprint: mean(rows.map((e) => e.sprint_ratio)),
    crouch: mean(rows.map((e) => e.crouch_ratio)),
    battery: rows.map((e) => ({ x: e.elapsed, y: e.battery_level })),
    timeline: rows
      .filter(
        (e, index) =>
          index === 0 || index === rows.length - 1 || e.event !== "sample",
      )
      .slice(-14)
      .map((e) => ({
        elapsed: e.elapsed,
        label: e.event.replace(/_/g, " ").toUpperCase(),
        evidence: `${e.battery_level.toFixed(0)}% battery · ${e.stamina.toFixed(0)}% stamina · (${e.player_x.toFixed(1)}, ${e.player_y.toFixed(1)}) · ${e.source}`,
      })),
    diagnostic:
      last.event === "escape"
        ? "The record confirms an escape, not which decision caused it. Compare the sequence with eliminated sessions before proposing a successful protocol."
        : `${chase ? "A chase was recorded near the ending. " : ""}${
            lowStamina ? "Low stamina appears in the preceding records. " : ""
          }These are candidate contributing conditions, not a causal verdict. This schema contains no decibel series; audio-triggered elimination cannot be concluded.`,
  }
}
export function runBatteryForecast(run: LearningRun) {
  const distinct = new Set(run.battery.map((p) => p.x)).size
  if (distinct < 2) return null
  const fit = regression(run.battery)
  const last = run.battery[run.battery.length - 1]
  return {
    slope: fit.slope,
    seconds: fit.slope < 0 ? last.y / -fit.slope : null,
  }
}
export const TAKEAWAY = {
  question:
    "A sensor spike precedes an elimination. Which analytical sequence produces a defensible survival protocol?",
  options: [
    "Summarize the signal → test a candidate explanation → forecast a scenario → compare action trade-offs.",
    "Assume the largest spike caused the death and immediately prescribe the opposite action.",
    "Choose the rule with the highest confidence, ignoring lift, sample size, and resource cost.",
  ],
}
