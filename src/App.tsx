import { useEffect, useState } from "react"
import Exploration from "./Exploration"
import { BIOMES, getBiome, type BiomeId } from "./biomes"
import { BriefingButton } from "./companion/LearningGuide"

type Screen = "title" | "hud" | "dex"
const specimens = [
  {
    id: "004",
    name: "Failed Cloning",
    alias: "THE REPLICANT",
    type: "Sight-based hunter",
    threat: "CRITICAL",
    note: "Break eye contact. Remain below its line of sight. Do not approach the containment glass.",
    status: "CONTAINMENT BREACH",
  },
  {
    id: "012",
    name: "Vocal Aberration",
    alias: "THE MIMIC",
    type: "Sound-sensitive mimic",
    threat: "SEVERE",
    note: "It remembers the voices it hears. Stay silent. Do not answer calls from an empty room.",
    status: "SIGNAL DETECTED",
  },
  {
    id: "019",
    name: "Lumen Decay",
    alias: "THE PHANTOM",
    type: "Light-draining phantom",
    threat: "HIGH",
    note: "Keep a reserve battery. When the fluorescent lights begin to fade, leave the area immediately.",
    status: "LOCATION UNKNOWN",
  },
]
function Icon({ name, size = 18, charge = 100 }: { name: string; size?: number; charge?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      {name === "play" ? (
        <path d="m8 5 11 7-11 7z" />
      ) : name === "tape" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <circle cx="8" cy="11" r="2" />
          <circle cx="16" cy="11" r="2" />
          <path d="m7 19 2-4h6l2 4" />
        </>
      ) : name === "settings" ? (
        <>
          <path d="M4 7h16M4 17h16" />
          <rect x="8" y="4" width="3" height="6" />
          <rect x="14" y="14" width="3" height="6" />
        </>
      ) : name === "eject" ? (
        <>
          <path d="m5 14 7-9 7 9zM5 19h14" />
        </>
      ) : name === "battery" ? (
        <>
          <rect x="2" y="6" width="18" height="12" />
          <path d="M22 10v4" />
          <rect x="5" y="9" width={Math.max(0,Math.min(100,charge))*.12} height="6" fill="currentColor" stroke="none" />
        </>
      ) : name === "sound" ? (
        <>
          <path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8M20 5q7 7 0 14" />
        </>
      ) : (
        <>
          <path d="m12 3 10 18H2zM12 9v5M12 17v1" />
        </>
      )}
    </svg>
  )
}
export default function App() {
  const [screen, setScreen] = useState<Screen>("title")
  const [biomeId, setBiomeId] = useState<BiomeId>("yellow")
  const biome = getBiome(biomeId)
  const [modal, setModal] = useState<"archive" | "settings" | "eject" | null>(
    null,
  )
  const [elapsed, setElapsed] = useState(1624)
  const [specimen, setSpecimen] = useState(0)
  const [audio, setAudio] = useState(false)
  const [volume, setVolume] = useState(65)
  const [grain, setGrain] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [battery, setBattery] = useState(100)
  useEffect(()=>{if(battery<=0)setScanning(false)},[battery])
  const [ejected, setEjected] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null)
        setScreen("title")
      }
      if (e.target instanceof HTMLInputElement || modal) return
      if (e.key.toLowerCase() === "i")
        setScreen((s) => (s === "dex" ? "hud" : "dex"))
      if (e.key.toLowerCase() === "r" && screen === "hud" && battery>0)
        setScanning((s) => !s)
      if (
        e.key === "Enter" &&
        e.target === document.body &&
        screen === "title"
      ) {
        setEjected(false)
        setScreen("hud")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modal, screen, battery])
  const timestamp = `00:${String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  const selected = specimens[specimen]
  return (
    <div className={`application ${grain ? "with-grain" : ""}`}>
      <header className="app-header">
        <button className="brand" onClick={() => setScreen("title")}>
          <span className="brand-mark">╱╱</span> LIMINAL
          <span className="brand-divider">/</span>
          <span className="brand-sub">RESEARCH DIVISION</span>
        </button>
        <nav aria-label="Screen navigation">
          {([
            ["title", "01", "MAIN MENU"],
            ["hud", "02", "CAMCORDER"],
            ["dex", "03", "CORRUPTED DEX"],
          ] as const).map(([s, n, label]) => (
            <button
              key={s}
              onClick={() => {
                setScreen(s)
                setEjected(false)
              }}
              className={screen === s ? "nav-active" : ""}
            >
              <span>{n}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="system-status">
          <BriefingButton/>
          <i /> SYSTEM ONLINE <span>v.0.9.4</span>
        </div>
      </header>
      <main className={`viewport screen-${screen} biome-${biomeId}`}>
        {screen === "hud" && !ejected && <Exploration key={biomeId} biomeId={biomeId} volume={volume} scanning={scanning} onBatteryChange={setBattery} />}
        <div className="hallway-photo" />
        <div className="hallway-shade" />
        <div className="scene-architecture">
          <div className="ceiling-light" />
          <div className="door-frame" />
          <div className="floor-lines" />
        </div>
        <div className="scene-vignette" />
        <div className="scene-top">
          <span>
            <i className="record-dot" />{" "}
            {screen === "hud" ? "REC" : "TAPE PAUSED"}{" "}
            <span className="time">{timestamp}</span>
          </span>
          <span className="tape-label">
            TAPE_{biome.tape} <span>／</span> CH. 01
          </span>
          <span className={`battery ${battery<=20?'battery-low':''}`}>
            <Icon name="battery" size={25} charge={battery} /> {battery}% <span>SP</span>
          </span>
        </div>
        {ejected ? (
          <section className="ejected">
            <p>NO SIGNAL</p>
            <span>TAPE EJECTED · END OF TRANSMISSION</span>
            <button onClick={() => setEjected(false)}>INSERT TAPE ↗</button>
          </section>
        ) : screen === "title" ? (
          <>
            <section className="title-content">
              <div className="eyebrow">
                <span /> AN ARCHIVE OF THINGS THAT SHOULDN'T EXIST
              </div>
              <h1>
                LIMINAL<span>DEFECT</span>
              </h1>
              <p className="title-tagline">
                They were never meant to survive.
                <br />
                Neither were you.
              </p>
              <div className="menu-list">
                <button
                  className="primary-menu"
                  onClick={() => setScreen("hud")}
                >
                  <Icon name="play" />
                  <span>
                    Continue Tape<small>SECTOR {biome.sector} · {biome.name.toUpperCase()}</small>
                  </span>
                  <span className="menu-arrow">↗</span>
                </button>
                <button onClick={() => setModal("archive")}>
                  <Icon name="tape" />
                  <span>Load Archive</span>
                  <span className="menu-shortcut">02</span>
                </button>
                <button onClick={() => setModal("settings")}>
                  <Icon name="settings" />
                  <span>System Settings</span>
                  <span className="menu-shortcut">03</span>
                </button>
                <button onClick={() => setModal("eject")}>
                  <Icon name="eject" />
                  <span>Eject</span>
                  <span className="menu-shortcut">04</span>
                </button>
              </div>
              <div className="last-session">
                <i /> LAST SESSION <span>OCT 24, 1998 — 03:42 AM</span>
              </div>
            </section>
            <aside className="scene-coordinate">
              <span>CAM_04 / SECTOR {biome.sector}</span>
              <b>{biome.name.toUpperCase()}</b>
              <div>
                34° 03′ 18.2″ N<br />
                118° 14′ 37.8″ W
              </div>
            </aside>
            <div className="scene-warning">
              <Icon name="warning" size={16} />
              <span>IF YOU HEAR YOUR NAME, DO NOT RESPOND.</span>
            </div>
          </>
        ) : screen === "hud" ? (
          <>
            <div className="hud-location">
              <span>SECTOR {biome.sector} / EXPLORATION</span>
              <h2>{biome.name.toUpperCase()}</h2>
              <p>Find the emergency exit. Avoid direct contact.</p>
            </div>
            <div className="crosshair">+</div>
            <div className="hud-subtitle">
              {battery<=0 ? "[ battery depleted · F/R offline · M map available ]" : scanning
                ? "[ biosensor active · 20 m detection radius ]"
                : "[ rescue Pikachu · Charmander · Squirtle · escape ]"}
            </div>
            <div className="hud-actions">
              <button disabled={battery<=0} onClick={() => setScanning(!scanning)}>
                <span>[ R ]</span>{" "}
                {battery<=0 ? "RADAR BATTERY EMPTY" : scanning ? "STOP SCANNING" : "SCAN ENVIRONMENT"}
              </button>
              <button onClick={() => setScreen("dex")}>
                <span>[ I ]</span> OPEN CORRUPTED DEX ↗
              </button>
              <button onClick={() => setScreen("title")}>
                <span>[ ESC ]</span> PAUSE TAPE
              </button>
            </div>
          </>
        ) : (
          <section className="dex">
            <div className="dex-heading">
              <div className="eyebrow">
                PROPERTY OF LIMINAL RESEARCH DIVISION
              </div>
              <h2>
                CORRUPTED<span>_DEX</span>
              </h2>
              <span className="red">DATABASE INTEGRITY: 34%</span>
            </div>
            <div className="dex-grid">
              <aside className="specimens">
                <div className="panel-heading">
                  DEFECTIVE SPECIMENS <span>03</span>
                </div>
                {specimens.map((s, i) => (
                  <button
                    className={i === specimen ? "selected" : ""}
                    key={s.id}
                    onClick={() => {
                      setSpecimen(i)
                      setAudio(false)
                    }}
                  >
                    <small>SPECIMEN #{s.id}</small>
                    <strong>{s.name}</strong>
                    <span>{s.type}</span>
                  </button>
                ))}
                <div className="restricted">
                  <Icon name="warning" />
                  <span>
                    RESTRICTED ACCESS
                    <br />
                    CLEARANCE LEVEL 04
                  </span>
                </div>
              </aside>
              <div className="specimen-viewport">
                <div className="specimen-caption">
                  FIG. {selected.id} / RECOVERED FOOTAGE
                </div>
                <svg
                  className={`creature creature-${specimen}`}
                  viewBox="0 0 300 380"
                  aria-label="Distorted experimental creature silhouette"
                >
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" />
                    </filter>
                    <radialGradient id="body">
                      <stop stopColor="#484932" />
                      <stop offset="1" stopColor="#10160e" />
                    </radialGradient>
                  </defs>
                  <path
                    d="M131 116 84 23l8 106q-24 17-15 50l33 22-20 43-38 86 18 3 53-70-5 83-25 16 43-2 19-91 17 85 40 7-24-23-8-85 44 61 18-6-29-80-35-33 22-25q17-27-10-48l19-94-53 81Z"
                    fill="url(#body)"
                    stroke="#737650"
                    strokeWidth="1"
                  />
                  <path
                    d="m111 154 24 7m24 0 24-9"
                    stroke="#b9e4a0"
                    strokeWidth="5"
                  />
                  <path
                    d="m111 154 24 7m24 0 24-9"
                    stroke="#b9e4a0"
                    strokeWidth="9"
                    filter="url(#glow)"
                  />
                  <path
                    d="m132 182 15 6 16-9m-22 28-13 42m23-39 15 43"
                    fill="none"
                    stroke="#7a7951"
                  />
                  <path
                    d="m197 247 51-25-13 50 42-10-24 56"
                    fill="none"
                    stroke="#313b26"
                    strokeWidth="12"
                  />
                </svg>
                <div className="specimen-caption bottom red">
                  ● {selected.status}
                </div>
                <div className="capture-corner tl" />
                <div className="capture-corner br" />
              </div>
              <aside className="specimen-details">
                <span className="eyebrow">SPECIMEN #{selected.id}</span>
                <h3>{selected.alias}</h3>
                <div className="threat">
                  THREAT LEVEL <span>{selected.threat} ▰▰▰▰▱</span>
                </div>
                <div className="notes">
                  <small>RECOVERED FIELD NOTES</small>
                  <p>{selected.note}</p>
                </div>
                <button
                  className={`audio-log ${audio ? "playing" : ""}`}
                  onClick={() => setAudio(!audio)}
                >
                  <span>
                    {audio ? "Ⅱ" : "▷"} AUDIO LOG_0{specimen + 1}.WAV
                  </span>
                  <div className="waveform">
                    {Array.from({ length: 32 }, (_, i) => (
                      <i
                        key={i}
                        style={{ height: `${8 + ((i * 13) % 30)}px` }}
                      />
                    ))}
                  </div>
                  <small>
                    {audio
                      ? "PLAYING RECONSTRUCTED SIGNAL"
                      : "PLAY RECOVERED TRANSMISSION"}
                  </small>
                </button>
                <span className="red fine">
                  WARNING: DO NOT ATTEMPT CONTACT.
                </span>
              </aside>
            </div>
          </section>
        )}
        <div className="crt-scanlines screen-effect" />
        <div className="noise screen-effect" />
        <div className="scene-bottom">
          <span>LRD // CLASSIFIED MATERIAL</span>
          <span>DO NOT DUPLICATE · DO NOT DISTRIBUTE</span>
          <span>© 1998 LIMINAL RESEARCH</span>
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <i /> LOCAL CONNECTION{" "}
          <span className="muted">/ OFFLINE ARCHIVE</span>
        </span>
        <span className="footer-hint">
          <kbd>↵</kbd> SELECT <kbd>ESC</kbd> BACK{" "}
          <span className="footer-line" /> HEADPHONES RECOMMENDED{" "}
          <Icon name="sound" size={14} />
        </span>
        <span className="build-label">
          BUILD 098.24 <span className="green">■</span>
        </span>
      </footer>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <section
            className="terminal-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              SYSTEM / {modal.toUpperCase()}
              <button onClick={() => setModal(null)} aria-label="Close dialog">
                ×
              </button>
            </div>
            {modal === "archive" ? (
              <>
                <h2>RECOVERED TAPES</h2>
                {BIOMES.map((option, i) => (
                  <button
                    className="archive-item"
                    key={option.id}
                    onClick={() => {
                      setModal(null)
                      setBiomeId(option.id)
                      setScanning(false)
                      setEjected(false)
                      setScreen("hud")
                      setElapsed(i * 1200)
                    }}
                  >
                    <Icon name="tape" />
                    <span>
                      TAPE_{option.tape}
                      <strong>{option.name}</strong>
                      <small className="archive-description">{option.description}</small>
                    </span>
                    <span>PLAY ↗</span>
                  </button>
                ))}
              </>
            ) : modal === "settings" ? (
              <>
                <h2>SYSTEM SETTINGS</h2>
                <label className="setting">
                  MASTER VOLUME <span>{volume}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </label>
                <label className="setting toggle-setting">
                  ANALOG NOISE{" "}
                  <input
                    type="checkbox"
                    checked={grain}
                    onChange={(e) => setGrain(e.target.checked)}
                  />
                </label>
                <p className="muted">Settings apply to this preview session.</p>
              </>
            ) : (
              <>
                <Icon name="warning" size={32} />
                <h2>EJECT CURRENT TAPE?</h2>
                <p>Your current transmission will be interrupted.</p>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>CANCEL</button>
                  <button
                    onClick={() => {
                      setEjected(true)
                      setScreen("title")
                      setModal(null)
                    }}
                  >
                    EJECT TAPE ↗
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
