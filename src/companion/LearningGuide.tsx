import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Badge, Icon, Panel } from "./UI"
import {
  DIAGNOSTIC_QUESTIONS,
  HYPOTHESES,
  LEARNING_OVERLAY_EVENT,
  PILLARS,
  TAKEAWAY,
  behaviorArchetype,
  hypothesisImpact,
  learningRunFromSession,
  runBatteryForecast,
  type LearningRun,
  type Pillar,
} from "./education-model"
import { PillarExplanation } from "./Pillars"
import { formatTime, type Session } from "./analytics"
import "./education.css"

function LearningDialog({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  drawer?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    if (!dialog) return
    if (document.pointerLockElement) document.exitPointerLock()
    dialog.showModal()
    window.dispatchEvent(
      new CustomEvent(LEARNING_OVERLAY_EVENT, { detail: { open: true } }),
    )
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      dialog.close()
      window.dispatchEvent(
        new CustomEvent(LEARNING_OVERLAY_EVENT, { detail: { open: false } }),
      )
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return createPortal(
    <dialog
      ref={ref}
      className={`companion e-dialog ${drawer ? "e-drawer" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <div className="e-dialog-head">
        <span>RESEARCH TRAINING / SECTOR 04</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close learning guide"
        >
          ×
        </button>
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>,
    document.body,
  )
}
export function BriefingButton({ lobby = false }: { lobby?: boolean }) {
  const [open, setOpen] = useState(false),
    [drawer, setDrawer] = useState(false),
    [card, setCard] = useState<number | null>(null)
  return (
    <>
      <button
        type="button"
        className={`e-briefing-button ${lobby ? "e-lobby-button" : ""}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="book" size={15} />
        FIELD BRIEFING & RULES
      </button>
      {open && (
        <LearningDialog
          title="FIELD RESEARCHER BRIEFING"
          drawer={drawer}
          onClose={() => setOpen(false)}
        >
          <div className="e-briefing-tools">
            <Badge tone="yellow">SPOILER-FREE / THIRD-YEAR FIELD GUIDE</Badge>
            <button type="button" onClick={() => setDrawer((v) => !v)}>
              {drawer ? "EXPAND BRIEFING" : "OPEN AS FIELD DRAWER"}{" "}
              <Icon name="arrow" size={13} />
            </button>
          </div>
          <div className="e-briefing-cards">
            {[
              {
                title: "OBJECTIVE",
                icon: "target",
                text: "Escape Sector 04 by interpreting live telemetry rather than blind trial-and-error.",
                detail:
                  "In the playable maze, rescue all three Pokémon, then reach the unlocked exit and interact. Use observations to justify decisions. Companion sensor exercises are reference scenarios—not a live engine feed.",
              },
              {
                title: "CORE MECHANICS",
                icon: "chart",
                text: "Read Environmental Sensors → Diagnose the Specimen Cluster → Monitor Predictive Battery Slope → Execute Prescriptive Countermeasures.",
                detail:
                  "WASD / arrows move; mouse or drag looks; Shift sprints; E interacts; F toggles light; R toggles radar; M opens the map. Flashlight and radar share a finite battery. Pursuit escalates as rescues progress. There is no crouch control in the current game: crouching choices in the companion are hypothetical training variables.",
              },
              {
                title: "THE GOLDEN RULE",
                icon: "eye",
                text: "The Data-Dex will never give you a direct spoiler. Analyze scatter plots, regression slopes, and probability metrics to deduce a survival action.",
                detail:
                  "Form a hypothesis first, change one variable, then compare evidence. No hidden item positions, routes, or guaranteed winning actions are revealed. Simulated probability changes are lesson assumptions, not measured effects in the game.",
              },
            ].map((row, index) => (
              <article
                className={card === index ? "is-open" : ""}
                key={row.title}
              >
                <span className="e-briefing-number">0{index + 1}</span>
                <Icon name={row.icon} size={25} />
                <h3>{row.title}</h3>
                <p>{row.text}</p>
                <button
                  type="button"
                  aria-expanded={card === index}
                  onClick={() => setCard(card === index ? null : index)}
                >
                  {card === index
                    ? "CLOSE FIELD NOTES −"
                    : "EXPAND FIELD NOTES +"}
                </button>
                {card === index && (
                  <p className="e-card-detail">{row.detail}</p>
                )}
              </article>
            ))}
          </div>
          <div className="e-briefing-pillars">
            {(Object.keys(PILLARS) as Pillar[]).map((pillar) => (
              <PillarExplanation key={pillar} pillar={pillar} />
            ))}
          </div>
          <div className="e-study-prompt">
            <Icon name="file" />
            <p>
              <strong>RESEARCHER’S CHECKPOINT</strong>What do you observe? What
              could explain it? What happens if the trend continues? Which
              trade-off will you test next?
            </p>
          </div>
        </LearningDialog>
      )}
    </>
  )
}

export function DeductionEngine({
  cluster,
  distance,
  signature,
}: {
  cluster: number
  distance: number
  signature: string
}) {
  const [choice, setChoice] = useState<number | null>(null)
  useEffect(() => setChoice(null), [signature, cluster])
  const impact = choice === null ? null : hypothesisImpact(cluster, choice)
  return (
    <Panel
      code="D"
      title="ANALYTICAL DEDUCTION ENGINE"
      tag="SOCRATIC MODE / SCENARIO EXERCISE"
      pillar={["diagnostic", "prescriptive"]}
      className="e-deduction"
    >
      <div className="e-deduction-body">
        <div className="e-step">
          <b>01</b>
          <div>
            <span>DIAGNOSTIC PROMPT</span>
            <p>
              Your highlighted point is{" "}
              <strong>{distance.toFixed(2)} units</strong> from Cluster{" "}
              {String.fromCharCode(65 + cluster)}’s centroid in normalized 3D
              feature space.
            </p>
            <p>{DIAGNOSTIC_QUESTIONS[cluster]}</p>
          </div>
        </div>
        <div className="e-step">
          <b>02</b>
          <div>
            <span>COMMIT TO A TESTABLE HYPOTHESIS</span>
            <div
              className="e-hypotheses"
              role="group"
              aria-label="Operational hypotheses"
            >
              {HYPOTHESES[cluster].map((option, index) => (
                <button
                  key={option.label}
                  aria-pressed={choice === index}
                  onClick={() => setChoice(index)}
                >
                  {option.label}
                  <Icon name={choice === index ? "check" : "arrow"} size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="e-step">
          <b>03</b>
          <div>
            <span>PRESCRIPTIVE FEEDBACK / SIMULATED ONLY</span>
            {impact ? (
              <div className="e-feedback" role="status">
                <div className="e-scenario-gauge">
                  <strong>
                    {impact.probability.toFixed(0)}
                    <small>%</small>
                  </strong>
                  <span>
                    {impact.delta > 0 ? "+" : ""}
                    {impact.delta} PERCENTAGE POINTS
                  </span>
                  <progress max={100} value={impact.probability} />
                  <small>
                    ASSUMED BASELINE {impact.baseline}% · NOT AN EMPIRICAL
                    PREDICTION
                  </small>
                </div>
                <p>{impact.reasoning}</p>
                <p>
                  <strong>Trade-off:</strong> {impact.cost}
                </p>
              </div>
            ) : (
              <p className="e-awaiting">
                Choose an intervention to reveal its modeled consequences. No
                preferred action is shown before your hypothesis.
              </p>
            )}
          </div>
        </div>
        <details className="e-decision-matrix">
          <summary>DECISION SUPPORT MATRIX / COMPARE TRADE-OFFS</summary>
          <table>
            <thead>
              <tr>
                <th>HYPOTHESIS</th>
                <th>RESOURCE / INFORMATION TRADE-OFF</th>
                <th>SCENARIO EFFECT</th>
              </tr>
            </thead>
            <tbody>
              {HYPOTHESES[cluster].map((option) => (
                <tr key={option.label}>
                  <td>{option.label}</td>
                  <td>{option.cost}</td>
                  <td>
                    {impact
                      ? `${option.delta > 0 ? "+" : ""}${option.delta} pp`
                      : "COMMIT A HYPOTHESIS FIRST"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            The effect sizes are authored training assumptions. They do not
            update the independently fitted logistic escape model or the game
            engine.
          </p>
        </details>
      </div>
    </Panel>
  )
}

function DebriefContent({ run }: { run: LearningRun }) {
  const [answer, setAnswer] = useState<number | null>(null)
  const forecast = runBatteryForecast(run)
  return (
    <div className="e-debrief">
      <div className="e-debrief-meta">
        <Badge tone={run.outcome === "escaped" ? "green" : "red"}>
          {run.outcome.toUpperCase()}
        </Badge>
        <span>{run.id}</span>
        <Badge tone="yellow">{run.source.toUpperCase()}</Badge>
      </div>
      <div className="e-debrief-summary">
        <div>
          <span>PLAYER ARCHETYPE / NEAREST REFERENCE CENTROID</span>
          <strong>{behaviorArchetype(run.sprint, run.crouch)}</strong>
          <small>
            Behavioral label, not a personality assessment.{" "}
            {run.crouch === null
              ? "Sprint-only classification; crouching is not measured."
              : "Sprint and crouch ratios are the supplied features."}
          </small>
        </div>
        <div>
          <span>RUN DURATION</span>
          <strong>{formatTime(run.duration)}</strong>
          <small>
            {run.sprint === null
              ? "No movement evidence"
              : `${(run.sprint * 100).toFixed(1)}% sprint ratio`}
          </small>
        </div>
      </div>
      <PillarExplanation pillar="descriptive" />
      <p className="e-debrief-note">
        Summarize first: {run.timeline.length} recorded milestones,{" "}
        {run.battery.length} battery samples.{" "}
        {run.source.includes("demo") || run.source.includes("simulation")
          ? "This is synthetic training data, not the signed-in player’s run."
          : "Only the supplied/local observations are analyzed."}
      </p>
      <PillarExplanation pillar="diagnostic" />
      <h3>DIAGNOSTIC ROOT-CAUSE TIMELINE</h3>
      <p className="e-debrief-note">{run.diagnostic}</p>
      <ol className="e-timeline">
        {run.timeline.map((moment, index) => (
          <li key={`${moment.elapsed}-${index}`}>
            <time>{formatTime(moment.elapsed)}</time>
            <div>
              <strong>{moment.label}</strong>
              <span>{moment.evidence}</span>
            </div>
          </li>
        ))}
      </ol>
      <PillarExplanation pillar="predictive" />
      <p className="e-debrief-note">
        {forecast
          ? `OLS battery slope m = ${forecast.slope.toFixed(3)}%/s. ${
              forecast.seconds === null
                ? "No decreasing trend: a finite blackout time is not supported."
                : `At the final sample, constant-drain extrapolation estimates ${formatTime(forecast.seconds)} remaining.`
            }`
          : "Insufficient distinct battery timestamps for a meaningful slope. Collect at least two samples."}{" "}
        No escape probability is invented for an individual record.
      </p>
      <PillarExplanation pillar="prescriptive" />
      <p className="e-debrief-note">
        Design the next trial: name one variable you would change, state the
        resource trade-off, and specify the signal you would compare. A single
        run cannot establish an optimal protocol.
      </p>
      <section className="e-takeaway">
        <span>ANALYTICAL TAKEAWAY / 1 QUESTION</span>
        <h3>{TAKEAWAY.question}</h3>
        <div role="group" aria-label="Analytical takeaway answer">
          {TAKEAWAY.options.map((option, index) => (
            <button
              key={option}
              aria-pressed={answer === index}
              onClick={() => setAnswer(index)}
            >
              <b>{String.fromCharCode(65 + index)}</b>
              {option}
            </button>
          ))}
        </div>
        {answer !== null && (
          <p role="status" className={answer === 0 ? "is-correct" : ""}>
            {answer === 0
              ? "1 / 1 — Evidence-led reasoning. Descriptive summaries establish observations; diagnostic comparisons test explanations; predictive models estimate scenarios; prescriptive reasoning weighs interventions."
              : "0 / 1 — Revisit the distinction between association and causation. Which option checks evidence and forecasts a scenario before recommending an action? Try again."}
          </p>
        )}
      </section>
      <p className="e-debrief-note">
        Reflection answers remain on this page only; no grade or new account
        record is stored.
      </p>
    </div>
  )
}
export function RunDebriefButton({ run }: { run: LearningRun }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="e-debrief-button"
        onClick={() => setOpen(true)}
      >
        <Icon name="chart" size={15} />
        GENERATE POST-RUN DEBRIEF
      </button>
      {open && (
        <LearningDialog
          title="LEARNING & DIAGNOSTIC DEBRIEF"
          onClose={() => setOpen(false)}
        >
          <DebriefContent run={run} />
        </LearningDialog>
      )}
    </>
  )
}
export function DiagnosticDebriefPanel({
  sessions,
  isAdmin,
}: {
  sessions: Session[]
  isAdmin: boolean
}) {
  const completed = sessions.filter((session) => session.outcome !== "active")
  const [selected, setSelected] = useState("")
  const session =
    completed.find((row) => row.id === selected) ??
    completed[completed.length - 1]
  const run = session ? learningRunFromSession(session) : null
  return (
    <Panel
      code="L"
      title="POST-DEATH / POST-RUN ROOT-CAUSE BREAKDOWN"
      tag="EVIDENCE → REFLECTION"
      pillar="diagnostic"
      className="e-learning-panel"
    >
      <div className="e-learning-panel-body">
        <p>
          {isAdmin
            ? "Review completed sessions from the selected source. Names and private records remain admin-only."
            : "Practice with a clearly labeled reference session here. Your own local run debrief becomes available on the game’s caught/escaped screen."}
        </p>
        {run ? (
          <>
            <label>
              COMPLETED SESSION
              <select
                aria-label="Completed debrief session"
                value={session.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {completed.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.id} · {row.outcome} · {row.latest.source}
                  </option>
                ))}
              </select>
            </label>
            <div className="e-root-cause">
              <Badge tone="yellow">{run.source.toUpperCase()}</Badge>
              <span>{run.diagnostic}</span>
            </div>
            <RunDebriefButton key={run.id} run={run} />
          </>
        ) : (
          <p className="e-awaiting">
            No completed sessions in this source. Record an escape/elimination
            before generating an evidence-based debrief.
          </p>
        )}
      </div>
    </Panel>
  )
}

export function PrescriptiveEvidencePanel({
  rules,
}: {
  rules: {
    label: string
    support: number
    confidence: number
    lift: number
    count: number
  }[]
}) {
  return (
    <Panel
      code="M"
      title="DECISION SUPPORT / ASSOCIATION EVIDENCE MATRIX"
      tag="APRIORI METRICS / CANDIDATE RULES"
      pillar="prescriptive"
    >
      <div className="e-learning-panel-body">
        <p>
          Compare confidence with lift and support before proposing an
          intervention. These are evaluated candidate rules, not proof that an
          action caused survival.
        </p>
        <div className="e-matrix-scroll">
          <table className="e-evidence-table">
            <thead>
              <tr>
                <th>OBSERVED RULE</th>
                <th>SUPPORT</th>
                <th>CONFIDENCE</th>
                <th>LIFT</th>
                <th>DECISION CHECK</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.label}>
                  <td>{rule.label}</td>
                  <td>
                    {(rule.support * 100).toFixed(1)}% / {rule.count} baskets
                  </td>
                  <td>{(rule.confidence * 100).toFixed(1)}%</td>
                  <td>{rule.lift.toFixed(2)}×</td>
                  <td>
                    {rule.count < 5
                      ? "Collect more supporting sessions."
                      : rule.lift <= 1
                        ? "No improvement over baseline prevalence."
                        : "Candidate for a controlled trial; compare resource cost."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="e-awaiting">
          Socratic checkpoint: would you choose a high-confidence rule with lift
          ≈ 1? What additional evidence would change your recommendation?
        </p>
      </div>
    </Panel>
  )
}
