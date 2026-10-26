import { test } from "node:test"
import assert from "node:assert/strict"
import {
  camcorderTime,
  DOSSIERS,
  pointerEnergy,
  SILHOUETTES,
} from "./landing-model.ts"

test("camcorder clock counts real elapsed hundredths and handles minute rollover", () => {
  assert.equal(camcorderTime(259880), "00:04:19:88")
  assert.equal(camcorderTime(59999), "00:00:59:99")
  assert.equal(camcorderTime(60000), "00:01:00:00")
  assert.equal(camcorderTime(3600000), "01:00:00:00")
  assert.equal(camcorderTime(-1), "00:00:00:00")
})
test("acoustic energy increases with pointer speed, stays finite, and is bounded", () => {
  assert.equal(pointerEnergy(0, 16), 0)
  assert.ok(pointerEnergy(20, 16) < pointerEnergy(40, 16))
  assert.equal(pointerEnergy(1000, 0), 1)
  assert.equal(pointerEnergy(-1, 16), 0)
})
test("all fictional dossiers have matching silhouettes and Socratic field questions", () => {
  assert.deepEqual(
    DOSSIERS.map((row) => row.id),
    ["025", "094", "934"],
  )
  for (const dossier of DOSSIERS) {
    assert.ok(SILHOUETTES[dossier.id].startsWith("M"))
    assert.ok(dossier.action.length > 40)
    assert.ok(dossier.action.includes("?"))
  }
})
