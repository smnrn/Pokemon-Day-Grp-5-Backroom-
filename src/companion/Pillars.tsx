import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { PILLARS, type Pillar } from "./education-model"
import "./education.css"

const PillarContext = createContext<{
  selected: Pillar | "all"
  select: (value: Pillar | "all") => void
}>({ selected: "all", select: () => {} })
export function PillarProvider({
  children,
  view,
}: {
  children: ReactNode
  view: string
}) {
  const [selected, select] = useState<Pillar | "all">("all")
  useEffect(() => select("all"), [view])
  return (
    <PillarContext.Provider value={{ selected, select }}>
      {children}
    </PillarContext.Provider>
  )
}
export function usePillarVisibility(pillar?: Pillar | Pillar[]) {
  const { selected } = useContext(PillarContext)
  return (
    !pillar ||
    selected === "all" ||
    (Array.isArray(pillar) ? pillar : [pillar]).includes(selected)
  )
}
export function PillarExplanation({ pillar }: { pillar: Pillar }) {
  const row = PILLARS[pillar]
  return (
    <details className={`e-pillar e-${pillar}`}>
      <summary>
        <span>
          {row.number} // {row.name} ANALYTICS
        </span>
        <span>{row.question}</span>
        <b>HOW THIS WORKS +</b>
      </summary>
      <p>{row.explanation}</p>
    </details>
  )
}
export function PillarFilters({ view }: { view: string }) {
  const { selected, select } = useContext(PillarContext)
  const empty =
    view === "stream" &&
    (selected === "predictive" || selected === "diagnostic")
  return (
    <section className="e-framework" aria-label="Four pillars of analytics">
      <div className="e-framework-title">
        <span>THE FOUR PILLARS OF ANALYTICS</span>
        <small>YEAR 03 / APPLIED FIELD RESEARCH</small>
      </div>
      <div
        className="e-pillar-filters"
        role="group"
        aria-label="Filter modules by analytics pillar"
      >
        <button aria-pressed={selected === "all"} onClick={() => select("all")}>
          ALL PILLARS
        </button>
        {(Object.keys(PILLARS) as Pillar[]).map((key) => (
          <button
            key={key}
            className={`e-${key}`}
            aria-pressed={selected === key}
            onClick={() => select(key)}
          >
            <b>{PILLARS[key].number}</b>
            {PILLARS[key].name}
            <small>{PILLARS[key].question}</small>
          </button>
        ))}
      </div>
      <p>
        {selected === "all"
          ? "Follow the evidence: describe → diagnose → predict → prescribe. Expand any badge to inspect its method."
          : `Showing ${PILLARS[selected].name.toLowerCase()} modules. Filters change the teaching view, not your data source or permissions.`}
      </p>
      {empty && (
        <p className="e-empty-filter">
          This operator view collects records. Open the Data-Dex or Analytics
          Dashboard for {selected} analysis, or select All Pillars.
        </p>
      )}
    </section>
  )
}
export function PillarRegion({
  pillar,
  children,
  className = "",
}: {
  pillar: Pillar
  children: ReactNode
  className?: string
}) {
  if (!usePillarVisibility(pillar)) return null
  return (
    <section className={`e-region ${className}`} data-pillar={pillar}>
      <PillarExplanation pillar={pillar} />
      {children}
    </section>
  )
}
