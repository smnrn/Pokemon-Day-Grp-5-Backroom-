import { useMemo, useState } from "react"
import type { PlaySession } from "../../supabase/functions/server/accounts"
import { sessionsFrom, type Telemetry } from "./analytics"
import { Badge, Icon, Panel } from "./UI"

export function PlayerRoster({
  registrations,
  events,
  error,
  onRefresh,
  onObserve,
}: {
  registrations: PlaySession[]
  events: Telemetry[]
  error: string
  onRefresh: () => void
  onObserve: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const observations = useMemo(
    () =>
      sessionsFrom(
        events.filter((e) => e.source === "manual" || e.source === "import"),
      ),
    [events],
  )
  const filtered = registrations.filter((row) =>
    `${row.display_name} ${row.username || ""} ${row.section_and_group || ""} ${row.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )

  return (
    <Panel
      code="P"
      title="REGISTERED STUDENT & PLAYER SESSIONS"
      tag="ADMIN ONLY / RESEARCH ROSTER"
      className="c-roster-panel"
      pillar="descriptive"
    >
      <div className="c-roster-toolbar">
        <span>
          <strong>{registrations.length}</strong> REGISTERED SESSIONS{" "}
          <small>
            {new Set(registrations.map((row) => row.user_id)).size} UNIQUE
            PLAYER ACCOUNTS
          </small>
        </span>
        <label className="c-roster-search">
          <Icon name="target" size={14} />
          <input
            aria-label="Search registered players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, section, or session ID"
          />
        </label>
        <button className="c-secondary-button" onClick={onRefresh}>
          REFRESH <Icon name="stream" size={13} />
        </button>
      </div>
      {error && (
        <p className="c-access-error c-roster-error" role="alert">
          {error}
        </p>
      )}
      <div className="c-roster-scroll">
        <table className="c-roster-table">
          <thead>
            <tr>
              <th>PLAYER / USERNAME</th>
              <th>SECTION & GROUP</th>
              <th>SESSION ID</th>
              <th>REGISTERED AT</th>
              <th>OBSERVED OUTCOME</th>
              <th>RECORDS</th>
              <th>
                <span className="c-small-label">ACTION</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const observed = observations.find(
                (session) => session.id === row.id,
              )
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.display_name}</strong>
                    <small>USER: {row.username || "STUDENT"}</small>
                  </td>
                  <td>
                    <Badge tone="yellow">
                      {row.section_and_group || "UNASSIGNED"}
                    </Badge>
                  </td>
                  <td>
                    <span>{row.id}</span>
                    <small>ID: {row.user_id ? row.user_id.slice(0, 10) : "N/A"}</small>
                  </td>
                  <td>{new Date(row.started_at).toLocaleString()}</td>
                  <td>
                    <Badge
                      tone={
                        observed?.outcome === "escaped"
                          ? "green"
                          : observed?.outcome === "eliminated"
                            ? "red"
                            : "yellow"
                      }
                    >
                      {observed
                        ? observed.outcome === "active"
                          ? "OBSERVING"
                          : observed.outcome.toUpperCase()
                        : "NOT YET OBSERVED"}
                    </Badge>
                  </td>
                  <td>
                    {observed?.events.length ?? 0}
                    <small>MANUAL / IMPORT</small>
                  </td>
                  <td>
                    <button
                      className="c-secondary-button"
                      onClick={() => onObserve(row.id)}
                    >
                      LOG EVENTS <Icon name="arrow" size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="c-empty">
          {search
            ? "No matching student sessions found."
            : error
              ? "Player registrations could not be loaded."
              : "No student check-ins yet. Registered sessions will appear here when students start the game."}
        </div>
      )}
      <div className="c-card-foot">
        <i />
        STUDENT RESEARCH ROSTER · LINKED TO SECTION & GROUP
        <span>
          A REGISTRATION RECORDS THE STUDENT SESSION. GAME OUTCOMES AND HAZARDS ARE
          ANALYZED IN REAL TIME.
        </span>
      </div>
    </Panel>
  )
}
