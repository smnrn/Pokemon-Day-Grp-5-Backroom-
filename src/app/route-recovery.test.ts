import { test } from "node:test"
import assert from "node:assert/strict"
import { isModuleLoadError, recoverRouteModule } from "./route-recovery.ts"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
const moduleError = () =>
  new TypeError("Failed to fetch dynamically imported module: /assets/page.js")

test("recognizes browser and production chunk failures without treating API errors as stale modules", () => {
  assert.equal(isModuleLoadError(moduleError()), true)
  assert.equal(
    isModuleLoadError(new TypeError("Importing a module script failed.")),
    true,
  )
  assert.equal(isModuleLoadError(new Error("Loading chunk 123 failed.")), true)
  assert.equal(
    isModuleLoadError(new Error("Unable to preload CSS for /assets/page.css")),
    true,
  )
  assert.equal(isModuleLoadError(new TypeError("Failed to fetch")), false)
  assert.equal(isModuleLoadError(new Error("Invalid login credentials")), false)
})
test("a module failure triggers one refresh and does not loop under repeated renders or StrictMode", () => {
  const saved = storage()
  let reloads = 0
  const options = {
    storage: () => saved,
    reload: () => {
      reloads++
    },
    now: () => 1000,
  }
  assert.equal(recoverRouteModule(moduleError(), options), true)
  assert.equal(recoverRouteModule(moduleError(), options), false)
  assert.equal(
    recoverRouteModule(moduleError(), { ...options, now: () => 5000 }),
    false,
  )
  assert.equal(reloads, 1)
})
test("a new attempt is allowed after the cooldown", () => {
  const saved = storage()
  let reloads = 0
  const options = {
    storage: () => saved,
    reload: () => {
      reloads++
    },
  }
  recoverRouteModule(moduleError(), { ...options, now: () => 0 })
  assert.equal(
    recoverRouteModule(moduleError(), { ...options, now: () => 60_000 }),
    true,
  )
  assert.equal(reloads, 2)
})
test("blocked storage cannot cause an unbounded automatic refresh", () => {
  let reloads = 0
  assert.equal(
    recoverRouteModule(moduleError(), {
      storage: () => {
        throw new Error("Storage blocked")
      },
      reload: () => {
        reloads++
      },
    }),
    false,
  )
  assert.equal(
    recoverRouteModule(moduleError(), {
      storage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage full")
        },
      }),
      reload: () => {
        reloads++
      },
    }),
    false,
  )
  assert.equal(reloads, 0)
})
test("ordinary application failures do not refresh or alter storage", () => {
  let touched = false
  assert.equal(
    recoverRouteModule(new Error("Application failure"), {
      storage: () => {
        touched = true
        return storage()
      },
      reload: () => {
        touched = true
      },
    }),
    false,
  )
  assert.equal(touched, false)
})
