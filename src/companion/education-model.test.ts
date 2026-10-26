import { test } from "node:test"
import assert from "node:assert/strict"
import {
  PILLARS,
  behaviorArchetype,
  hypothesisImpact,
  learningRunFromSession,
  runBatteryForecast,
} from "./education-model.ts"
import { createLocalRunRecorder } from "./local-run-learning.ts"
import { demoEvents, sessionsFrom } from "./analytics.ts"

test("four academic pillars expose distinct questions and methodological caveats", () => {
  assert.deepEqual(Object.keys(PILLARS), [
    "descriptive",
    "diagnostic",
    "predictive",
    "prescriptive",
  ])
  assert.match(PILLARS.diagnostic.explanation, /not proof/)
  assert.match(PILLARS.predictive.explanation, /not exact/)
})
test("hypothesis exercise applies authored percentage-point changes, not relative gains", () => {
  assert.equal(hypothesisImpact(0, 1)?.probability, 88)
  assert.equal(hypothesisImpact(0, 0)?.probability, 5)
  assert.equal(hypothesisImpact(0, 1, 90)?.probability, 100)
  assert.equal(hypothesisImpact(10, 0), null)
  assert.equal(hypothesisImpact(0, 10), null)
  assert.equal(hypothesisImpact(2, 2)?.delta, 38)
})
test("reference archetype assignment handles missing crouch and missing movement evidence", () => {
  assert.equal(behaviorArchetype(0.9, 0.1), "Panicked Sprinter")
  assert.equal(behaviorArchetype(0.3, 0.75), "Cautious Analyst")
  assert.equal(behaviorArchetype(0.35, null), "Cautious Analyst")
  assert.equal(behaviorArchetype(null, null), "INSUFFICIENT MOVEMENT EVIDENCE")
})
test("completed reference debrief preserves provenance and does not invent acoustic causes", () => {
  const session = sessionsFrom(demoEvents())[0]
  const run = learningRunFromSession(session)!
  assert.equal(run.source, "demo")
  assert.equal(run.outcome, "eliminated")
  assert.match(run.diagnostic, /no decibel/)
  assert.ok(run.timeline.length >= 2)
  assert.equal(learningRunFromSession({ ...session, outcome: "active" }), null)
})
test("local recorder derives ratios and milestone evidence without heart-rate or crouching fabrication", () => {
  const recorder = createLocalRunRecorder("LOCAL-TEST")
  recorder.tick(1, 95, true, 1)
  recorder.tick(2, 90, false, 1)
  recorder.record({
    elapsed: 2,
    label: "RESCUE 1/3",
    evidence: "Observed objective interaction.",
  })
  const run = recorder.finish(3, 85, "caught")
  assert.equal(run.sprint, 0.5)
  assert.equal(run.crouch, null)
  assert.equal(run.outcome, "eliminated")
  assert.equal(
    run.timeline[run.timeline.length - 1]?.label,
    "CAPTURE CONFIRMED",
  )
  assert.ok(run.timeline.some((row) => row.label === "RESCUE 1/3"))
  assert.equal(runBatteryForecast(run)?.slope, -5)
  assert.match(run.diagnostic, /no EMF/)
})
test("local recorder resets independently, records low-power crossings once, and supports escape", () => {
  const recorder = createLocalRunRecorder("RUN-A")
  recorder.tick(1, 19, false, 1)
  recorder.tick(2, 18, false, 1)
  recorder.tick(3, 0, false, 1)
  const run = recorder.finish(4, 0, "escaped")
  assert.equal(
    run.timeline.filter((row) => row.label === "LOW BATTERY").length,
    1,
  )
  assert.equal(
    run.timeline.filter((row) => row.label === "BATTERY EXHAUSTED").length,
    1,
  )
  assert.equal(run.outcome, "escaped")
  const fresh = createLocalRunRecorder("RUN-B").finish(0, 100, "escaped")
  assert.equal(fresh.sprint, null)
  assert.equal(fresh.timeline.length, 2)
  assert.equal(runBatteryForecast(fresh), null)
})
