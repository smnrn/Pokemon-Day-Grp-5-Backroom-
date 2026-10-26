import { useEffect, useMemo, useRef, useState } from "react"
import {
  normalizeBatch,
  normalizeTelemetry,
} from "../../supabase/functions/server/telemetry"
import {
  association,
  clamp,
  demoEvents,
  escapeModel,
  formatTime,
  kmeans,
  makeEvent,
  mean,
  mergeEvents,
  parseImport,
  regression,
  sessionsFrom,
  SPECIMENS,
  survivalCurve,
  type EventKind,
  type Monster,
  type Source,
  type Telemetry,
} from "./analytics"
import { loadCloud, saveCloud } from "./cloud"
import { useAccount } from "./Access"
import { accountRequest } from "./api"
import { PlayerRoster } from "./PlayerRoster"
import type { PlaySession } from "../../supabase/functions/server/accounts"
import { Bars, Heatmap, LinePlot, RadarChart, Scatter } from "./Charts"
import { Badge, Icon, Metric, Panel } from "./UI"
import {
  BriefingButton,
  DeductionEngine,
  DiagnosticDebriefPanel,
  PrescriptiveEvidencePanel,
} from "./LearningGuide"
import { DIAGNOSTIC_QUESTIONS } from "./education-model"
import { PillarFilters, PillarProvider, PillarRegion } from "./Pillars"
import "./companion.css"

const TABS = [
  {
    id: "dex",
    icon: "terminal",
    label: "COMPANION DATA-DEX",
    sub: "PLAYER VIEW",
  },
  {
    id: "analytics",
    icon: "chart",
    label: "ANALYTICS DASHBOARD",
    sub: "PROFESSOR VIEW",
  },
  {
    id: "stream",
    icon: "stream",
    label: "LIVE TELEMETRY",
    sub: "OPERATOR VIEW",
  },
] as const
function readCache(key: string): Telemetry[] {
  try {
    const rows = JSON.parse(sessionStorage.getItem(key) ?? "[]")
    return rows.length ? normalizeBatch(rows) : []
  } catch {
    return []
  }
}
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Gauge({ value }: { value: number | null }) {
  return (
    <div className="c-gauge">
      <svg
        viewBox="0 0 100 100"
        aria-label={
          value === null
            ? "Insufficient data for escape model"
            : `${(value * 100).toFixed(1)} percent modeled escape probability`
        }
        role="img"
      >
        <circle cx="50" cy="50" r="40" className="c-gauge-track" />
        <circle
          cx="50"
          cy="50"
          r="40"
          className="c-gauge-value"
          strokeDasharray={`${(value ?? 0) * 251.3} 251.3`}
        />
      </svg>
      <div>
        <strong>{value === null ? "—" : `${Math.round(value * 100)}%`}</strong>
        <small>ESCAPE ODDS</small>
      </div>
    </div>
  )
}
export default function Companion({ initialTab="dex" }: { initialTab?: "dex" | "analytics" | "stream" }) {
  const { account, signOut } = useAccount()
  const isAdmin = account.role === "admin"
  const recordsKey = `silph-admin-records:${account.id}`
  const pendingKey = `silph-admin-pending:${account.id}`
  const [tab, setTab] = useState<"dex" | "analytics" | "stream">(isAdmin ? initialTab : "dex")
  const [events, setEvents] = useState<Telemetry[]>(() =>
    mergeEvents(demoEvents(), isAdmin ? readCache(recordsKey) : []),
  )
  const [pending, setPending] = useState<Telemetry[]>(() =>
    isAdmin ? readCache(pendingKey) : [],
  )
  const [registrations, setRegistrations] = useState<PlaySession[]>([])
  const [registrationError, setRegistrationError] = useState("")
  const [selectedRegistration, setSelectedRegistration] = useState("")
  const [cloud, setCloud] =
    useState<"connecting" | "online" | "offline" | "syncing">("connecting")
  const [cloudError, setCloudError] = useState("")
  const [retry, setRetry] = useState(0)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const [auto, setAuto] = useState(false)
  const [notice, setNotice] = useState("")
  const [scope, setScope] =
    useState<"all" | "database" | "demo" | "observed" | "simulation">("all")
  const [clock, setClock] = useState(new Date())
  const [emf, setEmf] = useState(82),
    [temperature, setTemperature] = useState(18),
    [decibels, setDecibels] = useState(42)
  const [flashlight, setFlashlight] = useState(true),
    [camcorder, setCamcorder] = useState(false),
    [sprinting, setSprinting] = useState(false)
  const [resource, setResource] = useState<"battery" | "sanity">("battery")
  const [heatFilter, setHeatFilter] = useState("All telemetry"),
    [barMetric, setBarMetric] = useState(0)
  const [monster, setMonster] = useState<Monster>("094"),
    [duration, setDuration] = useState(45),
    [sector, setSector] = useState("B")
  const [heart, setHeart] = useState(120),
    [sprintRatio, setSprintRatio] = useState(55),
    [stealth, setStealth] = useState(30),
    [clue, setClue] = useState(35)
  const [battery, setBattery] = useState(75),
    [stamina, setStamina] = useState(60),
    [chaseDuration, setChaseDuration] = useState(0),
    [reaction, setReaction] = useState(450)
  const [manualId, setManualId] = useState(""),
    [manualEnded, setManualEnded] = useState(false)
  const [selectedSpecimen, setSelectedSpecimen] = useState<number | null>(null)
  const [selectedVisitor, setSelectedVisitor] = useState("")
  const fileInput = useRef<HTMLInputElement>(null),
    inFlight = useRef(false),
    retryAfter = useRef(0)
  const simulation = useRef<Telemetry | null>(null)
  const add = (rows: Telemetry[]) => {
    if (!isAdmin) return
    setEvents((current) => mergeEvents(current, rows))
    setPending((current) => mergeEvents(current, rows))
  }
  useEffect(() => {
    document.title = "LIMINAL DEFECT | Research Telemetry & Analytics Dashboard"
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(""), 6500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!isAdmin) return
    const controller = new AbortController()
    const refresh = () =>
      accountRequest("/admin/play-sessions", { signal: controller.signal })
        .then((body) => {
          if (!Array.isArray(body?.sessions))
            throw new Error("Invalid player roster response.")
          if (!controller.signal.aborted) {
            setRegistrations(body.sessions)
            setRegistrationError("")
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setRegistrationError(
              error instanceof Error
                ? error.message
                : "Player roster unavailable.",
            )
        })
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [isAdmin, account.id, retry])
  useEffect(() => {
    if (!isAdmin) return
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 10000)
    loadCloud(controller.signal)
      .then((rows) => {
        if (active) {
          if (rows.length > 0) {
            setEvents(rows)
          }
          setCloud("online")
          setCloudError("")
        }
      })
      .catch((error) => {
        if (active) {
          setCloud("offline")
          setCloudError(
            controller.signal.aborted
              ? "Cloud connection timed out. Records remain on this device."
              : error instanceof Error
                ? error.message
                : "Cloud connection unavailable",
          )
        }
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [isAdmin, retry])
  useEffect(() => {
    if (!isAdmin) return
    try {
      sessionStorage.setItem(
        recordsKey,
        JSON.stringify(events.filter((e) => e.source !== "demo")),
      )
      sessionStorage.setItem(pendingKey, JSON.stringify(pending))
    } catch {
      setNotice(
        "Device storage is full. Export your records before closing this tab.",
      )
    }
  }, [events, pending, isAdmin, recordsKey, pendingKey])
  useEffect(() => {
    if (!isAdmin || !pending.length || inFlight.current) return
    const timer = setTimeout(
      async () => {
        if (inFlight.current) return
        const batch = pending.slice(0, 500)
        inFlight.current = true
        setCloud("syncing")
        try {
          await saveCloud(batch)
          const ids = new Set(batch.map((e) => e.id))
          setPending((current) => current.filter((e) => !ids.has(e.id)))
          setCloud("online")
          setCloudError("")
          retryAfter.current = 0
        } catch (error) {
          retryAfter.current = Date.now() + 12000
          setCloud("offline")
          setCloudError(
            error instanceof Error ? error.message : "Cloud sync failed",
          )
          setSyncAttempt((v) => v + 1)
        } finally {
          inFlight.current = false
        }
      },
      Math.max(600, retryAfter.current - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [pending, isAdmin, retry, syncAttempt])
  useEffect(() => {
    if (selectedSpecimen === null) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>(".c-specimen-modal")
    const close = dialog?.querySelector<HTMLButtonElement>("button")
    close?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setSelectedSpecimen(null)
      }
      if (event.key === "Tab") {
        event.preventDefault()
        close?.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("keydown", handleKey)
      previous?.focus()
    }
  }, [selectedSpecimen])
  useEffect(() => {
    if (!auto || !isAdmin) return
    const tick = () => {
      let previous = simulation.current
      if (
        !previous ||
        previous.event === "death" ||
        previous.event === "escape"
      )
        previous = makeEvent(
          `SIM-${crypto.randomUUID().slice(0, 8)}`,
          "094",
          "sample",
          0,
          "simulation",
        )
      const elapsed = previous.elapsed + 2
      const roll = Math.random()
      const event: EventKind =
        elapsed > 60 && roll < 0.12
          ? Math.random() > 0.72
            ? "escape"
            : "death"
          : roll < 0.12
            ? "jumpscare"
            : roll < 0.25
              ? "chase"
              : roll < 0.35
                ? "corridor"
                : roll < 0.48
                  ? "turn_left"
                  : roll < 0.57
                    ? "hide_locker"
                    : "sample"
      const next = makeEvent(
        previous.session_id,
        previous.active_monster,
        event,
        elapsed,
        "simulation",
        previous,
      )
      simulation.current = next
      add([next])
    }
    tick()
    const timer = setInterval(tick, 2000)
    return () => clearInterval(timer)
  }, [auto, isAdmin])
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          scope === "all" ||
          (scope === "database"
            ? e.source === "database" || e.source === "game" || e.source === "manual" || e.source === "import"
            : scope === "observed"
              ? e.source === "manual" || e.source === "import" || e.source === "game"
              : e.source === scope),
      ),
    [events, scope],
  )
  const sessions = useMemo(() => sessionsFrom(visibleEvents), [visibleEvents])
  const current = [...sessions].sort(
    (a, b) => Date.parse(b.latest.timestamp) - Date.parse(a.latest.timestamp),
  )[0]
  const completed = sessions.filter((s) => s.outcome !== "active"),
    escaped = completed.filter((s) => s.outcome === "escaped")
  const escapeRate = completed.length
    ? (escaped.length / completed.length) * 100
    : 0
  const specimenStats = SPECIMENS.map((s) => {
    const encountered = sessions.filter((run) =>
      run.events.some((e) => e.active_monster === s.id),
    )
    const killed = completed.filter(
      (run) =>
        run.outcome === "eliminated" && run.latest.active_monster === s.id,
    )
    const rows = visibleEvents.filter((e) => e.active_monster === s.id)
    return {
      ...s,
      encounters: encountered.length,
      kills: killed.length,
      values: [
        encountered.length ? (killed.length / encountered.length) * 100 : 0,
        mean(
          rows.filter((e) => e.event === "chase").map((e) => e.chase_duration),
        ),
        mean(rows.map((e) => e.reaction_ms)),
      ],
    }
  })
  const deadliest = [...specimenStats].sort((a, b) => b.kills - a.kills)[0]
  const deaths = completed.filter((s) => s.outcome === "eliminated").length
  const threatSamples = useMemo(
    () =>
      SPECIMENS.slice(0, 3).flatMap((s, index) =>
        Array.from({ length: 23 }, (_, i) => ({
          vector: s.vector.map((n, axis) =>
            clamp(n + Math.sin(i * 7.21 + axis * 5.4 + index) * 0.12),
          ),
          index,
        })),
      ),
    [],
  )
  const threatFit = useMemo(
    () =>
      kmeans(
        threatSamples.map((p) => p.vector),
        SPECIMENS.slice(0, 3).map((s) => s.vector),
      ),
    [threatSamples],
  )
  const encounter = [emf / 100, clamp((40 - temperature) / 60), decibels / 100]
  const distances = threatFit.centers.map((center) =>
    Math.hypot(...encounter.map((n, i) => n - center[i])),
  )
  const activeIndex = distances.reduce(
      (best, d, i) => (d < distances[best] ? i : best),
      0,
    ),
    active = SPECIMENS[activeIndex]
  const project = (v: number[]) => ({
    x: v[0] * 100,
    y: (v[1] * 0.45 + v[2] * 0.55) * 100,
  })
  const resourcePoints =
    current?.events.map((e) => ({
      x: e.elapsed,
      y:
        resource === "battery"
          ? e.battery_level
          : 100 - clamp((e.heart_rate_proxy - 60) / 140) * 100,
    })) ?? []
  const fit = regression(resourcePoints),
    lastPoint = resourcePoints[resourcePoints.length - 1] ?? { x: 0, y: 100 }
  const modeDrain =
    (flashlight ? 0.12 : 0) + (camcorder ? 0.09 : 0) + (sprinting ? 0.06 : 0)
  const effectiveDrain = Math.max(0, -fit.slope) + modeDrain
  const hasResourceEvidence = new Set(resourcePoints.map(point => point.x)).size >= 2
  const forecastSeconds =
    hasResourceEvidence && effectiveDrain > 0 ? lastPoint.y / effectiveDrain : Infinity
  const forecastMax = Math.min(
    900,
    lastPoint.x + (Number.isFinite(forecastSeconds) ? forecastSeconds : 120),
  )
  const rule1 = association(
    sessions,
    (s) =>
      s.events.some((e) => e.event === "chase") &&
      s.events.some((e) => e.stamina < 25),
    (s) => s.events.some((e) => e.event === "hide_locker"),
  )
  const rule2 = association(
    sessions,
    (s) => s.events.some((e) => e.event === "corridor"),
    (s) => s.events.some((e) => e.event === "turn_left"),
  )
  const behavioral = useMemo(
    () =>
      kmeans(
        sessions.map((s) => [s.sprint * 100, s.crouch * 100]),
        [
          [80, 10],
          [35, 70],
          [8, 15],
        ],
      ),
    [sessions],
  )
  const segmentNames = [
      "Panicked sprinters",
      "Cautious analysts",
      "Frozen victims",
    ],
    segmentColors = ["var(--c-orange)", "var(--c-green)", "var(--c-purple)"]
  const odds = escapeModel(
    sessions,
    current?.firstClue ?? 35,
    current?.sprint ?? 0.5,
    current?.crouch ?? 0.3,
  )
  const sourceCounts = {
    demo: events.filter((e) => e.source === "demo").length,
    simulation: events.filter((e) => e.source === "simulation").length,
    observed: events.filter(
      (e) => e.source === "manual" || e.source === "import",
    ).length,
  }
  const retrySync = () => {
    retryAfter.current = 0
    setRetry((v) => v + 1)
  }
  function log(kind: EventKind, newSession = false) {
    if (!isAdmin) return
    const id =
      newSession || !manualId || manualEnded
        ? selectedRegistration || `BOOTH-${crypto.randomUUID().slice(0, 8)}`
        : manualId
    const coordinates =
      sector === "A" ? [-24, 8] : sector === "B" ? [0, -14] : [24, -34]
    const elapsed = newSession ? 0 : duration
    const previous = events.filter(
      (e) => e.source === "manual" && e.session_id === id,
    )
    if (
      selectedRegistration &&
      previous.some((e) => e.event === "death" || e.event === "escape")
    ) {
      setNotice(
        "This registered session already has an outcome. Select another session to log.",
      )
      return
    }
    if (previous.some((e) => e.elapsed > elapsed)) {
      setNotice(
        "Session time cannot move backwards. Increase survival time or start a new session.",
      )
      return
    }
    const row = normalizeTelemetry(
      {
        ...makeEvent(id, monster, kind, elapsed, "manual"),
        player_x: coordinates[0],
        player_y: coordinates[1],
        heart_rate_proxy: heart,
        sprint_ratio: sprintRatio / 100,
        crouch_ratio: stealth / 100,
        first_clue: clue,
        battery_level: battery,
        stamina,
        chase_duration: chaseDuration,
        reaction_ms: reaction,
      },
      0,
      "manual",
    )
    add([row])
    setManualId(id)
    setManualEnded(kind === "death" || kind === "escape")
    setNotice(`${id} · ${kind.replace("_", " ").toUpperCase()} logged.`)
  }
  async function importFile(file: File) {
    if (!isAdmin) return
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("File exceeds 2 MB.")
      const rows = parseImport(await file.text(), file.name)
      add(rows)
      setNotice(
        `Imported ${rows.length} valid records from ${file.name}. All are labeled IMPORT.`,
      )
    } catch (error) {
      setNotice(
        `IMPORT REJECTED: ${
          error instanceof Error ? error.message : "Invalid file"
        }`,
      )
    }
    if (fileInput.current) fileInput.current.value = ""
  }
  const sample = () =>
    download(
      "silph-telemetry-sample.csv",
      "session_id,timestamp,player_x,player_y,heart_rate_proxy,active_monster,battery_level,elapsed,event,sprint_ratio,crouch_ratio,first_clue,stamina\nBOOTH-SAMPLE," +
        new Date().toISOString() +
        ",0,-14,125,094,74,60,jumpscare,0.6,0.3,32,25\n",
      "text/csv",
    )
  const rules = [
    {
      n: "01",
      if: "CHASE TRIGGERED + LOW STAMINA",
      then: "HIDE IN LOCKER",
      metrics: rule1,
      advice:
        "Alternate hiding spots. Repeated locker use makes your response predictable.",
    },
    {
      n: "02",
      if: "3-WAY CORRIDOR",
      then: "TURN LEFT",
      metrics: rule2,
      advice: "Pathing bias detected. Vary your route at intersections.",
    },
  ]
  return (
    <PillarProvider view={tab}>
      <div className="companion">
        <header className="c-header">
          <a className="c-brand" href={import.meta.env.BASE_URL}>
            <span className="c-brand-symbol">
              <svg viewBox="0 0 32 32">
                <path
                  d="M4 4h24v7H12v5h16v12H4v-7h16v-5H4Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>
              SILPH CO.<small>ANOMALOUS RESEARCH DIVISION</small>
            </span>
            <span className="c-build">v1.0</span>
          </a>
          <div className="c-header-center">
            <i /> SECTOR 04 <span>/</span> BACKROOMS TELEMETRY SUITE
          </div>
          <div className="c-header-right">
            <BriefingButton />
            <div className="c-account-menu">
              <Badge tone={isAdmin ? "purple" : "green"}>
                {account.role.toUpperCase()}
              </Badge>
              <span>{account.display_name || "PLAYER"}</span>
              <button
                onClick={() => {
                  if (
                    !pending.length ||
                    window.confirm(
                      "Unsynced records will be cleared from this terminal when you sign out. Export them first. Continue?",
                    )
                  )
                    void signOut()
                }}
              >
                SIGN OUT
              </button>
            </div>
            <span>
              {clock.toLocaleTimeString("en-GB", { hour12: false })}{" "}
              <small>LOCAL</small>
            </span>
            <a
              href={`${import.meta.env.BASE_URL}game`}
              target="_blank"
              rel="noreferrer"
            >
              PLAY GAME <Icon name="arrow" size={13} />
            </a>
          </div>
        </header>
        <div className="c-nav-row">
          <nav aria-label="Companion views">
            {TABS.filter((t) => isAdmin || t.id === "dex").map((t, i) => (
              <button
                key={t.id}
                className={tab === t.id ? "is-active" : ""}
                onClick={() => setTab(t.id)}
              >
                <span className="c-tab-number">0{i + 1}</span>
                <Icon name={t.icon} />
                <span>
                  {t.label}
                  <small>{t.sub}</small>
                </span>
                {tab === t.id && <i />}
              </button>
            ))}
          </nav>
          <span className="c-nav-note">
            {isAdmin ? "ADMINISTRATOR CLEARANCE" : "PLAYER CLEARANCE"}{" "}
            <Icon name="arrow" size={12} />
          </span>
        </div>
        <main className="c-main">
          <section className="c-page-heading">
            <div>
              <div className="c-eyebrow">
                <span /> SILPH-BACKROOMS / TELEMETRY & DATA-DEX COMPANION
              </div>
              <h1>
                {tab === "dex"
                  ? "FIELD INTELLIGENCE TERMINAL"
                  : tab === "analytics"
                    ? "BOOTH ANALYTICS OVERVIEW"
                    : "TELEMETRY CONTROL ROOM"}
                <span>_</span>
              </h1>
              <p>
                {tab === "dex"
                  ? "Identify the anomaly. Read the pattern. Survive the encounter."
                  : tab === "analytics"
                    ? "Describe. Diagnose. Predict. Prescribe. Follow the complete evidence cycle."
                    : "Simulate, observe, or import. One validated stream powers every analytical view."}
              </p>
            </div>
            {isAdmin ? (
              <div className="c-page-actions">
                <button
                  className={`c-sim-button ${auto ? "is-running" : ""}`}
                  onClick={() => setAuto((v) => !v)}
                  aria-pressed={auto}
                >
                  <i />
                  <span>
                    {auto
                      ? "LIVE SIMULATION RUNNING"
                      : "AUTO-SIMULATE TELEMETRY"}
                    <small>
                      {auto
                        ? "CLICK TO PAUSE"
                        : "2-SECOND INTERVAL · GENERATED DATA"}
                    </small>
                  </span>
                  <Icon name={auto ? "pulse" : "play"} size={16} />
                </button>
                <button
                  className="c-primary-button"
                  onClick={() => {
                    log("sample", true)
                    setTab("stream")
                  }}
                >
                  <Icon name="plus" size={16} /> LOG NEW BOOTH SESSION
                </button>
              </div>
            ) : (
              <div className="c-page-actions">
                <BriefingButton lobby />
                <a
                  className="c-primary-button"
                  href={`${import.meta.env.BASE_URL}game`}
                >
                  <Icon name="play" size={16} /> CHECK IN & PLAY GAME
                </a>
                <span className="c-small-label">
                  YOUR DISPLAY NAME IS REQUIRED BEFORE PLAY
                </span>
              </div>
            )}
          </section>
          <div className="c-context-bar">
            <div>
              <Badge tone={cloud === "online" ? "green" : auto ? "green" : "yellow"}>
                {cloud === "online"
                  ? "POSTGRESQL DATABASE ACTIVE"
                  : auto
                    ? "SIMULATION LIVE"
                    : scope === "observed"
                      ? "MANUAL / IMPORTED DATA"
                      : "LOCAL RESEARCH DATA"}
              </Badge>
              <span className="c-context-session">
                {current?.id ?? "DB-SESSION"}{" "}
                <span> / {visibleEvents.length.toLocaleString()} DATABASE EVENTS</span>
              </span>
            </div>
            {isAdmin && (
              <div className="c-source-filter">
                <span>DATA SOURCE</span>
                <select
                  aria-label="Analytics data source"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  <option value="all">ALL DATABASE SOURCES</option>
                  <option value="database">POSTGRESQL DATABASE</option>
                  <option value="demo">ILLUSTRATIVE SESSIONS</option>
                  <option value="observed">MANUAL + IMPORTED</option>
                  <option value="simulation">LIVE SIMULATION</option>
                </select>
              </div>
            )}
          </div>
          <PillarFilters view={tab} />
          <Panel
            code="S"
            title="ENVIRONMENTAL SENSOR KPI RIBBON"
            tag="INTERACTIVE REFERENCE SCENARIO / NOT ENGINE TELEMETRY"
            pillar="descriptive"
          >
            <div className="e-sensor-ribbon">
              <div>
                <Icon name="pulse" />
                <span>
                  EMF LEVEL
                  <strong>
                    {emf.toFixed(0)} <small>mG</small>
                  </strong>
                </span>
              </div>
              <div>
                <Icon name="eye" />
                <span>
                  TEMPERATURE
                  <strong>
                    {temperature.toFixed(0)} <small>°C</small>
                  </strong>
                </span>
              </div>
              <div>
                <Icon name="sound" />
                <span>
                  AUDIO LEVEL
                  <strong>
                    {decibels.toFixed(0)} <small>dB</small>
                  </strong>
                </span>
              </div>
              <p>
                Change the Data-Dex sliders to investigate the same scenario
                across the diagnostic and prescriptive modules.
              </p>
            </div>
          </Panel>
          {(tab === "dex" || tab === "analytics") && (
            <DiagnosticDebriefPanel sessions={sessions} isAdmin={isAdmin} />
          )}
          {tab === "dex" && (
            <>
              <div className="c-dex-grid">
                <Panel
                  code="A"
                  title="ANOMALY SIGNATURE IDENTIFIER"
                  tag="K-MEANS CLUSTERING"
                  className="c-threat-panel"
                  pillar="diagnostic"
                >
                  <div className="c-section-intro">
                    <span className="c-small-label">
                      ENVIRONMENTAL SIGNAL SPACE
                    </span>
                    <span>
                      03 SIGNATURE CLUSTERS <i className="c-mini-cross">+</i>
                    </span>
                  </div>
                  <Scatter
                    points={threatSamples.map((p, i) => ({
                      ...project(p.vector),
                      color: SPECIMENS[threatFit.labels[i]].color,
                      label: `#${SPECIMENS[threatFit.labels[i]].id} · reference signature ${i + 1}`,
                    }))}
                    centers={threatFit.centers.map((c, i) => ({
                      ...project(c),
                      color: SPECIMENS[i].color,
                    }))}
                    current={{ ...project(encounter) }}
                    xLabel="NORMALIZED EMF LEVEL (%) →"
                    yLabel="ACOUSTIC / TEMPERATURE-DROP PROJECTION (%) →"
                  />
                  <div className="c-cluster-legend">
                    {SPECIMENS.slice(0, 3).map((s, i) => (
                      <button
                        className={activeIndex === i ? "is-active" : ""}
                        key={s.id}
                        onClick={() => {
                          setEmf(s.vector[0] * 100)
                          setTemperature(40 - s.vector[1] * 60)
                          setDecibels(s.vector[2] * 100)
                        }}
                      >
                        <i style={{ background: s.color }} />#{s.id} {s.type}
                      </button>
                    ))}
                  </div>
                  <div className="c-sliders">
                    {[
                      {
                        label: "EMF LEVEL",
                        value: emf,
                        set: setEmf,
                        min: 0,
                        max: 100,
                        unit: "mG",
                      },
                      {
                        label: "TEMPERATURE",
                        value: temperature,
                        set: setTemperature,
                        min: -20,
                        max: 40,
                        unit: "°C",
                      },
                      {
                        label: "SOUND LEVEL",
                        value: decibels,
                        set: setDecibels,
                        min: 0,
                        max: 100,
                        unit: "dB",
                      },
                    ].map((s) => (
                      <label key={s.label}>
                        <span>
                          {s.label}
                          <b>
                            {s.value.toFixed(0)} <small>{s.unit}</small>
                          </b>
                        </span>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          value={s.value}
                          onChange={(e) => s.set(Number(e.target.value))}
                        />
                        <div>
                          <span>
                            {s.min}
                            {s.unit}
                          </span>
                          <span>
                            {s.max}
                            {s.unit}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="c-threat-result">
                    <div className="c-specimen-sigil">
                      <Icon
                        name={
                          activeIndex === 0
                            ? "pulse"
                            : activeIndex === 1
                              ? "eye"
                              : "sound"
                        }
                        size={35}
                      />
                    </div>
                    <div>
                      <span className="c-small-label">
                        CLOSEST MATCH / SPECIMEN #{active.id}
                      </span>
                      <h3>{active.name.toUpperCase()}</h3>
                      <span className="c-distance">
                        EUCLIDEAN DISTANCE {distances[activeIndex].toFixed(3)} ·
                        NORMALIZED 3D FEATURES
                      </span>
                    </div>
                    <button
                      aria-label="View specimen details"
                      onClick={() => setSelectedSpecimen(activeIndex)}
                    >
                      <Icon name="arrow" size={22} />
                    </button>
                  </div>
                  {isAdmin ? (
                    <div className="c-countermeasure">
                      <Icon name="warning" size={17} />
                      <div>
                        <span>PRESCRIPTIVE COUNTERMEASURE</span>
                        <strong>{active.action}</strong>
                      </div>
                      <Badge tone="red">THREAT IDENTIFIED</Badge>
                    </div>
                  ) : (
                    <div className="e-no-spoiler">
                      <Icon name="target" />
                      <span>
                        Classification is evidence, not an instruction. Commit
                        to a hypothesis in the Analytical Deduction Engine
                        below.
                      </span>
                    </div>
                  )}
                </Panel>
                <Panel
                  code="B"
                  title="RESOURCE SURVIVAL FORECAST"
                  tag="LINEAR REGRESSION"
                  className="c-resource-panel"
                  pillar="predictive"
                >
                  <div className="c-resource-toggle">
                    {(["battery", "sanity"] as const).map((r) => (
                      <button
                        key={r}
                        className={resource === r ? "is-active" : ""}
                        onClick={() => setResource(r)}
                      >
                        <Icon
                          name={r === "battery" ? "battery" : "pulse"}
                          size={13}
                        />
                        {r === "battery" ? "BATTERY" : "SANITY PROXY"}
                      </button>
                    ))}
                  </div>
                  <div className="c-countdown">
                    <span>
                      PREDICTED TIME TO{" "}
                      {resource === "battery" ? "BLACKOUT" : "PROXY DEPLETION"}
                    </span>
                    <strong>{formatTime(forecastSeconds)}</strong>
                    <Badge tone={forecastSeconds < 90 ? "red" : "yellow"}>
                      {!hasResourceEvidence
                        ? "INSUFFICIENT SAMPLES"
                        : forecastSeconds < 90
                        ? "CRITICAL RESERVE"
                        : "MODELED ESTIMATE"}
                    </Badge>
                  </div>
                  <div className="c-equation">
                    {hasResourceEvidence ? <>
                      ŷ = −{effectiveDrain.toFixed(3)}t + {lastPoint.y.toFixed(1)}{" "}
                      <span>t = seconds from latest sample</span>
                    </> : "At least two distinct sample times are required for a fitted forecast."}
                  </div>
                  <LinePlot
                    maxX={Math.max(60, forecastMax)}
                    series={[
                      {
                        name:
                          resource === "battery"
                            ? "Actual battery"
                            : "Sanity proxy",
                        color: "var(--c-yellow)",
                        points: resourcePoints,
                        area: true,
                      },
                      {
                        name: "Scenario forecast",
                        color: "var(--c-red)",
                        points: hasResourceEvidence ? [
                          lastPoint,
                          {
                            x: forecastMax,
                            y: Math.max(
                              0,
                              lastPoint.y -
                                effectiveDrain * (forecastMax - lastPoint.x),
                            ),
                          },
                        ] : [],
                        dashed: true,
                      },
                    ]}
                  />
                  <div className="c-mode-heading">
                    <span>MODEL THE NEXT MOVE</span>
                    <span>USAGE ASSUMPTIONS</span>
                  </div>
                  <div className="c-resource-modes">
                    {[
                      {
                        label: "FLASHLIGHT HIGH",
                        icon: "eye",
                        on: flashlight,
                        set: setFlashlight,
                      },
                      {
                        label: "CAMCORDER ACTIVE",
                        icon: "battery",
                        on: camcorder,
                        set: setCamcorder,
                      },
                      {
                        label: "PLAYER SPRINTING",
                        icon: "pulse",
                        on: sprinting,
                        set: setSprinting,
                      },
                    ].map((m) => (
                      <button
                        key={m.label}
                        aria-pressed={m.on}
                        className={m.on ? "is-active" : ""}
                        onClick={() => m.set((v) => !v)}
                      >
                        <Icon name={m.icon} size={14} />
                        {m.label}
                        <span>{m.on ? "ON" : "OFF"}</span>
                      </button>
                    ))}
                  </div>
                  <p className="c-method">
                    <Icon name="file" size={12} /> OLS fit:{" "}
                    {resourcePoints.length} samples. Scenario drain adds{" "}
                    {modeDrain.toFixed(2)}%/s. Sanity is a heart-rate proxy, not
                    a measured game resource.
                  </p>
                </Panel>
              </div>
              <DeductionEngine
                cluster={activeIndex}
                distance={distances[activeIndex]}
                signature={`${emf}:${temperature}:${decibels}`}
              />
              <Panel
                code="C"
                title="BEHAVIORAL ASSOCIATION TRACKER"
                tag="APRIORI METRICS / FIXED SESSION-BASKET CANDIDATES"
                className="c-rules-panel"
                pillar="prescriptive"
              >
                <div className="c-rules-table">
                  <div className="c-rules-head">
                    <span>OBSERVED RULE</span>
                    <span>SUPPORT</span>
                    <span>CONFIDENCE</span>
                    <span>LIFT</span>
                    <span>PRESCRIPTIVE ADVISORY</span>
                  </div>
                  {rules.map((rule) => (
                    <div className="c-rule-row" key={rule.n}>
                      <div>
                        <small>RULE_{rule.n}</small>
                        <span>
                          <b>IF</b> {rule.if}
                        </span>
                        <span>
                          <b>OBSERVED RESPONSE</b> {rule.then}
                        </span>
                      </div>
                      <strong>
                        {(rule.metrics.support * 100).toFixed(1)}
                        <small>%</small>
                      </strong>
                      <div className="c-confidence">
                        <strong>
                          {(rule.metrics.confidence * 100).toFixed(1)}
                          <small>%</small>
                        </strong>
                        <progress max={1} value={rule.metrics.confidence} />
                      </div>
                      <strong>
                        {rule.metrics.lift.toFixed(2)}
                        <small>×</small>
                      </strong>
                      <p>
                        <Icon name="warning" size={14} />
                        {rule.metrics.count < 5
                          ? "Low support. Collect more sessions before acting."
                          : rule.metrics.confidence > 0.65
                            ? isAdmin
                              ? rule.advice
                              : "What alternative response would test this association? Compare support and lift before proposing a protocol."
                            : "No strong behavioral pattern detected yet."}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="c-card-foot">
                  <i /> CALCULATED FROM {sessions.length} SESSION BASKETS{" "}
                  <span>
                    SUPPORT = A∩B/N · CONFIDENCE = P(B|A) · LIFT = P(B|A)/P(B)
                  </span>
                </div>
              </Panel>
            </>
          )}
          {isAdmin && tab === "analytics" && (
            <>
              <PlayerRoster
                registrations={registrations}
                events={events}
                error={registrationError}
                onRefresh={retrySync}
                onObserve={(id) => {
                  setSelectedRegistration(id)
                  setManualId(id)
                  setManualEnded(false)
                  setDuration(0)
                  setTab("stream")
                }}
              />
              <PillarRegion pillar="descriptive">
                <div className="c-metrics">
                  <Metric
                    label="TELEMETRY SESSION BASKETS"
                    value={`${sessions.length}`}
                    detail={`${completed.length} completed · ${sessions.length - completed.length} active`}
                    icon="terminal"
                  />
                  <Metric
                    label="OBSERVED ESCAPE RATE"
                    value={`${escapeRate.toFixed(1)}%`}
                    detail={`${escaped.length} escapes / ${completed.length} completed sessions`}
                    tone="green"
                    icon="arrow"
                  />
                  <Metric
                    label="DEADLIEST SPECIMEN"
                    value={deaths ? `#${deadliest.id}` : "—"}
                    detail={
                      deaths
                        ? `${deadliest.name} · ${((deadliest.kills / deaths) * 100).toFixed(1)}% of eliminations`
                        : "No eliminations in selected data"
                    }
                    tone="red"
                    icon="warning"
                  />
                  <Metric
                    label="AVG. PANIC INDEX"
                    value={`${mean(sessions.map((s) => s.panic)).toFixed(1)}`}
                    detail="0–100 · heart-rate proxy, not biometrics"
                    tone="purple"
                    icon="pulse"
                  />
                </div>
              </PillarRegion>
              <div className="c-dashboard-grid">
                <Panel
                  code="01"
                  title="SPATIAL INCIDENT DENSITY"
                  tag="DESCRIPTIVE ANALYTICS"
                  pillar="descriptive"
                >
                  <div className="c-filter-pills">
                    {["All telemetry", "Eliminations", "Jumpscares"].map(
                      (f) => (
                        <button
                          key={f}
                          className={heatFilter === f ? "is-active" : ""}
                          onClick={() => setHeatFilter(f)}
                        >
                          {f.toUpperCase()}
                        </button>
                      ),
                    )}
                  </div>
                  <Heatmap events={visibleEvents} filter={heatFilter} />
                </Panel>
                <Panel
                  code="02"
                  title="SURVIVAL & ESCAPE PROBABILITY"
                  tag="PREDICTIVE ANALYTICS"
                  pillar="predictive"
                >
                  <div className="c-survival-layout">
                    <div>
                      <span className="c-small-label">
                        KAPLAN–MEIER / TIME TO ELIMINATION
                      </span>
                      <LinePlot
                        maxX={Math.max(120, ...sessions.map((s) => s.duration))}
                        current={current?.duration}
                        series={[
                          {
                            name: "Survival estimate",
                            color: "var(--c-green)",
                            points: survivalCurve(sessions),
                            area: true,
                          },
                        ]}
                      />
                    </div>
                    <div className="c-odds">
                      <Gauge value={odds} />
                      <span className="c-small-label">
                        CURRENT SESSION / LOGISTIC FIT
                      </span>
                      <dl>
                        <div>
                          <dt>FIRST CLUE</dt>
                          <dd>{current?.firstClue.toFixed(0) ?? "—"}s</dd>
                        </div>
                        <div>
                          <dt>SPRINT RATIO</dt>
                          <dd>{((current?.sprint ?? 0) * 100).toFixed(0)}%</dd>
                        </div>
                        <div>
                          <dt>STEALTH RATIO</dt>
                          <dd>{((current?.crouch ?? 0) * 100).toFixed(0)}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <p className="c-method">
                    Escapes and active sessions are right-censored in the KM
                    curve. Logistic escape estimate is an exploratory fit to
                    selected sessions, not a validated player-safety model.
                  </p>
                </Panel>
                <Panel
                  code="03"
                  title="SPECIMEN ENCOUNTER BREAKDOWN"
                  tag="COMPARATIVE ANALYTICS"
                  pillar="descriptive"
                >
                  <div className="c-comparison-controls">
                    <span className="c-small-label">
                      COMPARE ENCOUNTER OUTCOMES
                    </span>
                    <select
                      aria-label="Specimen comparison metric"
                      value={barMetric}
                      onChange={(e) => setBarMetric(Number(e.target.value))}
                    >
                      <option value="0">KILL RATE (%)</option>
                      <option value="1">CHASE DURATION (S)</option>
                      <option value="2">REACTION LATENCY (MS)</option>
                    </select>
                  </div>
                  <div className="c-comparison">
                    <Bars
                      rows={specimenStats.map((s) => ({
                        name: `#${s.id}`,
                        color: s.color,
                        values: s.values,
                      }))}
                      metric={barMetric}
                    />
                    <RadarChart
                      values={specimenStats.map((s) => [
                        s.values[0],
                        clamp(s.values[1] / 90) * 100,
                        clamp(s.values[2] / 1500) * 100,
                      ])}
                      colors={specimenStats.map((s) => s.color)}
                      labels={["KILL RATE", "CHASE", "LATENCY"]}
                    />
                  </div>
                  <div className="c-specimen-legend">
                    {specimenStats.map((s) => (
                      <span key={s.id}>
                        <i style={{ background: s.color }} />#{s.id}{" "}
                        {s.name.replace("Defective ", "")}
                      </span>
                    ))}
                  </div>
                  <p className="c-method">
                    Radar normalized to 100% kill rate, 90s chase, and 1500ms
                    latency. Bar values retain original units.
                  </p>
                </Panel>
                <Panel
                  code="04"
                  title="PLAYER BEHAVIOR SEGMENTATION"
                  tag="K-MEANS / K = 3"
                  pillar="diagnostic"
                >
                  <Scatter
                    points={sessions.map((s, i) => ({
                      x: s.sprint * 100,
                      y: s.crouch * 100,
                      color: segmentColors[behavioral.labels[i]],
                      size: 3.5,
                      label: `${s.id} · ${s.outcome} · panic ${s.panic.toFixed(0)} · ${s.latest.source}`,
                    }))}
                    centers={behavioral.centers.map((c, i) => ({
                      x: c[0],
                      y: c[1],
                      color: segmentColors[i],
                    }))}
                    xLabel="MOVEMENT SPEED / SPRINT RATIO (%) →"
                    yLabel="STEALTH / CROUCHING RATIO (%) →"
                    onSelect={(p) => setSelectedVisitor(p.label ?? "")}
                  />
                  <div className="c-segments">
                    {segmentNames.map((name, i) => {
                      const group = sessions.filter(
                          (_, j) => behavioral.labels[j] === i,
                        ),
                        finished = group.filter((s) => s.outcome !== "active")
                      return (
                        <div key={name}>
                          <i style={{ background: segmentColors[i] }} />
                          <span>
                            {name}
                            <small>{group.length} VISITORS</small>
                          </span>
                          <strong>
                            {finished.length
                              ? (
                                  (finished.filter(
                                    (s) => s.outcome === "escaped",
                                  ).length /
                                    finished.length) *
                                  100
                                ).toFixed(0)
                              : "—"}
                            <small>% ESCAPE</small>
                          </strong>
                        </div>
                      )
                    })}
                  </div>
                  {selectedVisitor && (
                    <p className="c-selected-visitor">{selectedVisitor}</p>
                  )}
                </Panel>
              </div>
              <PrescriptiveEvidencePanel
                rules={rules.map((rule) => ({
                  label: `${rule.if} → ${rule.then}`,
                  ...rule.metrics,
                }))}
              />
            </>
          )}
          {isAdmin && tab === "stream" && (
            <>
              <div className="c-pipeline">
                {[
                  {
                    icon: "terminal",
                    label: "BOOTH SESSION",
                    sub: "Observer / simulator",
                  },
                  {
                    icon: "stream",
                    label: "JSON EVENT STREAM",
                    sub: "Validated · 2s simulation",
                  },
                  {
                    icon: "database",
                    label: "SUPABASE / POSTGRES",
                    sub:
                      cloud === "online"
                        ? "Connected state store"
                        : cloud === "syncing"
                          ? "Writing event batch"
                          : "Device cache / pending sync",
                  },
                  {
                    icon: "chart",
                    label: "ANALYTICS ENGINE",
                    sub: "K-means · OLS · KM · Rules",
                  },
                ].map((step, i) => (
                  <div key={step.label}>
                    <span className="c-pipeline-icon">
                      <Icon name={step.icon} size={22} />
                    </span>
                    <span>
                      {step.label}
                      <small>{step.sub}</small>
                    </span>
                    {i < 3 && <b>→</b>}
                  </div>
                ))}
              </div>
              <div className="c-stream-grid">
                <Panel
                  code="01"
                  title="QUICK BOOTH LOGGER"
                  tag="MANUAL OBSERVATION"
                  pillar="descriptive"
                >
                  <div className="c-logger">
                    <label>
                      LINK TO REGISTERED PLAYER
                      <select
                        value={selectedRegistration}
                        onChange={(e) => {
                          const id = e.target.value
                          setSelectedRegistration(id)
                          setManualId(id)
                          setManualEnded(false)
                          setDuration(0)
                        }}
                      >
                        <option value="">UNLINKED OBSERVER SESSION</option>
                        {registrations.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.display_name} · {row.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="c-method c-logger-player-note">
                      Select a real check-in to associate observations with that
                      player. Unlinked, simulated, and demo sessions are not
                      attributed to players.
                    </p>
                    <div className="c-logger-session">
                      <span className="c-small-label">
                        CURRENT BOOTH SESSION
                      </span>
                      <strong>{manualId || "NO SESSION STARTED"}</strong>
                      <Badge tone={manualEnded ? "yellow" : "green"}>
                        {manualEnded
                          ? "COMPLETED"
                          : manualId
                            ? "RECORDING"
                            : "READY"}
                      </Badge>
                    </div>
                    <label>
                      ACTIVE SPECIMEN
                      <select
                        value={monster}
                        onChange={(e) => setMonster(e.target.value as Monster)}
                      >
                        {SPECIMENS.map((s) => (
                          <option key={s.id} value={s.id}>
                            #{s.id} — {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="c-form-pair">
                      <label>
                        SURVIVAL TIME (S)
                        <input
                          type="number"
                          min="0"
                          max="3600"
                          value={duration}
                          onChange={(e) =>
                            setDuration(
                              clamp(Number(e.target.value) || 0, 0, 3600),
                            )
                          }
                        />
                      </label>
                      <label>
                        OBSERVED SECTOR
                        <select
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                        >
                          <option>A</option>
                          <option>B</option>
                          <option>C</option>
                        </select>
                      </label>
                    </div>
                    <div className="c-form-pair">
                      <label>
                        HEART-RATE PROXY
                        <input
                          type="number"
                          min="40"
                          max="220"
                          value={heart}
                          onChange={(e) =>
                            setHeart(
                              clamp(Number(e.target.value) || 40, 40, 220),
                            )
                          }
                        />
                      </label>
                      <label>
                        FIRST CLUE (S)
                        <input
                          type="number"
                          min="0"
                          max="3600"
                          value={clue}
                          onChange={(e) =>
                            setClue(clamp(Number(e.target.value) || 0, 0, 3600))
                          }
                        />
                      </label>
                    </div>
                    <div className="c-form-pair">
                      <label>
                        BATTERY LEVEL (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={battery}
                          onChange={(e) =>
                            setBattery(
                              clamp(Number(e.target.value) || 0, 0, 100),
                            )
                          }
                        />
                      </label>
                      <label>
                        STAMINA (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stamina}
                          onChange={(e) =>
                            setStamina(
                              clamp(Number(e.target.value) || 0, 0, 100),
                            )
                          }
                        />
                      </label>
                    </div>
                    <div className="c-form-pair">
                      <label>
                        CHASE DURATION (S)
                        <input
                          type="number"
                          min="0"
                          max="3600"
                          value={chaseDuration}
                          onChange={(e) =>
                            setChaseDuration(
                              clamp(Number(e.target.value) || 0, 0, 3600),
                            )
                          }
                        />
                      </label>
                      <label>
                        REACTION ESTIMATE (MS)
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={reaction}
                          onChange={(e) =>
                            setReaction(
                              clamp(Number(e.target.value) || 0, 0, 10000),
                            )
                          }
                        />
                      </label>
                    </div>
                    <label className="c-form-range">
                      SPRINT RATIO <b>{sprintRatio}%</b>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sprintRatio}
                        onChange={(e) => setSprintRatio(Number(e.target.value))}
                      />
                    </label>
                    <label className="c-form-range">
                      CROUCH / STEALTH <b>{stealth}%</b>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={stealth}
                        onChange={(e) => setStealth(Number(e.target.value))}
                      />
                    </label>
                    <div className="c-log-buttons">
                      <button onClick={() => log("jumpscare")}>
                        <Icon name="pulse" /> LOG JUMPSCARE
                      </button>
                      <button onClick={() => log("chase")}>
                        <Icon name="target" /> LOG CHASE
                      </button>
                      <button
                        className="c-danger-button"
                        onClick={() => log("death")}
                      >
                        <Icon name="warning" /> LOG DEATH · SECTOR {sector}
                      </button>
                      <button
                        className="c-success-button"
                        onClick={() => log("escape")}
                      >
                        <Icon name="check" /> LOG ESCAPE
                      </button>
                      <button onClick={() => log("corridor")}>
                        3-WAY CORRIDOR
                      </button>
                      <button onClick={() => log("turn_left")}>
                        TURNED LEFT
                      </button>
                      <button onClick={() => log("hide_locker")}>
                        HID IN LOCKER
                      </button>
                      <button onClick={() => log("sample")}>LOG SAMPLE</button>
                    </div>
                    <p className="c-method">
                      Observer-entered proxies, not engine measurements. Sector
                      positions use representative coordinates. No names,
                      emails, or biometric data are collected.
                    </p>
                  </div>
                </Panel>
                <Panel
                  code="02"
                  title="LIVE JSON PAYLOAD STREAM"
                  tag={auto ? "SIMULATION / 2s" : "LATEST VALIDATED EVENTS"}
                  className="c-json-panel"
                  pillar="descriptive"
                >
                  <div className="c-json-toolbar">
                    <span>
                      <i />
                      {visibleEvents.length} RECORDS · NEWEST FIRST
                    </span>
                    <button
                      onClick={() =>
                        download(
                          "silph-telemetry.json",
                          JSON.stringify(visibleEvents, null, 2),
                        )
                      }
                    >
                      <Icon name="upload" size={13} /> EXPORT JSON
                    </button>
                  </div>
                  <div
                    className="c-json-stream"
                    role="log"
                    aria-label="Latest telemetry payloads"
                  >
                    {visibleEvents
                      .slice(-8)
                      .reverse()
                      .map((e) => (
                        <div className="c-json-entry" key={e.id}>
                          <div>
                            <Badge
                              tone={
                                e.source === "manual" || e.source === "import"
                                  ? "green"
                                  : "yellow"
                              }
                            >
                              {e.source.toUpperCase()}
                            </Badge>
                            <span>
                              {new Date(e.timestamp).toLocaleTimeString(
                                "en-GB",
                              )}
                            </span>
                            <b>{e.event.toUpperCase()}</b>
                          </div>
                          <pre>{JSON.stringify(e, null, 2)}</pre>
                        </div>
                      ))}
                    {!visibleEvents.length && (
                      <div className="c-empty">
                        No records in this data source. Start a session or
                        upload a log.
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
              <Panel
                code="03"
                title="CSV / JSON INGESTION"
                tag="VALIDATED IMPORT PIPELINE"
                pillar="descriptive"
              >
                <div
                  className="c-import-area"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) void importFile(file)
                  }}
                >
                  <Icon name="upload" size={28} />
                  <div>
                    <strong>BRING YOUR OWN TELEMETRY</strong>
                    <p>
                      Drop a CSV or JSON log here. Up to 2 MB / 5,000 rows.
                      Valid records update every view and queue for cloud
                      storage.
                    </p>
                  </div>
                  <button
                    className="c-primary-button"
                    onClick={() => fileInput.current?.click()}
                  >
                    CHOOSE FILE <Icon name="arrow" size={14} />
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,.csv,application/json,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void importFile(file)
                    }}
                    hidden
                  />
                </div>
                <div className="c-import-foot">
                  <button onClick={sample}>
                    <Icon name="file" size={13} /> DOWNLOAD SAMPLE CSV
                  </button>
                  <span>
                    REQUIRED: session_id · timestamp · player_x · player_y ·
                    heart_rate_proxy · active_monster · battery_level
                  </span>
                </div>
              </Panel>
            </>
          )}
          <section className="c-provenance">
            <Icon name="file" size={16} />
            <div>
              <strong>TRANSPARENT BY DESIGN.</strong>
              <p>
                Demo and simulation records are synthetic. Manual records are
                observer estimates; imports retain the supplied measurements.
                The game engine is not connected to this terminal. Player
                check-ins record names and session starts, not gameplay
                outcomes. Models are exploratory and have not been validated.
              </p>
            </div>
            <div className="c-provenance-count">
              <span>
                {sourceCounts.demo}
                <small>DEMO</small>
              </span>
              <span>
                {sourceCounts.simulation}
                <small>SIMULATED</small>
              </span>
              <span>
                {sourceCounts.observed}
                <small>MANUAL / IMPORT</small>
              </span>
            </div>
          </section>
        </main>
        <footer className="c-footer">
          <span>
            <i className={cloud === "offline" ? "is-offline" : ""} />
            {!isAdmin
              ? "PLAYER ACCESS · ILLUSTRATIVE REFERENCE DATA"
              : cloud === "online"
                ? "SUPABASE CONNECTED"
                : cloud === "syncing"
                  ? "SYNCING TO SUPABASE"
                  : cloud === "connecting"
                    ? "CONNECTING TO SUPABASE"
                    : "DEVICE CACHE · CLOUD OFFLINE"}
            {isAdmin && (
              <span>
                {pending.length
                  ? `${pending.length} RECORDS PENDING`
                  : cloud === "online"
                    ? "ALL NEW RECORDS SYNCED"
                    : "NO RECORDS QUEUED"}
              </span>
            )}
          </span>
          {isAdmin && cloudError && (
            <button title={cloudError} onClick={retrySync}>
              RETRY CLOUD SYNC <Icon name="arrow" size={11} />
            </button>
          )}
          <span>
            DISPLAY NAMES ONLY · ADMIN-RESTRICTED ANALYTICS <b>●</b> SILPH
            RESEARCH / 1998—2026
          </span>
        </footer>
        {notice && (
          <div className="c-toast" role="status">
            <Icon
              name={notice.startsWith("IMPORT REJECTED") ? "warning" : "check"}
            />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {selectedSpecimen !== null && (
          <div
            className="c-modal-backdrop"
            onClick={() => setSelectedSpecimen(null)}
          >
            <section
              className="c-specimen-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Specimen field record"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="c-panel-heading">
                <span className="c-panel-code">DEX</span>
                <h2>RESTRICTED FIELD RECORD</h2>
                <button
                  onClick={() => setSelectedSpecimen(null)}
                  aria-label="Close specimen record"
                >
                  ×
                </button>
              </div>
              <div className="c-modal-body">
                <Badge tone="red">CONTAINMENT FAILURE</Badge>
                <div className="c-modal-sigil">
                  <Icon name="target" size={90} />
                </div>
                <span className="c-small-label">
                  SPECIMEN #{SPECIMENS[selectedSpecimen].id} /{" "}
                  {SPECIMENS[selectedSpecimen].type}
                </span>
                <h2>{SPECIMENS[selectedSpecimen].alias}</h2>
                <h3>{SPECIMENS[selectedSpecimen].name}</h3>
                <p>{SPECIMENS[selectedSpecimen].note}</p>
                <div className="c-countermeasure">
                  <Icon name="warning" />
                  <strong>
                    {isAdmin
                      ? SPECIMENS[selectedSpecimen].action
                      : DIAGNOSTIC_QUESTIONS[Math.min(selectedSpecimen, 2)]}
                  </strong>
                </div>
                <p className="c-method">
                  Reference classification for this exhibition. No automated
                  game control is performed.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </PillarProvider>
  )
}
