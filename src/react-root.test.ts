import { test } from "node:test"
import assert from "node:assert/strict"
import type { Root } from "react-dom/client"
import { getAppRoot } from "./react-root.ts"

const container = () => ({}) as HTMLElement
const root = (): Root => ({ render() {}, unmount() {} })

test("repeated initialization reuses the root and renders through its existing owner", () => {
  const element = container()
  let creates = 0,
    renders = 0
  const existing: Root = {
    render() {
      renders++
    },
    unmount() {},
  }
  const create = () => {
    creates++
    return existing
  }
  getAppRoot(element, create).render(null)
  getAppRoot(element, create).render(null)
  assert.equal(creates, 1)
  assert.equal(renders, 2)
})

test("different DOM containers receive independent roots", () => {
  const first = container(),
    second = container()
  const firstRoot = getAppRoot(first, root)
  const secondRoot = getAppRoot(second, root)
  assert.notEqual(firstRoot, secondRoot)
  assert.equal(getAppRoot(first, root), firstRoot)
})

test("re-evaluating the root helper retains ownership of an existing container", async () => {
  const element = container()
  const existing = getAppRoot(element, root)
  const reloaded = await import(
    new URL("./react-root.ts?root-reload-test", import.meta.url).href
  )
  assert.equal(
    reloaded.getAppRoot(element, () => {
      throw new Error("Duplicate root creation")
    }),
    existing,
  )
})

test("failed root creation does not poison a later initialization attempt", () => {
  const element = container()
  assert.throws(
    () =>
      getAppRoot(element, () => {
        throw new Error("Initialization failed")
      }),
    /Initialization failed/,
  )
  assert.ok(getAppRoot(element, root))
})
