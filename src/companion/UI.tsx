import type { ReactNode } from "react"
import { PillarExplanation, usePillarVisibility } from "./Pillars"
import type { Pillar } from "./education-model"
export function Icon({ name, size = 17 }: {
  name: string
  size?: number
}) {
  const paths: Record<string, ReactNode> = {
    terminal: (
      <>
        <path d="m5 7 4 4-4 4M12 16h7" />
        <rect x="2" y="3" width="20" height="18" rx="1" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18M7 16l4-6 4 3 6-9" />
        <circle cx="11" cy="10" r="1" />
      </>
    ),
    stream: (
      <>
        <path d="m8 5-5 7 5 7M16 5l5 7-5 7M14 3l-4 18" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8z" />,
    plus: <path d="M12 4v16M4 12h16" />,
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 19 19 5M7 5h12v12" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    pulse: <path d="M2 12h5l3-8 4 16 3-8h5" />,
    warning: (
      <>
        <path d="m12 3 10 18H2zM12 9v5M12 17v1" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    battery: (
      <>
        <rect x="2" y="6" width="18" height="12" />
        <path d="M22 10v4M6 9v6M10 9v6M14 9v6" />
      </>
    ),
    sound: (
      <>
        <path d="M3 9h4l5-5v16l-5-5H3zM16 8q5 4 0 8M19 5q7 7 0 14" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
      </>
    ),
    file: (
      <>
        <path d="M5 2h10l4 4v16H5zM14 2v5h5M8 12h8M8 16h6" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    book: (
      <>
        <path d="M12 5v16M12 5C8 2 4 3 2 4v16c3-2 7-1 10 1 3-2 7-3 10-1V4c-2-1-6-2-10 1Z" />
        <path d="M5 8h4M15 8h4M5 12h4M15 12h4" />
      </>
    ),
  }
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
      {paths[name] ?? paths.terminal}
    </svg>
  )
}
export function Panel({
  code,
  title,
  tag,
  children,
  className = "",
  action,
  pillar,
}: {
  code: string
  title: string
  tag?: string
  children: ReactNode
  className?: string
  action?: ReactNode
  pillar?: Pillar | Pillar[]
}) {
  const visible = usePillarVisibility(pillar)
  if (!visible) return null
  const pillars = pillar ? (Array.isArray(pillar) ? pillar : [pillar]) : []
  return (
    <section className={`c-panel ${className}`} data-pillar={pillars.join(" ")}>
      <div className="c-panel-heading">
        <span className="c-panel-code">{code}</span>
        <h2>{title}</h2>
        {tag && <span className="c-panel-tag">{tag}</span>}
        {action && <div className="c-panel-action">{action}</div>}
      </div>
      {pillars.map((key) => (
        <PillarExplanation key={key} pillar={key} />
      ))}
      {children}
    </section>
  )
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode
  tone?: string
}) {
  return (
    <span className={`c-badge c-tone-${tone}`}>
      <i />
      {children}
    </span>
  )
}
export function Metric({
  label,
  value,
  detail,
  tone = "yellow",
  icon = "chart",
}: {
  label: string
  value: string
  detail: string
  tone?: string
  icon?: string
}) {
  return (
    <div className={`c-metric c-tone-${tone}`}>
      <div>
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}
