import {
  normalizeBatch,
  type Telemetry,
  type Monster,
  type EventKind,
  type Source,
} from "../../supabase/functions/server/telemetry.ts"
export type { Telemetry, Monster, EventKind, Source }
export const SPECIMENS = [
  {
    id: "025" as Monster,
    name: "Defective Pikachu",
    alias: "THE STATIC",
    color: "var(--c-yellow)",
    vector: [0.86, 0.32, 0.4],
    action: "Cut flashlight power immediately.",
    note: "Electrical discharge intensifies around active light sources.",
    type: "ELECTROMAGNETIC",
  },
  {
    id: "094" as Monster,
    name: "Gengar / Haunter",
    alias: "THE AFTERIMAGE",
    color: "var(--c-purple)",
    vector: [0.3, 0.92, 0.06],
    action: "Maintain visual contact. Do not stop moving.",
    note: "A sudden temperature collapse with almost no acoustic signature.",
    type: "SPECTRAL",
  },
  {
    id: "934" as Monster,
    name: "Defective Garganacl",
    alias: "THE LISTENER",
    color: "var(--c-orange)",
    vector: [0.24, 0.35, 0.88],
    action: "Crouch. Keep noise below 20 dB.",
    note: "Blind, but responsive to footsteps and acoustic vibration.",
    type: "ACOUSTIC",
  },
  {
    id: "823" as Monster,
    name: "Defective Corviknight",
    alias: "THE WATCHER",
    color: "var(--c-blue)",
    vector: [0.48, 0.58, 0.67],
    action: "Break line of sight and avoid open corridors.",
    note: "Tracks fast movement across long, unobstructed sightlines.",
    type: "VISUAL",
  },
]
export const mean = (numbers: number[]) =>
  numbers.length ? numbers.reduce((s, n) => s + n, 0) / numbers.length : 0
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n))
export function regression(points: {
  x: number
  y: number
}[]) {
  const x = mean(points.map((p) => p.x)),
    y = mean(points.map((p) => p.y))
  const denominator = points.reduce((s, p) => s + (p.x - x) ** 2, 0)
  const slope = denominator
    ? points.reduce((s, p) => s + (p.x - x) * (p.y - y), 0) / denominator
    : 0
  return { slope, intercept: y - slope * x }
}
export function kmeans(
  points: number[][],
  initial: number[][],
  iterations = 30,
) {
  let centers = initial.map((p) => [...p]),
    labels: number[] = []
  for (let pass = 0; pass < iterations; pass++) {
    labels = points.map((point) =>
      centers
        .map((center) => Math.hypot(...point.map((n, i) => n - center[i])))
        .reduce((best, d, i, ds) => (d < ds[best] ? i : best), 0),
    )
    const updated = centers.map((center, i) =>
      center.map((_, axis) => {
        const values = points
          .filter((_, j) => labels[j] === i)
          .map((p) => p[axis])
        return values.length ? mean(values) : center[axis]
      }),
    )
    if (
      updated.every((c, i) =>
        c.every((v, j) => Math.abs(v - centers[i][j]) < 1e-6),
      )
    )
      break
    centers = updated
  }
  return { centers, labels }
}
export type Session = {
  id: string
  events: Telemetry[]
  latest: Telemetry
  duration: number
  outcome: "escaped" | "eliminated" | "active"
  panic: number
  sprint: number
  crouch: number
  firstClue: number
}
export function sessionsFrom(events: Telemetry[]): Session[] {
  const groups = new Map<string, Telemetry[]>()
  events.forEach((event) => {
    const group = groups.get(event.session_id) ?? []
    group.push(event)
    groups.set(event.session_id, group)
  })
  return [...groups].map(([id, rows]) => {
    const events = rows.sort(
      (a, b) =>
        a.elapsed - b.elapsed ||
        Date.parse(a.timestamp) - Date.parse(b.timestamp),
    )
    const latest = events[events.length - 1]
    const ending = [...events]
      .reverse()
      .find((e) => e.event === "death" || e.event === "escape")
    return {
      id,
      events,
      latest,
      duration: Math.max(...events.map((e) => e.elapsed)),
      outcome:
        ending?.event === "escape"
          ? "escaped"
          : ending
            ? "eliminated"
            : "active",
      panic: mean(
        events.map((e) => clamp((e.heart_rate_proxy - 60) / 140) * 100),
      ),
      sprint: mean(events.map((e) => e.sprint_ratio)),
      crouch: mean(events.map((e) => e.crouch_ratio)),
      firstClue: latest.first_clue,
    }
  })
}
export function association(
  sessions: Session[],
  antecedent: (s: Session) => boolean,
  consequent: (s: Session) => boolean,
) {
  const a = sessions.filter(antecedent).length,
    b = sessions.filter(consequent).length,
    both = sessions.filter((s) => antecedent(s) && consequent(s)).length
  const confidence = a ? both / a : 0
  return {
    support: sessions.length ? both / sessions.length : 0,
    confidence,
    lift: b ? confidence / (b / sessions.length) : 0,
    count: both,
    total: sessions.length,
  }
}
export function survivalCurve(sessions: Session[]) {
  let atRisk = sessions.length,
    probability = 1
  const curve = [{ x: 0, y: 100 }]
  for (const time of [...new Set(sessions.map((s) => s.duration))].sort(
    (a, b) => a - b,
  )) {
    const group = sessions.filter((s) => s.duration === time),
      deaths = group.filter((s) => s.outcome === "eliminated").length
    curve.push({ x: time, y: probability * 100 })
    if (atRisk) probability *= 1 - deaths / atRisk
    curve.push({ x: time, y: probability * 100 })
    atRisk -= group.length
  }
  return curve
}
export function escapeModel(
  sessions: Session[],
  firstClue: number,
  sprint: number,
  crouch: number,
) {
  const rows = sessions.filter((s) => s.outcome !== "active")
  if (
    rows.length < 8 ||
    !rows.some((s) => s.outcome === "escaped") ||
    !rows.some((s) => s.outcome === "eliminated")
  )
    return null
  const weights = [0, 0, 0, 0]
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-clamp(x, -25, 25)))
  for (let epoch = 0; epoch < 400; epoch++) {
    const gradient = [0, 0, 0, 0]
    for (const s of rows) {
      const x = [1, s.firstClue / 120, s.sprint, s.crouch],
        error =
          sigmoid(x.reduce((n, v, i) => n + v * weights[i], 0)) -
          (s.outcome === "escaped" ? 1 : 0)
      gradient.forEach((_, i) => (gradient[i] += error * x[i]))
    }
    weights.forEach(
      (_, i) =>
        (weights[i] -=
          0.15 * (gradient[i] / rows.length + (i ? 0.02 * weights[i] : 0))),
    )
  }
  return sigmoid(
    [1, firstClue / 120, sprint, crouch].reduce(
      (n, v, i) => n + v * weights[i],
      0,
    ),
  )
}
export function mergeEvents(current: Telemetry[], incoming: Telemetry[]) {
  const byId = new Map(current.map((e) => [e.id, e]))
  incoming.forEach((e) => byId.set(e.id, e))
  return [...byId.values()]
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-5000)
}
export function demoEvents(): Telemetry[] {
  let seed = 94025
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const rows: Telemetry[] = [],
    base = Date.now() - 3600000 * 4
  for (let i = 0; i < 64; i++) {
    const cluster = i % 3,
      sprint =
        cluster === 0
          ? 0.65 + random() * 0.3
          : cluster === 1
            ? 0.18 + random() * 0.3
            : random() * 0.16
    const crouch = cluster === 1 ? 0.5 + random() * 0.4 : random() * 0.26
    const escaped = i % 9 === 1 || i % 9 === 4,
      duration = 50 + Math.floor(random() * 230),
      monster = (["025", "094", "094", "934", "823"] as Monster[])[i % 5]
    const session = `DEMO-${String(i + 1).padStart(3, "0")}`,
      firstClue = cluster === 1 ? 12 + random() * 28 : 50 + random() * 80
    for (let j = 0; j < 6; j++) {
      const elapsed = Math.round((duration * j) / 5),
        event: EventKind =
          j === 5
            ? escaped
              ? "escape"
              : "death"
            : j === 2
              ? "chase"
              : j === 3 && i % 5 !== 0
                ? "hide_locker"
                : j === 1
                  ? "corridor"
                  : j === 4 && i % 4 !== 0
                    ? "turn_left"
                    : "sample"
      rows.push({
        id: `${session}-${j}`,
        session_id: session,
        timestamp: new Date(base + i * 180000 + elapsed * 1000).toISOString(),
        player_x: clamp(
          Math.round(random() * 8 - 4) * 8 + random() * 3 - 1.5,
          -35,
          35,
        ),
        player_y: 14 - Math.floor(random() * 8) * 8 + random() * 2 - 1,
        heart_rate_proxy: 70 + sprint * 80 + random() * 25,
        active_monster: monster,
        battery_level: clamp(100 - elapsed * 0.29 + random() * 5, 0, 100),
        stamina:
          j >= 2 && cluster !== 1 ? 8 + random() * 15 : 45 + random() * 45,
        elapsed,
        sprint_ratio: sprint,
        crouch_ratio: crouch,
        first_clue: firstClue,
        chase_duration: 14 + random() * 45,
        reaction_ms:
          cluster === 1 ? 220 + random() * 200 : 450 + random() * 600,
        event,
        source: "demo",
      })
    }
  }
  return rows
}
export function makeEvent(
  session: string,
  monster: Monster = "094",
  kind: EventKind = "sample",
  elapsed = 0,
  source: Source = "manual",
  previous?: Telemetry,
): Telemetry {
  const random = source === "manual" ? () => 0.5 : Math.random
  return {
    id: crypto.randomUUID(),
    session_id: session,
    timestamp: new Date().toISOString(),
    player_x: clamp((previous?.player_x ?? 0) + (random() - 0.5) * 9, -35, 35),
    player_y: clamp((previous?.player_y ?? 10) - random() * 5, -45, 17),
    heart_rate_proxy: Math.round(85 + random() * 95),
    active_monster: monster,
    battery_level: clamp(
      (previous?.battery_level ?? 100) - random() * 2,
      0,
      100,
    ),
    stamina: kind === "chase" ? 15 : Math.round(random() * 80 + 10),
    elapsed,
    sprint_ratio: previous?.sprint_ratio ?? random(),
    crouch_ratio: previous?.crouch_ratio ?? random() * 0.6,
    first_clue: previous?.first_clue ?? Math.round(random() * 75 + 10),
    chase_duration: Math.round(random() * 50 + 10),
    reaction_ms: Math.round(random() * 700 + 200),
    event: kind,
    source,
  }
}
export function parseCSV(text: string) {
  const rows: string[][] = []
  let row: string[] = [],
    field = "",
    quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (!quoted && field.length) throw new Error("Invalid CSV quote.")
      else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(field)
      field = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  if (quoted) throw new Error("Unclosed quote in CSV.")
  row.push(field)
  if (row.some(Boolean)) rows.push(row)
  const headers =
    rows.shift()?.map((h) => h.trim().replace(/^\uFEFF/, "")) ?? []
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV headers must be unique.")
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`CSV row ${i + 2} has the wrong column count.`)
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]))
  })
}
export function parseImport(text: string, filename: string) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new Error("File exceeds the 2 MB limit.")
  const input = filename.toLowerCase().endsWith(".csv")
    ? parseCSV(text)
    : JSON.parse(text.replace(/^\uFEFF/, ""))
  return normalizeBatch(input, "import")
}
export function formatTime(seconds: number) {
  return !Number.isFinite(seconds)
    ? "—"
    : `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}m ${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}s`
}
