import { useEffect, useState } from "react"
import { useRouteError } from "react-router"
import { Badge, Icon, Panel } from "../companion/UI"
import { isModuleLoadError, recoverRouteModule } from "./route-recovery"
import "../companion/companion.css"

export function RouteLoadBoundary() {
  const error = useRouteError()
  const [reloading, setReloading] = useState(false)
  const moduleFailure = isModuleLoadError(error)
  useEffect(() => {
    if (
      recoverRouteModule(error, {
        storage: () => window.sessionStorage,
        reload: () => window.location.reload(),
      })
    )
      setReloading(true)
  }, [error])
  return (
    <div className="companion c-access-page">
      <header className="c-access-brand">
        <Icon name="terminal" size={24} />
        <span>
          SILPH CO.<small>ANOMALOUS RESEARCH DIVISION</small>
        </span>
        <Badge tone="yellow">CONNECTION RECOVERY</Badge>
      </header>
      <main className="c-access-layout">
        <section className="c-access-intro">
          <span className="c-eyebrow">TERMINAL / PAGE DELIVERY</span>
          <h1>
            {reloading
              ? "RECONNECTING THE TERMINAL_"
              : "TERMINAL LINK INTERRUPTED_"}
          </h1>
          <p>
            {moduleFailure
              ? "A page module could not be loaded. Preview updates or an interrupted connection can leave an older page referencing unavailable files."
              : "This view could not be displayed. Reload the terminal to restart the page."}
          </p>
        </section>
        <Panel
          code="!"
          title="REQUEST FRESH PAGE FILES"
          tag="BOUNDED RECOVERY"
          className="c-access-panel"
        >
          <div className="c-access-form" role="alert">
            <p>
              {reloading
                ? "Refreshing once to request the current application files…"
                : "Automatic recovery is limited to prevent a reload loop. If loading is still unavailable, restore your connection and retry."}
            </p>
            <button
              type="button"
              className="c-primary-button"
              onClick={() => window.location.reload()}
            >
              RELOAD TERMINAL <Icon name="stream" size={15} />
            </button>
            <a className="c-secondary-button" href={import.meta.env.BASE_URL}>
              RETURN TO PUBLIC BRIEFING <Icon name="arrow" size={14} />
            </a>
            <p className="c-method">
              Reloading does not sign you out or clear stored records. Unsaved,
              in-memory interactions may restart.
            </p>
          </div>
        </Panel>
      </main>
    </div>
  )
}
