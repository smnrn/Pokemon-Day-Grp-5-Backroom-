import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
  type MotionValue,
} from "motion/react"
import { Badge, Icon } from "./UI"
import { LandingCanvas } from "./LandingCanvas"
import {
  camcorderTime,
  DOSSIERS,
  pointerEnergy,
  SILHOUETTES,
} from "./landing-model"
import "./landing.css"
import { BriefingButton } from "./LearningGuide"
import { Link } from "react-router"
import { AnalyticsShowcase, GameplayMechanics } from "./PublicAnalytics"
import "./companion.css"
import "./showcase.css"

function SpecimenShape({
  id,
  className = "",
}: {
  id: keyof typeof SILHOUETTES
  className?: string
}) {
  return (
    <svg
      className={`l-specimen-shape ${className}`}
      viewBox="0 0 170 200"
      aria-hidden="true"
    >
      <path d={SILHOUETTES[id]} fill="currentColor" fillRule="evenodd" />
      {id === "094" ? (
        <>
          <path
            d="m51 103 24 8-17 6Zm44 8 25-10-9 16Z"
            className="l-specimen-eyes"
          />
          <path
            d="M58 131q27 23 54-3"
            fill="none"
            className="l-specimen-eyes"
            strokeWidth="2"
          />
        </>
      ) : id === "025" ? (
        <>
          <circle cx="53" cy="106" r="3" className="l-specimen-eyes" />
          <circle cx="85" cy="106" r="3" className="l-specimen-eyes" />
        </>
      ) : (
        <path
          d="M68 106h8m15 0h8"
          className="l-specimen-eyes"
          strokeWidth="4"
        />
      )}
    </svg>
  )
}

type MagneticButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children: ReactNode
}
export function MagneticButton({
  children,
  className = "",
  disabled,
  ...props
}: MagneticButtonProps) {
  const reduced = useReducedMotion()
  const mx = useMotionValue(0),
    my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 260, damping: 22 }),
    y = useSpring(my, { stiffness: 260, damping: 22 })
  return (
    <motion.button
      {...props}
      disabled={disabled}
      className={`l-magnetic ${className}`}
      style={{ x, y }}
      onPointerMove={(event) => {
        if (
          reduced ||
          disabled ||
          event.pointerType !== "mouse" ||
          event.currentTarget.closest(".l-motion-paused")
        )
          return
        const bounds = event.currentTarget.getBoundingClientRect()
        mx.set((event.clientX - bounds.left - bounds.width / 2) * 0.055)
        my.set((event.clientY - bounds.top - bounds.height / 2) * 0.12)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      onBlur={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      <span className="l-button-content">{children}</span>
    </motion.button>
  )
}

const MotionLink = motion.create(Link)
function MagneticLink({
  children,
  to,
  className = "",
}: {
  children: ReactNode
  to: string
  className?: string
}) {
  const reduced = useReducedMotion()
  const mx = useMotionValue(0),
    my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 260, damping: 22 }),
    y = useSpring(my, { stiffness: 260, damping: 22 })
  return (
    <MotionLink
      to={to}
      className={`l-magnetic ${className}`}
      style={{ x, y }}
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType !== "mouse" ||
          event.currentTarget.closest(".l-motion-paused")
        )
          return
        const bounds = event.currentTarget.getBoundingClientRect()
        mx.set((event.clientX - bounds.left - bounds.width / 2) * 0.04)
        my.set((event.clientY - bounds.top - bounds.height / 2) * 0.12)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      onBlur={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      <span className="l-button-content">{children}</span>
    </MotionLink>
  )
}

function HolographicRadar({
  active,
  breach,
}: {
  active: boolean
  breach: boolean
}) {
  const rx = useMotionValue(0),
    ry = useMotionValue(0)
  const rotateX = useSpring(rx, { stiffness: 95, damping: 22 }),
    rotateY = useSpring(ry, { stiffness: 95, damping: 22 })
  return (
    <div className="p-holo-perspective">
      <motion.div
        className="p-holographic"
        style={{ rotateX, rotateY }}
        onPointerMove={(event) => {
          if (!active || event.pointerType !== "mouse") return
          const bounds = event.currentTarget.getBoundingClientRect()
          rx.set(
            (-(event.clientY - bounds.top - bounds.height / 2) /
              bounds.height) *
              10,
          )
          ry.set(
            ((event.clientX - bounds.left - bounds.width / 2) / bounds.width) *
              12,
          )
        }}
        onPointerLeave={() => {
          rx.set(0)
          ry.set(0)
        }}
      >
        <div className="p-holo-caption">
          <span>
            <i />
            LIVE SECTOR 04
          </span>
          <span>ANOMALY RADAR & K-MEANS PREVIEW</span>
          <b>SIMULATED</b>
        </div>
        <div className="p-holo-display">
          <span className="p-holo-coordinate p-holo-north">N / 00°</span>
          <span className="p-holo-coordinate p-holo-west">−36.0</span>
          <span className="p-holo-coordinate p-holo-east">+36.0</span>
          <div className="p-large-radar">
            <div className="p-radar-sweep" />
            <div className="p-radar-crosshair" />
            <i className="p-radar-target p-target-a">
              <b>A</b>
              <small>#025</small>
            </i>
            <i className="p-radar-target p-target-b">
              <b>B</b>
              <small>#094</small>
            </i>
            <i className="p-radar-target p-target-c">
              <b>C</b>
              <small>#934</small>
            </i>
            <span className="p-radar-origin">
              S04<small>OBSERVATION POINT</small>
            </span>
          </div>
          <svg
            className="p-floor-schematic"
            viewBox="0 0 520 380"
            aria-hidden="true"
          >
            <path d="M30 50h110v70H75v125h100v-80h85v-65h115v95h90v140H345v-80h-90v95H95v-65H30Zm110 0v-30h165v35h135v80h45M75 120h-45m145 45v-80h85m115 110h-55v-95M95 285h80m80-30v-55h65m25 135v30h140" />
            <path d="M30 20h15m-15 0v15M485 20h-15m15 0v15M30 365h15m-15 0v-15M485 365h-15m15 0v-15" />
          </svg>
          <div className="p-holo-scale">
            <span>03 REFERENCE SIGNATURES</span>
            <span>
              20m <i /> 0m
            </span>
          </div>
        </div>
        <TelemetryPreview active={active} breach={breach} />
        <div className="p-holo-corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </motion.div>
      <div className="p-holo-shadow" aria-hidden="true" />
      <div className="p-holo-legend">
        <span>
          <i />
          ELECTROMAGNETIC
        </span>
        <span>
          <i />
          SPECTRAL
        </span>
        <span>
          <i />
          ACOUSTIC
        </span>
      </div>
    </div>
  )
}

function PublicHero({ active, breach }: {
  active: boolean
  breach: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <section className="p-hero-viewport" aria-labelledby="public-hero-heading">
      <div className="p-hero-stage">
        <motion.div
          className="l-hero p-hero-copy"
          initial={active ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <div className="l-eyebrow">
            <span>PUBLIC RESEARCH BRIEFING</span>
            <span>SILPH-BACKROOMS / SECTOR 04</span>
          </div>
          <div id="public-hero-heading">
            <DecodeHeadline active={active} />
          </div>
          <p className="p-hero-statement">
            SURVIVAL IS A SCIENCE.
            <br />
            <span>YOU ARE THE EXPERIMENT.</span>
          </p>
          <p className="p-hero-description">
            A third-year field study at the edge of the known.
            <br />
            Decode the signal. Question the pattern. Find your way out.
          </p>
          <div className="p-hero-actions">
            <MagneticLink to="/login" className="c-primary-button p-enter-link">
              ENTER RESEARCH TERMINAL / SIGN IN <Icon name="arrow" size={17} />
            </MagneticLink>
            <a
              className="p-explore-link"
              href="#analytical-pillars"
              onClick={(event) => {
                event.preventDefault()
                document
                  .getElementById("analytical-pillars")
                  ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
                document
                  .getElementById("p-analytics-heading")
                  ?.focus({ preventScroll: true })
              }}
            >
              EXPLORE THE 4 ANALYTICAL PILLARS <span>↓</span>
            </a>
          </div>
          <div className="p-hero-facts">
            <span>
              <b>03</b>DEFECTIVE SPECIMENS
            </span>
            <span>
              <b>04</b>ANALYTICAL PILLARS
            </span>
            <span>
              <b>01</b>WAY OUT
            </span>
          </div>
        </motion.div>
        <motion.div
          className="p-hero-instrument"
          initial={active ? { opacity: 0, y: 24 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          <HolographicRadar active={active} breach={breach} />
        </motion.div>
      </div>
      <div className="p-hero-bottom">
        <span className="p-scroll-label">
          <i />
          SCROLL TO BEGIN THE FIELD PROTOCOL <b>↓</b>
        </span>
        <span>PUBLIC DEMONSTRATION / NO ACCOUNT REQUIRED</span>
      </div>
    </section>
  )
}

function SecurityAirlock({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <main className="a-security-main">
      <Link className="a-return-link" to="/">
        <span>←</span> RETURN TO PUBLIC BRIEFING
      </Link>
      <div className="a-airlock-heading">
        <span>SECURITY AIRLOCK / SECTOR 04</span>
        <h1>
          IDENTIFY YOURSELF<span>_</span>
        </h1>
        <p>The field begins beyond this terminal. Verify your clearance.</p>
      </div>
      <div className="a-airlock-grid">
        <aside className="a-clearance-panel">
          <span className="a-panel-code">CLEARANCE LEVEL VERIFICATION</span>
          <div>
            <Icon name="terminal" size={21} />
            <b>01 / PLAYER CLEARANCE</b>
            <p>Data-Dex & named booth sessions.</p>
            <small>Public signup creates player accounts only.</small>
          </div>
          <div>
            <Icon name="chart" size={21} />
            <b>02 / ADMIN CLEARANCE</b>
            <p>Full telemetry oversight & cohort analytics.</p>
            <small>Assigned by the project owner. Never self-selected.</small>
          </div>
          <span className="a-clearance-note">
            <i />
            SERVER-VERIFIED ROLE
          </span>
        </aside>
        <div className="l-terminal-column a-terminal-column">
          <div className="l-terminal-caption">
            <span>
              <i />
              {label}
            </span>
            <span>ENCRYPTED UPLINK / 256</span>
          </div>
          <div className="l-terminal-frame">
            {children}
            <div className="l-input-status" aria-hidden="true">
              <i />
              <span>[AWAITING SUBJECT CREDENTIALS…]</span>
              <b>INPUT CHANNEL OPEN</b>
            </div>
          </div>
          <div className="l-terminal-bottom">
            <Icon name="database" size={12} />
            <span>SUPABASE AUTHENTICATION</span>
            <span>ROLE-VERIFIED ACCESS</span>
          </div>
          <p className="l-privacy">
            <Icon name="file" size={13} />
            <span>
              Use an exhibition nickname. Display names and session starts are
              visible only to authorized administrators. Never enter sensitive
              personal information.
            </span>
          </p>
        </div>
        <aside className="a-airlock-markings" aria-hidden="true">
          <span>
            AUTHENTICATION
            <br />
            ISOLATION CHAMBER
          </span>
          <svg viewBox="0 0 110 240">
            <path d="M22 5h65v35H22zM54 40v30M12 70h85v82H12zM22 152v35h65v-35M54 187v40M36 227h36" />
            <circle cx="54" cy="110" r="24" />
            <circle cx="54" cy="110" r="11" />
            <path d="M54 77v18m0 30v18M22 110h19m26 0h19" />
          </svg>
          <b>
            SILPH
            <br />
            SECURE ACCESS
          </b>
          <small>
            AUTH / RLS / ROLE
            <br />
            NO PUBLIC ADMIN SIGNUP
          </small>
        </aside>
      </div>
    </main>
  )
}

function DecodeHeadline({ active }: { active: boolean }) {
  const target = "EVERY PLAYER.\nA NEW DATA POINT"
  const [text, setText] = useState(target)
  useEffect(() => {
    if (!active) {
      setText(target)
      return
    }
    const alphabet = "01█▓/_<>+*"
    let frame = 0
    const timer = setInterval(() => {
      frame++
      setText(
        [...target]
          .map((letter, index) =>
            letter === "\n" || letter === " " || index < frame * 1.1
              ? letter
              : alphabet[(index * 7 + frame * 3) % alphabet.length],
          )
          .join(""),
      )
      if (frame > target.length / 1.1) clearInterval(timer)
    }, 32)
    return () => clearInterval(timer)
  }, [active])
  const [first, second] = text.split("\n")
  return (
    <h1 className="l-hero-title" aria-label="EVERY PLAYER. A NEW DATA POINT_">
      <span aria-hidden="true" data-text={first}>
        {first}
      </span>
      <span aria-hidden="true" data-text={second}>
        {second}
        <b>_</b>
      </span>
    </h1>
  )
}

function Camcorder({ active, breach }: {
  active: boolean
  breach: boolean
}) {
  const clock = useRef<HTMLSpanElement>(null)
  const elapsed = useRef(259880),
    previous = useRef(0)
  const [tick, setTick] = useState(0)
  useAnimationFrame((time) => {
    const delta = previous.current ? time - previous.current : 0
    previous.current = time
    if (active && !document.hidden) elapsed.current += Math.min(delta, 100)
    if (clock.current && active)
      clock.current.textContent = camcorderTime(elapsed.current)
  })
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      if (!document.hidden) setTick((v) => v + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [active])
  const signal = breach ? "99.9" : (4.8 + Math.sin(tick * 1.7) * 0.4).toFixed(1)
  return (
    <div
      className="l-camcorder"
      aria-label="Simulated camcorder recording and EMF signal"
    >
      <span className="l-rec">
        <i /> REC <span ref={clock}>00:04:19:88</span>
      </span>
      <span className="l-emf">
        EMF SIGNAL: <strong>{signal} mG</strong>
        <svg viewBox="0 0 76 20" aria-hidden="true">
          <polyline
            points={Array.from(
              { length: 30 },
              (_, i) =>
                `${i * 2.6},${10 + Math.sin(i * 1.8 + tick) * 3 + (i % 7 === tick % 7 ? (breach ? -8 : -5) : 0)}`,
            ).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </span>
      <span className="l-camcorder-note">
        S04 / CAM_01 <b>SIMULATED FEED</b>
      </span>
    </div>
  )
}

function TelemetryPreview({
  active,
  breach,
}: {
  active: boolean
  breach: boolean
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      if (!document.hidden) setTick((v) => v + 1)
    }, 1600)
    return () => clearInterval(timer)
  }, [active])
  const survival = breach ? 99.9 : 73.8 + Math.sin(tick * 0.8) * 2.3
  const panic = breach ? 199.9 : 118 + Math.round(Math.sin(tick) * 8)
  return (
    <section
      className="l-telemetry"
      aria-label="Simulated sector telemetry preview"
    >
      <div className="l-widget-heading">
        <span>
          <i />
          LIVE SECTOR 04 TELEMETRY STREAM
        </span>
        <Badge tone="yellow">SIMULATION</Badge>
      </div>
      <div className="l-telemetry-body">
        <div className="l-radar" aria-hidden="true">
          <div className="l-radar-sweep" />
          <i className="l-blip l-blip-one" />
          <i className="l-blip l-blip-two" />
          <i className="l-blip l-blip-three" />
          <span>04</span>
        </div>
        <svg
          className="l-mini-scatter"
          viewBox="0 0 150 112"
          role="img"
          aria-label="Synthetic anomaly signature clusters"
        >
          <path
            d="M10 8V96H144M10 66H144M10 36H144M54 8V96M99 8V96"
            className="l-scatter-grid"
          />
          {[0, 1, 2].map((cluster) => (
            <g
              key={cluster}
              className={`l-scatter-cluster l-cluster-${cluster}`}
            >
              <ellipse
                cx={32 + cluster * 43}
                cy={68 - cluster * 20}
                rx="21"
                ry="16"
                fill="currentColor"
                fillOpacity=".04"
                stroke="currentColor"
                strokeOpacity=".2"
                strokeDasharray="2 4"
              />
              {Array.from({ length: 10 }, (_, i) => (
                <circle
                  key={i}
                  cx={32 + cluster * 43 + Math.sin(i * 7.1) * 17}
                  cy={68 - cluster * 20 + Math.cos(i * 4.3) * 12}
                  r={breach ? 2.8 : 1.8}
                  fill="currentColor"
                  opacity=".7"
                />
              ))}
              <path
                d={`M${27 + cluster * 43} ${68 - cluster * 20}h10m-5-5v10`}
                stroke="currentColor"
              />
            </g>
          ))}
          <text x="10" y="109">
            EMF / ACOUSTIC SIGNATURE
          </text>
        </svg>
        <div className="l-mini-stats">
          <div>
            <span>ACTIVE BOOTH SESSIONS</span>
            <strong>
              {breach ? "99" : String(12 + (tick % 3)).padStart(2, "0")}
              <small> / SIM</small>
            </strong>
          </div>
          <div>
            <span>SURVIVAL PROBABILITY</span>
            <strong className="l-stat-green">
              {survival.toFixed(1)}
              <small>%</small>
            </strong>
            <div className="l-probability-track">
              <motion.i
                animate={{ scaleX: survival / 100 }}
                transition={{ duration: active ? 0.6 : 0 }}
              />
            </div>
          </div>
          <div>
            <span>
              PANIC INDEX <small>/ PROXY</small>
            </span>
            <strong className="l-stat-red">
              {panic}
              <small> BPM</small>
            </strong>
          </div>
        </div>
      </div>
      <div className="l-widget-foot">
        <span>SYNTHETIC PREVIEW · NO LIVE PLAYER DATA</span>
        <span>k = 3 / μ →</span>
      </div>
    </section>
  )
}

function SpecimenCard({
  dossier,
  index,
  active,
}: {
  dossier: typeof DOSSIERS[number]
  index: number
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const rx = useMotionValue(0),
    ry = useMotionValue(0)
  const rotateX = useSpring(rx, { stiffness: 180, damping: 20 }),
    rotateY = useSpring(ry, { stiffness: 180, damping: 20 })
  return (
    <motion.article
      className={`l-specimen l-specimen-${dossier.id} ${open ? "is-open" : ""}`}
      initial={active ? { opacity: 0, y: 22 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      style={{ rotateX, rotateY }}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-label={`Specimen #${dossier.id}: ${dossier.name}. ${
        open ? "Close" : "Read"
      } diagnostic field question.`}
      onPointerMove={(event) => {
        if (!active || event.pointerType !== "mouse") return
        const rect = event.currentTarget.getBoundingClientRect()
        rx.set(
          (-(event.clientY - rect.top - rect.height / 2) / rect.height) * 9,
        )
        ry.set(((event.clientX - rect.left - rect.width / 2) / rect.width) * 9)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
      onBlur={() => {
        rx.set(0)
        ry.set(0)
      }}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setOpen((v) => !v)
        }
      }}
    >
      <div className="l-dossier-top">
        <span>SPECIMEN #{dossier.id}</span>
        <span>
          CLUSTER {dossier.cluster}
          <i />
        </span>
      </div>
      <div className="l-specimen-visual">
        <div className="l-specimen-grid" />
        <span className="l-specimen-watermark">{dossier.id}</span>
        <SpecimenShape id={dossier.id} />
        <div className="l-specimen-measure">
          <span>{dossier.descriptor}</span>
          <strong>{dossier.signal}</strong>
        </div>
        {dossier.id === "025" && (
          <svg className="l-waveform" viewBox="0 0 300 50" aria-hidden="true">
            <path
              d="M0 26h20l6-5 7 14 8-29 8 44 9-27 6 3h26l5-9 5 18 9-33 10 43 7-25 5 6h33l7-16 6 28 8-34 8 39 7-21 6 4h29l5-10 7 17 7-29 7 41 8-20h33"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}
        {dossier.id === "094" && (
          <div className="l-thermal-gauge" aria-hidden="true">
            <i />
            <span>−K</span>
          </div>
        )}
        {dossier.id === "934" && (
          <div className="l-equalizer" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    "--bar-index": i,
                    "--bar-base": 0.15 + Math.abs(Math.sin(i * 1.9)) * 0.55,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>
      <div className="l-dossier-name">
        <span>{dossier.alias}</span>
        <h3>{dossier.name}</h3>
        <Icon name={open ? "check" : "arrow"} size={18} />
      </div>
      <div className="l-dossier-advice">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={open ? "advice" : "prompt"}
            initial={active ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: active ? 0.18 : 0 }}
          >
            {open ? dossier.action : "INSPECT DOSSIER / FORM A HYPOTHESIS"}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.article>
  )
}

const ALERTS = [
  "ALERT: SPECIMEN #094 DETECTED IN SECTOR B",
  "K-MEANS CENTROID SHIFT: +14.2%",
  "LAST SURVIVOR: 02m 41s",
  "WARNING: VERIFY YOUR EMISSION HYPOTHESIS IN CLUSTER A",
]

export function LandingExperience({
  children,
  label = "PUBLIC BRIEFING",
  variant = "showcase",
}: {
  children?: ReactNode
  label?: string
  variant?: "showcase" | "terminal"
}) {
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(false),
    [breach, setBreach] = useState(false),
    [typing, setTyping] = useState(false)
  const active = !paused && !reduced
  const targetX = useMotionValue(window.innerWidth * 0.28),
    targetY = useMotionValue(window.innerHeight * 0.38)
  const x = useSpring(targetX, { stiffness: 95, damping: 23, mass: 0.8 }),
    y = useSpring(targetY, { stiffness: 95, damping: 23, mass: 0.8 })
  const energy = useMotionValue(0)
  const speed = useSpring(energy, { stiffness: 65, damping: 15 })
  const pointer = useRef({ x: 0, y: 0, time: 0 })
  const movementTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingFrame = useRef<number | null>(null)
  useEffect(() => {
    if (!breach) return
    const timer = setTimeout(() => setBreach(false), 5000)
    return () => clearTimeout(timer)
  }, [breach])
  useEffect(
    () => () => {
      if (movementTimeout.current) clearTimeout(movementTimeout.current)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      if (typingFrame.current !== null) cancelAnimationFrame(typingFrame.current)
    },
    [],
  )
  return (
    <motion.div
      className={`companion c-access-page l-shell ${
        variant === "showcase" ? "p-showcase" : "a-auth-view"
      } ${breach ? "l-breach" : ""} ${typing ? "l-typing" : ""} ${
        !active ? "l-motion-paused" : ""
      }`}
      style={{ "--l-pointer-energy": speed } as unknown as CSSProperties}
      onPointerMove={(event) => {
        if (!active || event.pointerType !== "mouse") return
        targetX.set(event.clientX)
        targetY.set(event.clientY)
        const old = pointer.current
        if (old.time)
          energy.set(
            pointerEnergy(
              Math.hypot(event.clientX - old.x, event.clientY - old.y),
              event.timeStamp - old.time,
            ),
          )
        pointer.current = {
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        }
        if (movementTimeout.current) clearTimeout(movementTimeout.current)
        movementTimeout.current = setTimeout(() => energy.set(0), 140)
      }}
      onInputCapture={() => {
        if (!active) return
        // Let the controlled field commit its input before the cosmetic
        // ancestor update; otherwise the first slider change can be restored.
        if (typingFrame.current !== null) cancelAnimationFrame(typingFrame.current)
        typingFrame.current = requestAnimationFrame(() => setTyping(true))
        if (typingTimeout.current) clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => setTyping(false), 650)
      }}
    >
      <LandingCanvas x={x} y={y} active={active} breach={breach} />
      <SpecimenShape id="094" className="l-breach-shadow" />
      <div className="l-screen-overlay" aria-hidden="true">
        <div className="l-scanlines" />
        <div className="l-vignette" />
        <div className="l-vhs-bar" />
        <div className="l-boot-line" />
        <div className="l-emergency-wash" />
      </div>
      <header className="l-header">
        <Link className="l-brand" to="/" aria-label="Silph Co. home">
          <span className="l-brand-symbol">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path
                d="M4 4h24v7H12v5h16v12H4v-7h16v-5H4Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span>
            SILPH CO.<small>ANOMALOUS RESEARCH DIVISION</small>
          </span>
          <span className="l-brand-year">EST. 1998</span>
        </Link>
        <div className="l-header-controls">
          <BriefingButton />
          <button
            type="button"
            className="l-pause"
            onClick={() => setPaused((v) => !v)}
            disabled={!!reduced}
            aria-pressed={!active}
            aria-label={
              reduced
                ? "Reduced motion is enabled"
                : paused
                  ? "Resume visual effects"
                  : "Pause visual effects"
            }
          >
            <Icon name={active ? "pulse" : "play"} size={13} />
            <span>
              {reduced
                ? "REDUCED MOTION"
                : paused
                  ? "RESUME MOTION"
                  : "PAUSE MOTION"}
            </span>
          </button>
          {variant === "showcase" ? (
            <Link className="p-account-access" to="/login">
              <Icon name="terminal" size={12} />
              ACCOUNT ACCESS <Icon name="arrow" size={12} />
            </Link>
          ) : (
            <Badge tone="yellow">{label}</Badge>
          )}
          <button
            type="button"
            className="l-breach-toggle"
            disabled={breach}
            aria-pressed={breach}
            title="Five-second fictional anomaly preview. Includes slow red light pulses; pause visual effects for a static preview."
            onClick={() => setBreach(true)}
          >
            <Icon name={breach ? "warning" : "pulse"} size={14} />
            {breach ? "CONTAINMENT BREACH / 5s" : "TRIGGER ANOMALY PREVIEW"}
          </button>
        </div>
      </header>
      <Camcorder active={active} breach={breach} />
      {variant === "terminal" ? (
        <SecurityAirlock label={label}>{children}</SecurityAirlock>
      ) : (
        <main className="l-main p-public-main">
          <PublicHero active={active} breach={breach} />
          <div
            className="l-ticker p-full-ticker"
            aria-label="Simulated telemetry alerts"
          >
            <span className="l-ticker-label">
              <i />
              SIGNAL FEED / SIMULATION
            </span>
            <div className="l-ticker-window">
              <div className="l-ticker-track">
                {[0, 1].map((copy) => (
                  <span key={copy} aria-hidden={copy === 1}>
                    {ALERTS.map((alert) => (
                      <span key={alert}>
                        [{alert}]<i> / </i>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <GameplayMechanics active={active} />
          <AnalyticsShowcase active={active} breach={breach} />
          <section
            className="l-dossiers p-section p-dossier-section"
            aria-labelledby="l-dossier-heading"
          >
            <div className="p-section-heading">
              <div>
                <span>03 / FIELD ARCHIVE — CLASSIFIED</span>
                <h2 id="l-dossier-heading">
                  THEY ARE NOT
                  <br />
                  <em>WHAT YOU REMEMBER.</em>
                </h2>
              </div>
              <div>
                <p>DEFECTIVE SPECIMEN DOSSIERS / 03 REFERENCE CLUSTERS</p>
                <span className="l-dossier-hint">
                  <Icon name="eye" size={14} />
                  HOVER TO SCAN · SELECT TO FORM A HYPOTHESIS
                </span>
              </div>
            </div>
            <div className="l-specimen-strip">
              {DOSSIERS.map((dossier, index) => (
                <SpecimenCard
                  key={dossier.id}
                  dossier={dossier}
                  index={index}
                  active={active}
                />
              ))}
            </div>
          </section>
          <section
            className="p-final-cta"
            aria-label="Launch authentication portal"
          >
            <div className="p-final-top">
              <span>YOUR FIELD RECORD STARTS HERE.</span>
              <Icon name="target" size={25} />
              <span>SILPH RESEARCH / EXHIBITION STUDY</span>
            </div>
            <h2>
              READY TO BECOME
              <br />
              DATA POINT <span>#050?</span>
            </h2>
            <p>The signal is waiting. Bring a hypothesis.</p>
            <MagneticLink
              to="/login"
              className="c-primary-button p-portal-link"
            >
              LAUNCH AUTHENTICATION PORTAL <Icon name="arrow" size={24} />
            </MagneticLink>
            <small>ILLUSTRATIVE RESEARCH ID · NOT A LIVE PLAYER COUNT</small>
          </section>
        </main>
      )}
      <footer className="l-footer">
        <span>
          <i />
          SILPH RESEARCH / ROLE-BASED ACCESS
        </span>
        <span>35°41′22.2″N / 139°41′30.1″E</span>
        <span>
          THE GAME ENGINE REMAINS INDEPENDENT <b>↗</b>
        </span>
      </footer>
      <AnimatePresence>
        {breach && (
          <motion.div
            className="l-breach-notice"
            role="status"
            initial={active ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="warning" size={18} />
            <div>
              <strong>CONTAINMENT BREACH PREVIEW</strong>
              <span>VISUAL SIMULATION ONLY · AUTOMATIC RESET IN 5 SECONDS</span>
            </div>
            <button
              type="button"
              onClick={() => setBreach(false)}
              aria-label="Stop anomaly preview"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
