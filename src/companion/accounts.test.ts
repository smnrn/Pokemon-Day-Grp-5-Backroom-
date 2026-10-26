import { test } from "node:test"
import assert from "node:assert/strict"
import { createAccountApi } from "../../supabase/functions/server/account-api.ts"
import {
  displayName,
  roleFor,
  type Identity,
} from "../../supabase/functions/server/accounts.ts"
import { normalizeTelemetry } from "../../supabase/functions/server/telemetry.ts"

const player: Identity = {
  id: "player-account",
  app_metadata: {},
  user_metadata: { display_name: "Field Player", role: "admin" },
}
const admin: Identity = {
  id: "admin-account",
  app_metadata: { role: "admin" },
  user_metadata: { display_name: "Professor" },
}
function setup() {
  const records = new Map<string, unknown>()
  const api = createAccountApi({
    authenticate: async (token) =>
      token === "test-admin" ? admin : token === "test-player" ? player : null,
    store: {
      get: async (key) => records.get(key),
      set: async (key, value) => {
        records.set(key, value)
      },
      mset: async (keys, values) => {
        keys.forEach((key, index) => records.set(key, values[index]))
      },
      list: async (prefix, limit) =>
        [...records.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, limit)
          .map(([, value]) => value),
    },
  })
  const request = (
    path: string,
    token?: string,
    input?: unknown,
    method = input === undefined ? "GET" : "POST",
  ) =>
    api.request(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    })
  return { records, request }
}

test("only trusted app metadata can grant the admin role", () => {
  assert.equal(roleFor(player), "player")
  assert.equal(roleFor(admin), "admin")
  assert.equal(
    roleFor({ id: "any", user_metadata: { role: "admin" } }),
    "player",
  )
})
test("display names normalize whitespace, accept Unicode nicknames, and reject unsafe values", () => {
  assert.equal(displayName("  Field   Player  "), "Field Player")
  assert.equal(displayName("研究員"), "研究員")
  for (const name of ["", "a", "a".repeat(41), "<script>", "x\u0000y", null]) {
    assert.throws(() => displayName(name))
  }
})
test("anonymous and invalid tokens cannot access account or analytics APIs", async () => {
  const { request } = setup()
  for (const path of ["/me", "/admin/play-sessions", "/telemetry"]) {
    assert.equal((await request(path)).status, 401)
    assert.equal((await request(path, "invalid")).status, 401)
  }
})
test("players cannot read the named roster or read/write telemetry, even with spoofed metadata", async () => {
  const { request } = setup()
  assert.equal(
    (await request("/admin/play-sessions", "test-player")).status,
    403,
  )
  assert.equal((await request("/telemetry", "test-player")).status, 403)
  assert.equal(
    (await request("/telemetry", "test-player", { events: [] })).status,
    403,
  )
})
test("self-service profile updates cannot promote an account", async () => {
  const { request, records } = setup()
  const response = await request(
    "/me",
    "test-player",
    {
      display_name: "Nickname",
      role: "admin",
      app_metadata: { role: "admin" },
    },
    "PUT",
  )
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).account, {
    id: player.id,
    role: "player",
    display_name: "Nickname",
  })
  assert.deepEqual(records.get(`silph:profile:${player.id}`), {
    display_name: "Nickname",
  })
})
test("player registration requires a valid name and the analytics notice acknowledgment", async () => {
  const { request, records } = setup()
  assert.equal(
    (await request("/play-sessions", "test-player", { display_name: "Player" }))
      .status,
    400,
  )
  assert.equal(
    (
      await request("/play-sessions", "test-player", {
        display_name: "",
        analytics_acknowledged: true,
      })
    ).status,
    400,
  )
  assert.equal(records.size, 0)
})
test("registration binds the player to the verified identity, not submitted account or role values", async () => {
  const { request } = setup()
  const response = await request("/play-sessions", "test-player", {
    display_name: "Booth Player",
    analytics_acknowledged: true,
    user_id: admin.id,
    role: "admin",
    started_at: "fake",
    id: "fake",
  })
  assert.equal(response.status, 201)
  const { session } = await response.json()
  assert.equal(session.user_id, player.id)
  assert.equal(session.display_name, "Booth Player")
  assert.equal(session.source, "player_registration")
  assert.match(session.id, /^PLAY-/)
  assert.ok(Number.isFinite(Date.parse(session.started_at)))
  assert.equal(session.email, undefined)
  assert.equal(session.outcome, undefined)
})
test("only admins can list real registrations; duplicate names remain separate accounts or sessions", async () => {
  const { request } = setup()
  for (let count = 0; count < 2; count++) {
    assert.equal(
      (
        await request("/play-sessions", "test-player", {
          display_name: "Same Name",
          analytics_acknowledged: true,
        })
      ).status,
      201,
    )
  }
  const response = await request("/admin/play-sessions", "test-admin")
  assert.equal(response.status, 200)
  const { sessions } = await response.json()
  assert.equal(sessions.length, 2)
  assert.notEqual(sessions[0].id, sessions[1].id)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
})
test("admin telemetry round trips and rejects demo records", async () => {
  const { request } = setup()
  const event = normalizeTelemetry({
    id: "observation",
    session_id: "PLAY-test",
    timestamp: new Date().toISOString(),
    player_x: 0,
    player_y: 0,
    heart_rate_proxy: 100,
    active_monster: "094",
    battery_level: 70,
    source: "manual",
  })
  const response = await request("/telemetry", "test-admin", {
    events: [event],
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).saved, 1)
  assert.deepEqual(
    (await (await request("/telemetry", "test-admin")).json()).events,
    [event],
  )
  assert.equal(
    (
      await request("/telemetry", "test-admin", {
        events: [{ ...event, source: "demo" }],
      })
    ).status,
    400,
  )
})
test("oversized requests are rejected before storage", async () => {
  const { request, records } = setup()
  assert.equal(
    (
      await request("/play-sessions", "test-player", {
        display_name: "x".repeat(2 * 1024 * 1024),
      })
    ).status,
    413,
  )
  assert.equal(records.size, 0)
})
