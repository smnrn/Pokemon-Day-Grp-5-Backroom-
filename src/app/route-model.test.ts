import { test } from "node:test"
import assert from "node:assert/strict"
import {
  applicationBase,
  isAuthenticationCallback,
  loginDestination,
} from "./route-model.ts"

test("sign-in defaults preserve separate player and admin destinations", () => {
  assert.equal(loginDestination("player", null), "/app")
  assert.equal(loginDestination("admin", null), "/admin")
})
test("game return destinations preserve the named check-in flow", () => {
  assert.equal(loginDestination("player", "/game"), "/game")
  assert.equal(loginDestination("admin", "/game"), "/game")
  assert.equal(loginDestination("player", "/game/"), "/game")
})
test("untrusted return URLs and player-to-admin redirects cannot bypass role checks", () => {
  for (const destination of [
    "//example.com",
    "https://example.com",
    "/login",
    "/",
    "/admin?elevate=true",
  ]) {
    assert.equal(loginDestination("player", destination), "/app")
  }
  assert.equal(loginDestination("player", "/admin"), "/app")
  assert.equal(loginDestination("admin", "/admin"), "/admin")
})
test("routing supports root and deployed Vite base paths", () => {
  assert.equal(applicationBase("/"), "/")
  assert.equal(applicationBase("/exhibition/"), "/exhibition")
  assert.equal(applicationBase("https://example.test/showcase/"), "/showcase")
})
test("legacy confirmation callbacks reach login without interpreting public anchors as authentication", () => {
  assert.equal(
    isAuthenticationCallback(
      "",
      "#access_token=test-token&refresh_token=test-refresh",
    ),
    true,
  )
  assert.equal(isAuthenticationCallback("?code=test-confirmation", ""), true)
  assert.equal(
    isAuthenticationCallback("", "#error_description=confirmation-expired"),
    true,
  )
  assert.equal(isAuthenticationCallback("", "#analytical-pillars"), false)
  assert.equal(isAuthenticationCallback("?campaign=exhibition", ""), false)
})
