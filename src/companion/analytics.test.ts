import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeBatch, normalizeTelemetry } from "../../supabase/functions/server/telemetry.ts"
import { association, demoEvents, escapeModel, kmeans, makeEvent, mergeEvents, parseCSV, parseImport, regression, sessionsFrom, survivalCurve } from "./analytics.ts"

const row = (values: Record<string, unknown> = {}) => normalizeTelemetry({
  id: "test-event",
  session_id: "TEST-SESSION",
  timestamp: "2026-01-01T12:00:00.000Z",
  player_x: 0,
  player_y: -14,
  heart_rate_proxy: 120,
  active_monster: "094",
  battery_level: 75,
  ...values,
})

test("demo records pass the same validation as imported records", () => {
  const events = demoEvents()
  assert.equal(normalizeBatch(events).length, 384)
  assert.equal(sessionsFrom(events).length, 64)
  assert.ok(events.every(event => event.source === "demo"))
})

test("clustering separates nearby signatures and tolerates an empty dataset", () => {
  const fit = kmeans([[0, 0], [1, 0], [9, 10], [10, 10]], [[0, 0], [10, 10]])
  assert.deepEqual(fit.labels, [0, 0, 1, 1])
  assert.deepEqual(fit.centers, [[.5, 0], [9.5, 10]])
  assert.deepEqual(kmeans([], [[0, 0]]), { centers: [[0, 0]], labels: [] })
})

test("OLS fits battery drain and handles constant timestamps", () => {
  assert.deepEqual(regression([{ x: 0, y: 100 }, { x: 20, y: 90 }, { x: 40, y: 80 }]), { slope: -.5, intercept: 100 })
  assert.deepEqual(regression([{ x: 0, y: 70 }, { x: 0, y: 80 }]), { slope: 0, intercept: 75 })
})

test("session outcomes and duration follow event time, not input ordering", () => {
  const events = [row({ id: "end", elapsed: 60, event: "escape" }), row({ id: "start", elapsed: 0 })]
  const [session] = sessionsFrom(events)
  assert.equal(session.outcome, "escaped")
  assert.equal(session.duration, 60)
  assert.equal(session.events[0].id, "start")
})

test("Kaplan–Meier censors active sessions and escaped sessions without treating them as deaths", () => {
  const sessions = sessionsFrom([
    row({ session_id: "DEATH", elapsed: 10, event: "death" }),
    row({ session_id: "ACTIVE", elapsed: 20 }),
    row({ session_id: "ESCAPE", elapsed: 30, event: "escape" }),
  ])
  const curve = survivalCurve(sessions)
  assert.ok(Math.abs(curve[curve.length - 1].y - 200 / 3) < 1e-9)
  assert.equal(curve[1].y, 100)
  assert.equal(curve[1].x, curve[2].x)
  assert.deepEqual(survivalCurve([]), [{ x: 0, y: 100 }])
})

test("association rules return finite values for empty data", () => {
  assert.deepEqual(association([], () => true, () => true), { support: 0, confidence: 0, lift: 0, count: 0, total: 0 })
})

test("escape probability requires sufficient completed outcomes", () => {
  assert.equal(escapeModel([], 35, .5, .3), null)
  const value = escapeModel(sessionsFrom(demoEvents()), 35, .5, .3)
  assert.ok(value !== null && value >= 0 && value <= 1)
})

test("CSV handles BOM, quoted fields, escaped quotes, and CRLF", () => {
  assert.deepEqual(parseCSV('\uFEFFa,b\r\n"hello, world","say ""hello"""\r\n'), [{ a: "hello, world", b: 'say "hello"' }])
  assert.throws(() => parseCSV('a,a\n1,2'), /unique/)
  assert.throws(() => parseCSV('a,b\n"unfinished,2'), /Unclosed/)
  assert.throws(() => parseCSV('a,b\n1'), /column count/)
})

test("imports enforce source provenance and reject invalid measurements", () => {
  const events = parseImport(JSON.stringify([row({ source: "simulation" })]), "log.json")
  assert.equal(events[0].source, "import")
  assert.throws(() => normalizeTelemetry({ ...row(), battery_level: 101 }), /battery_level/)
  assert.throws(() => normalizeTelemetry({ ...row(), player_x: 100 }), /player_x/)
  assert.throws(() => normalizeBatch([]), /1–5,000/)
  assert.throws(() => parseImport("x".repeat(2 * 1024 * 1024 + 1), "large.csv"), /2 MB/)
})

test("event merging is idempotent and sorts records chronologically", () => {
  const first = row({ id: "first" }), second = row({ id: "second", timestamp: "2026-01-01T12:01:00Z" })
  assert.deepEqual(mergeEvents([second], [first, second]).map(event => event.id), ["first", "second"])
})

test("manual defaults do not generate random measurements", () => {
  const first = makeEvent("MANUAL", "094", "sample", 20, "manual")
  const second = makeEvent("MANUAL", "094", "sample", 20, "manual")
  for (const key of ["battery_level", "stamina", "chase_duration", "reaction_ms", "heart_rate_proxy"] as const) {
    assert.equal(first[key], second[key])
  }
})
