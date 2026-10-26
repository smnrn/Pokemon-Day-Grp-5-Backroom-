import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Badge, Icon } from "./UI"
import { Heatmap, LinePlot, Scatter } from "./Charts"
import {
  association,
  demoEvents,
  formatTime,
  sessionsFrom,
  SPECIMENS,
  survivalCurve,
} from "./analytics"
import { PILLARS, type Pillar } from "./education-model"
import { PillarExplanation } from "./Pillars"
import { DeductionEngine } from "./LearningGuide"
import { publicBatteryScenario, referenceCluster } from "./public-preview-model"

const STEPS = [
  {
    icon: "pulse",
    title: "COLLECT THE SIGNAL",
    label: "EMF / AUDIO / TEMPERATURE",
    text: "Read the environmental features. Which signal has changed, and what does your baseline look like?",
  },
  {
    icon: "target",
    title: "DIAGNOSE THE CLUSTER",
    label: "K-MEANS / EUCLIDEAN DISTANCE",
    text: "Normalize the features and compare the point with reference centroids. A close match is a hypothesis, not proof of a cause.",
  },
  {
    icon: "battery",
    title: "FORECAST THE SLOPE",
    label: "LINEAR REGRESSION / SURVIVAL",
    text: "Project the battery trend. How much time would remain if the current consumption assumptions stayed unchanged?",
  },
  {
    icon: "chart",
    title: "TEST AN INTERVENTION",
    label: "CONFIDENCE / LIFT / TRADE-OFFS",
    text: "Commit to a countermeasure, compare the modeled consequences, and explain the resource or information trade-off.",
  },
]
export function GameplayMechanics({ active }: { active: boolean }) {
  const [step, setStep] = useState(0)
  return (
    <section
      className="p-mechanics p-section"
      id="field-protocol"
      aria-labelledby="p-mechanics-heading"
    >
      <div className="p-section-heading">
        <div>
          <span>01 / YOUR FIELD PROTOCOL</span>
          <h2 id="p-mechanics-heading">
            THIS IS NOT
            <br />
            <em>BLIND TRIAL-AND-ERROR.</em>
          </h2>
        </div>
        <p>
          One labyrinth. Three rescues. Four ways to think.
          <br />
          Your strongest survival tool is your ability to interpret evidence.
        </p>
      </div>
      <div className="p-mechanics-grid">
        <motion.article
          className="p-objective"
          initial={active ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="p-card-index">PROTOCOL / 01</span>
          <Icon name="target" size={28} />
          <h3>THE OBJECTIVE</h3>
          <p>
            Survive Sector 04 of the Yellow Labyrinth by using the Data-Dex
            Companion Terminal to decode environmental telemetry rather than
            blind guessing.
          </p>
          <div className="p-rescue-markers">
            <span>
              01 <i />
            </span>
            <span>
              02 <i />
            </span>
            <span>
              03 <i />
            </span>
            <Icon name="arrow" />
          </div>
          <small>
            IN THE PLAYABLE MAZE: RESCUE ALL THREE POKÉMON, THEN INTERACT WITH
            THE UNLOCKED EXIT.
          </small>
        </motion.article>
        <motion.article
          className="p-flow-card"
          initial={active ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <span className="p-card-index">PROTOCOL / 02</span>
          <h3>CORE MECHANICS</h3>
          <div
            className="p-flow-steps"
            role="group"
            aria-label="Explore the four gameplay mechanics"
          >
            {STEPS.map((row, index) => (
              <button
                key={row.title}
                aria-pressed={step === index}
                onClick={() => setStep(index)}
              >
                <b>0{index + 1}</b>
                <Icon name={row.icon} size={18} />
                <span>{row.title}</span>
                {index < 3 && <i>→</i>}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="p-flow-detail"
              key={step}
              initial={active ? { opacity: 0, y: 5 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: active ? 0.2 : 0 }}
            >
              <span>{STEPS[step].label}</span>
              <p>{STEPS[step].text}</p>
            </motion.div>
          </AnimatePresence>
        </motion.article>
        <motion.article
          className="p-golden-rule"
          initial={active ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="p-card-index">PROTOCOL / 03</span>
          <Icon name="eye" size={28} />
          <h3>THE GOLDEN RULE</h3>
          <blockquote>
            GUIDED
            <br />
            DISCOVERY<span>_</span>
          </blockquote>
          <p>
            The Data-Dex never gives away direct spoilers. Interpret scatter
            plots, regression slopes, and probability curves to deduce your next
            move.
          </p>
          <small>
            WE PROVIDE THE EVIDENCE.
            <br />
            YOU MAKE THE INFERENCE.
          </small>
        </motion.article>
      </div>
      <div className="p-provenance">
        <Icon name="file" size={14} />
        <span>
          All public previews are synthetic teaching scenarios, not live engine
          telemetry. Actual controls, shared battery rules, and research
          limitations are explained in Field Briefing & Rules.
        </span>
      </div>
    </section>
  )
}

export function AnalyticsShowcase({
  active,
  breach,
}: {
  active: boolean
  breach: boolean
}) {
  const [pillar, setPillar] = useState<Pillar>("descriptive")
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const keys = Object.keys(PILLARS) as Pillar[]
  const events = useMemo(() => demoEvents(), [])
  const sessions = useMemo(() => sessionsFrom(events), [events])
  const [tick, setTick] = useState(0),
    [heatFilter, setHeatFilter] = useState("Eliminations")
  const [emf, setEmf] = useState(86),
    [temperature, setTemperature] = useState(20.8),
    [audio, setAudio] = useState(40)
  const [flashlight, setFlashlight] = useState(true),
    [sprint, setSprint] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      if (!document.hidden) setTick((value) => value + 1)
    }, 1800)
    return () => clearInterval(timer)
  }, [active])
  const match = referenceCluster(emf, temperature, audio)
  const forecast = publicBatteryScenario(flashlight, sprint)
  const samples = useMemo(
    () =>
      SPECIMENS.slice(0, 3).flatMap((specimen, cluster) =>
        Array.from({ length: 18 }, (_, index) => ({
          x:
            (specimen.vector[0] + Math.sin(index * 7.4 + cluster) * 0.09) * 100,
          y:
            (specimen.vector[1] * 0.45 +
              specimen.vector[2] * 0.55 +
              Math.cos(index * 5.1) * 0.07) *
            100,
          color: specimen.color,
          label: `Synthetic Cluster ${String.fromCharCode(65 + cluster)} reference ${index + 1}`,
        })),
      ),
    [],
  )
  const rules = [
    {
      label: "CHASE + LOW STAMINA → LOCKER RESPONSE",
      ...association(
        sessions,
        (session) =>
          session.events.some((e) => e.event === "chase") &&
          session.events.some((e) => e.stamina < 25),
        (session) => session.events.some((e) => e.event === "hide_locker"),
      ),
    },
    {
      label: "CORRIDOR → LEFT-TURN RESPONSE",
      ...association(
        sessions,
        (session) => session.events.some((e) => e.event === "corridor"),
        (session) => session.events.some((e) => e.event === "turn_left"),
      ),
    },
  ]
  function preset(index: number) {
    const vector = SPECIMENS[index].vector
    setEmf(vector[0] * 100)
    setTemperature(40 - vector[1] * 60)
    setAudio(vector[2] * 100)
  }
  return (
    <section
      className="p-analytics p-section"
      id="analytical-pillars"
      aria-labelledby="p-analytics-heading"
    >
      <div className="p-section-heading">
        <div>
          <span>02 / FOUR PILLARS. ONE EVIDENCE CYCLE.</span>
          <h2 id="p-analytics-heading" tabIndex={-1}>
            FROM SIGNAL.
            <br />
            <em>TO SURVIVAL.</em>
          </h2>
        </div>
        <p>
          Explore the analytical framework before entering the lab.
          <br />
          Each stage turns a different question into a testable insight.
        </p>
      </div>
      <div
        className="p-pillar-tabs"
        role="tablist"
        aria-label="Public analytics pillar demos"
      >
        {keys.map((key, index) => (
          <button
            key={key}
            ref={(node) => {
              tabs.current[index] = node
            }}
            id={`p-tab-${key}`}
            role="tab"
            aria-selected={pillar === key}
            aria-controls="p-pillar-panel"
            tabIndex={pillar === key ? 0 : -1}
            className={`e-${key}`}
            onClick={() => setPillar(key)}
            onKeyDown={(event) => {
              let next = index
              if (event.key === "ArrowRight") next = (index + 1) % keys.length
              else if (event.key === "ArrowLeft")
                next = (index + keys.length - 1) % keys.length
              else if (event.key === "Home") next = 0
              else if (event.key === "End") next = keys.length - 1
              else return
              event.preventDefault()
              setPillar(keys[next])
              tabs.current[next]?.focus()
            }}
          >
            <span>
              {PILLARS[key].number} // {PILLARS[key].name}
            </span>
            <small>
              {key === "diagnostic"
                ? "WHY DID IT HAPPEN?"
                : PILLARS[key].question}
            </small>
            <Icon
              name={
                key === "descriptive"
                  ? "stream"
                  : key === "diagnostic"
                    ? "target"
                    : key === "predictive"
                      ? "chart"
                      : "terminal"
              }
              size={20}
            />
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="p-pillar-panel"
        aria-labelledby={`p-tab-${pillar}`}
        className={`p-pillar-panel e-${pillar}`}
      >
        <div className="p-demo-status">
          <span>
            <i />
            INTERACTIVE TEACHING BENCH / {PILLARS[pillar].name}
          </span>
          <Badge tone="yellow">SYNTHETIC DATA ONLY</Badge>
        </div>
        <PillarExplanation pillar={pillar} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pillar}
            initial={active ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: active ? 0.22 : 0 }}
          >
            {pillar === "descriptive" && (
              <div className="p-demo-content">
                <div className="p-kpi-ribbon">
                  {[
                    {
                      label: "EMF LEVEL",
                      value: breach
                        ? "99.9"
                        : (82.4 + Math.sin(tick) * 2.4).toFixed(1),
                      unit: "mG",
                      icon: "pulse",
                    },
                    {
                      label: "TEMPERATURE",
                      value: (18.2 + Math.sin(tick * 0.7) * 1.2).toFixed(1),
                      unit: "°C",
                      icon: "eye",
                    },
                    {
                      label: "ACOUSTIC LEVEL",
                      value: breach
                        ? "99.9"
                        : (42 + Math.cos(tick) * 5).toFixed(1),
                      unit: "dB",
                      icon: "sound",
                    },
                    {
                      label: "REFERENCE SESSIONS",
                      value: String(sessions.length),
                      unit: "SIMULATED",
                      icon: "terminal",
                    },
                  ].map((row) => (
                    <div key={row.label}>
                      <span>
                        {row.label}
                        <Icon name={row.icon} size={16} />
                      </span>
                      <strong>
                        {row.value}
                        <small>{row.unit}</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="p-chart-split">
                  <div className="p-chart-narrative">
                    <span>SPATIAL DEATH HEATMAP</span>
                    <h3>
                      THE PATTERN
                      <br />
                      BEFORE THE EXPLANATION.
                    </h3>
                    <p>
                      Coordinates become a floorplan. Events become visible
                      concentrations. Select a hotspot to inspect its supplied
                      location and source.
                    </p>
                    <div
                      className="p-small-controls"
                      role="group"
                      aria-label="Public spatial event filter"
                    >
                      {["All telemetry", "Eliminations", "Jumpscares"].map(
                        (filter) => (
                          <button
                            key={filter}
                            aria-pressed={heatFilter === filter}
                            onClick={() => setHeatFilter(filter)}
                          >
                            {filter.toUpperCase()}
                          </button>
                        ),
                      )}
                    </div>
                    <small>
                      A concentration describes what happened. It does not yet
                      tell you why.
                    </small>
                  </div>
                  <Heatmap events={events} filter={heatFilter} />
                </div>
              </div>
            )}
            {pillar === "diagnostic" && (
              <div className="p-demo-content p-diagnostic-demo">
                <div className="p-chart-narrative">
                  <span>K-MEANS / NORMALIZED EUCLIDEAN DISTANCE</span>
                  <h3>
                    DON’T GUESS.
                    <br />
                    TEST THE SIGNATURE.
                  </h3>
                  <p>
                    Move the sensor inputs. Watch the encounter point shift
                    between reference centroids and compare the nearest cluster.
                  </p>
                  <div
                    className="p-small-controls"
                    role="group"
                    aria-label="Reference cluster presets"
                  >
                    {["A / EMF", "B / THERMAL", "C / ACOUSTIC"].map(
                      (label, index) => (
                        <button
                          key={label}
                          aria-pressed={match.index === index}
                          onClick={() => preset(index)}
                        >
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                  <label>
                    EMF INPUT <b>{emf.toFixed(0)} mG</b>
                    <input
                      aria-label="Public diagnostic EMF"
                      type="range"
                      min={0}
                      max={100}
                      value={emf}
                      onChange={(e) => setEmf(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    AUDIO INPUT <b>{audio.toFixed(0)} dB</b>
                    <input
                      aria-label="Public diagnostic audio"
                      type="range"
                      min={0}
                      max={100}
                      value={audio}
                      onChange={(e) => setAudio(Number(e.target.value))}
                    />
                  </label>
                  <div className="p-distance">
                    <span>
                      NEAREST CENTROID / CLUSTER{" "}
                      {String.fromCharCode(65 + match.index)}
                    </span>
                    <strong>
                      {match.distance.toFixed(3)}
                      <small> NORMALIZED UNITS</small>
                    </strong>
                  </div>
                </div>
                <div>
                  <Scatter
                    points={samples}
                    centers={SPECIMENS.slice(0, 3).map((specimen) => ({
                      x: specimen.vector[0] * 100,
                      y:
                        (specimen.vector[1] * 0.45 +
                          specimen.vector[2] * 0.55) *
                        100,
                      color: specimen.color,
                    }))}
                    current={{
                      x: emf,
                      y:
                        (match.vector[1] * 0.45 + match.vector[2] * 0.55) * 100,
                    }}
                    xLabel="EMF SIGNATURE (%) →"
                    yLabel="ACOUSTIC / THERMAL PROJECTION (%) →"
                  />
                  <div className="p-root-example">
                    <span>ROOT-CAUSE INVESTIGATION / AUTHORED EXAMPLE</span>
                    <div className="p-audio-sequence">
                      {[24, 31, 63, 92].map((level, index) => (
                        <div key={level}>
                          <i style={{ height: `${level}%` }} />
                          <b>{level} dB</b>
                          <small>T−{(3 - index) * 2}s</small>
                        </div>
                      ))}
                      <div className="p-example-ending">
                        <Icon name="warning" size={22} />
                        <b>ELIMINATION</b>
                        <small>SIMULATED</small>
                      </div>
                    </div>
                    <p>
                      A decibel spike precedes the fictional Cluster C
                      encounter. Did sound contribute, or did another variable
                      change? Timing and distance identify a hypothesis—not a
                      proven cause.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {pillar === "predictive" && (
              <div className="p-demo-content">
                <div className="p-prediction-controls">
                  <div>
                    <span>SCENARIO BATTERY MODEL</span>
                    <h3>y = −{forecast.drain.toFixed(2)}x + 100</h3>
                    <small>
                      BASE DRAIN 0.08%/s + ASSUMED EQUIPMENT / MOVEMENT COST
                    </small>
                  </div>
                  <div
                    className="p-small-controls"
                    role="group"
                    aria-label="Public battery usage assumptions"
                  >
                    <button
                      aria-pressed={sprint}
                      onClick={() => setSprint((value) => !value)}
                    >
                      <Icon name="pulse" size={14} />
                      SPRINT {sprint ? "ON" : "OFF"}
                    </button>
                    <button
                      aria-pressed={flashlight}
                      onClick={() => setFlashlight((value) => !value)}
                    >
                      <Icon name="eye" size={14} />
                      FLASHLIGHT {flashlight ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="p-forecast-time">
                    <span>MODELED TIME TO BLACKOUT</span>
                    <strong>{formatTime(forecast.blackout)}</strong>
                  </div>
                </div>
                <div className="p-prediction-charts">
                  <div>
                    <span>01 / LINEAR BATTERY DRAIN SCENARIO</span>
                    <LinePlot
                      maxX={Math.max(600, forecast.blackout)}
                      series={[
                        {
                          name: "Illustrative battery trajectory",
                          color: "var(--c-yellow)",
                          points: forecast.points,
                          area: true,
                        },
                      ]}
                    />
                  </div>
                  <div>
                    <span>02 / KAPLAN–MEIER SURVIVAL CURVE</span>
                    <LinePlot
                      maxX={Math.max(
                        ...sessions.map((session) => session.duration),
                      )}
                      series={[
                        {
                          name: "Fixed synthetic cohort survival",
                          color: "var(--c-green)",
                          points: survivalCurve(sessions),
                          area: true,
                        },
                      ]}
                    />
                  </div>
                </div>
                <p className="p-model-note">
                  Usage switches steepen the authored battery scenario only. The
                  Kaplan–Meier curve summarizes the fixed synthetic cohort and
                  therefore does not change with these switches. Neither curve
                  guarantees a player outcome.
                </p>
              </div>
            )}
            {pillar === "prescriptive" && (
              <div className="p-demo-content p-prescriptive-demo">
                <div className="p-chart-narrative">
                  <span>APRIORI ASSOCIATION METRICS</span>
                  <h3>
                    EVIDENCE ISN’T
                    <br />
                    AN INSTRUCTION.
                  </h3>
                  <p>
                    The rule director compares candidate responses across
                    session baskets. Does high confidence actually improve on
                    the response’s baseline prevalence?
                  </p>
                  <div className="p-rule-evidence">
                    {rules.map((rule) => (
                      <div key={rule.label}>
                        <span>{rule.label}</span>
                        <div>
                          <strong>
                            {(rule.confidence * 100).toFixed(1)}%
                            <small>CONFIDENCE</small>
                          </strong>
                          <strong>
                            {rule.lift.toFixed(2)}×<small>LIFT</small>
                          </strong>
                          <strong>
                            {rule.count}
                            <small>SUPPORTING BASKETS</small>
                          </strong>
                        </div>
                        <p>
                          {rule.lift <= 1
                            ? "Lift ≈ 1: popularity alone does not establish a better protocol."
                            : "A candidate association worth testing—not a causal verdict."}
                        </p>
                      </div>
                    ))}
                  </div>
                  <small>
                    Fixed candidate rules evaluated using Apriori metrics. This
                    preview never directs the actual game.
                  </small>
                </div>
                <div className="p-public-deduction">
                  <DeductionEngine
                    cluster={match.index}
                    distance={match.distance}
                    signature={`${emf}:${temperature}:${audio}`}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="p-research-cycle">
        <span>DESCRIBE</span>
        <b>→</b>
        <span>DIAGNOSE</span>
        <b>→</b>
        <span>PREDICT</span>
        <b>→</b>
        <span>PRESCRIBE</span>
        <i />
        <small>ONE VARIABLE. ONE HYPOTHESIS. ONE BETTER QUESTION.</small>
      </div>
    </section>
  )
}
