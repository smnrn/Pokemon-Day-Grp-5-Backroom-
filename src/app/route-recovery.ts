const RETRY_KEY = "silph:route-module-retry"
const RETRY_INTERVAL = 60_000

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk .+ failed|Unable to preload CSS/i.test(
    message,
  )
}

export function recoverRouteModule(
  error: unknown,
  options: {
    storage: () => Pick<Storage, "getItem" | "setItem">
    reload: () => void
    now?: () => number
  },
): boolean {
  if (!isModuleLoadError(error)) return false
  try {
    const storage = options.storage()
    const now = (options.now ?? Date.now)()
    const previous = storage.getItem(RETRY_KEY)
    if (
      previous !== null &&
      Number.isFinite(Number(previous)) &&
      now - Number(previous) < RETRY_INTERVAL
    )
      return false
    // A rejected dynamic import can remain cached for this document's lifetime.
    // Persist the guard before reloading so a missing module cannot loop.
    storage.setItem(RETRY_KEY, String(now))
    options.reload()
    return true
  } catch {
    // Without storage we cannot safely bound automatic retries across reloads.
    return false
  }
}
