import { test } from "node:test"
import assert from "node:assert/strict"
import {
  publicBatteryScenario,
  referenceCluster,
} from "./public-preview-model.ts"

test("public usage switches steepen only the illustrative linear battery scenario", () => {
  const base = publicBatteryScenario(false, false),
    light = publicBatteryScenario(true, false),
    both = publicBatteryScenario(true, true)
  assert.ok(base.blackout > light.blackout && light.blackout > both.blackout)
  assert.ok(Math.abs(both.fit.slope + both.drain) < 1e-9)
  assert.equal(both.points[0].y, 100)
  assert.ok(Math.abs(both.points[both.points.length - 1].y) < 1e-9)
})
test("each reference signature matches its intended centroid", () => {
  assert.equal(referenceCluster(86, 20.8, 40).index, 0)
  assert.equal(referenceCluster(30, -15.2, 6).index, 1)
  assert.equal(referenceCluster(24, 19, 88).index, 2)
})
