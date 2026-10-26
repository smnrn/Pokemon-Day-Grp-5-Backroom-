import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Link, Navigate, useLocation } from "react-router"
import {
  displayName,
  type Account,
  type PlaySession,
} from "../../supabase/functions/server/accounts"
import {
  accountRequest,
  clearAuthSession,
  getAuthToken,
  setAuthSession,
} from "./api"
import { projectId } from "../../utils/supabase/info"
import { supabase } from "./supabase"
import { Badge, Icon, Panel } from "./UI"
import { LandingExperience, MagneticButton } from "./LandingExperience"
import { BriefingButton } from "./LearningGuide"
import "./companion.css"

type AccountContext = {
  account: Account
  signOut: () => Promise<void>
}
const Context = createContext<AccountContext | null>(null)
export function useAccount() {
  const value = useContext(Context)
  if (!value) throw new Error("Account context is required.")
  return value
}

const SessionCtx = createContext<PlaySession | null>(null)
export function usePlaySession() {
  return useContext(SessionCtx)
}

function AccessShell({
  children,
  label = "ACCOUNT ACCESS",
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <LandingExperience variant="terminal" label={label}>
      {children}
    </LandingExperience>
  )
}

function Credentials() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [username, setUsername] = useState("")
  const [sectionAndGroup, setSectionAndGroup] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setMessage("")
    setBusy(true)

    try {
      const endpoint =
        mode === "signup"
          ? `https://${projectId}.supabase.co/functions/v1/make-server-15374a1d/auth/register`
          : `https://${projectId}.supabase.co/functions/v1/make-server-15374a1d/auth/login`

      const payload =
        mode === "signup"
          ? {
              username: username.trim(),
              section_and_group: sectionAndGroup.trim(),
              password,
            }
          : {
              username: username.trim(),
              password,
            }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || `Authentication failed (${response.status})`)
      }

      if (!data?.token || !data?.account) {
        throw new Error("Invalid response received from the security server.")
      }

      setAuthSession(data.token, data.account)
      setPassword("")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed. Please retry.",
      )
    } finally {
      setBusy(false)
    }
  }

  function fillAdminDemo() {
    setUsername("admin")
    setPassword("Admin123456!")
    setError("")
    setMessage("Admin credentials filled. Click SIGN IN to enter professor/admin view.")
  }

  return (
    <AccessShell>
      <Panel
        code="01"
        title={
          mode === "signin"
            ? "SIGN IN TO THE TERMINAL"
            : "CREATE PLAYER ACCOUNT"
        }
        tag="RESEARCH DATABASE AUTH"
        className="c-access-panel"
      >
        <div key={mode} className="l-terminal-laser" aria-hidden="true" />
        <div className="c-access-tabs">
          <button
            type="button"
            aria-pressed={mode === "signin"}
            onClick={() => {
              setMode("signin")
              setError("")
              setMessage("")
            }}
          >
            SIGN IN
          </button>
          <button
            type="button"
            aria-pressed={mode === "signup"}
            onClick={() => {
              setMode("signup")
              setError("")
              setMessage("")
            }}
          >
            CREATE PLAYER ACCOUNT
          </button>
        </div>
        <form className="c-access-form" onSubmit={submit}>
          <label>
            USERNAME
            <input
              required
              minLength={2}
              maxLength={40}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                mode === "signup"
                  ? "Choose a username (e.g. Agent-04)"
                  : "Enter your username"
              }
            />
          </label>
          {mode === "signup" && (
            <label>
              SECTION AND GROUP NUMBER
              <input
                required
                minLength={2}
                maxLength={60}
                value={sectionAndGroup}
                onChange={(e) => setSectionAndGroup(e.target.value)}
                placeholder="e.g. BSCS 3A - Group 4"
              />
            </label>
          )}
          <label>
            PASSWORD
            <input
              required
              type="password"
              minLength={mode === "signup" ? 6 : 1}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signup"
                  ? "At least 6 characters"
                  : "Your account password"
              }
            />
          </label>
          {error && (
            <p className="c-access-error" role="alert">
              <Icon name="warning" size={15} />
              {error}
            </p>
          )}
          {message && (
            <p className="c-access-message" role="status">
              {message}
            </p>
          )}
          <MagneticButton className="c-primary-button" disabled={busy}>
            {busy
              ? "[INITIALIZING LINK…]"
              : mode === "signin"
                ? "SIGN IN"
                : "CREATE PLAYER ACCOUNT"}
            <Icon name="arrow" size={15} />
          </MagneticButton>
          {mode === "signin" && (
            <button
              type="button"
              className="c-secondary-button"
              onClick={fillAdminDemo}
              style={{ fontSize: "0.75rem", opacity: 0.85 }}
            >
              USE ADMIN LOGIN (QUICK FILL)
            </button>
          )}
          <p className="c-method">
            {mode === "signup"
              ? "New player accounts require Username, Section and Group Number, and Password. Saved to research database roster."
              : "Students and administrators use the same portal. Assigned role determines clearance level."}
          </p>
        </form>
      </Panel>
    </AccessShell>
  )
}

export function AccountBoundary({
  children,
  loginPage = false,
}: {
  children: ReactNode
  loginPage?: boolean
}) {
  const route = useLocation()
  const [token, setToken] = useState<string | null>(() => getAuthToken())
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    function onAuthChange() {
      setToken(getAuthToken())
    }
    window.addEventListener("silph-auth-change", onAuthChange)
    window.addEventListener("storage", onAuthChange)
    const { data } = supabase.auth.onAuthStateChange(() => {
      setToken(getAuthToken())
    })
    return () => {
      window.removeEventListener("silph-auth-change", onAuthChange)
      window.removeEventListener("storage", onAuthChange)
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const currentToken = getAuthToken()
    if (!currentToken) {
      setAccount(null)
      setError("")
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError("")

    accountRequest("/me", { signal: controller.signal }, currentToken)
      .then((body) => {
        if (controller.signal.aborted) return
        const next = body?.account
        if (!next || !["player", "admin"].includes(next.role)) {
          throw new Error("Account clearance check returned invalid data.")
        }
        setAccount(next)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setAccount(null)
          setError(
            err instanceof Error
              ? err.message
              : "Account verification failed.",
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [token, retry])

  async function signOut() {
    clearAuthSession()
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      /* ignore */
    }
    if (account) {
      try {
        sessionStorage.removeItem(`silph-admin-records:${account.id}`)
        sessionStorage.removeItem(`silph-admin-pending:${account.id}`)
      } catch {
        /* Storage may be blocked. */
      }
    }
    setAccount(null)
    setToken(null)
  }

  if (!token && !account) {
    return loginPage ? (
      <Credentials />
    ) : (
      <Navigate
        replace
        to={`/login?next=${encodeURIComponent(route.pathname)}`}
      />
    )
  }

  if (error) {
    return (
      <AccessShell label="CONNECTION REQUIRED">
        <Panel
          code="!"
          title="ACCOUNT VERIFICATION UNAVAILABLE"
          className="c-access-panel"
        >
          <div className="c-access-form">
            <p className="c-access-error" role="alert">
              {error}
            </p>
            <button
              className="c-primary-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              RETRY VERIFICATION
            </button>
            <button
              className="c-secondary-button"
              onClick={() => void signOut()}
            >
              SIGN OUT
            </button>
          </div>
        </Panel>
      </AccessShell>
    )
  }

  if (loading || !account) {
    return (
      <AccessShell>
        <div className="c-access-loading" role="status">
          <Icon name="pulse" /> VERIFYING TERMINAL CLEARANCE…
        </div>
      </AccessShell>
    )
  }

  return (
    <Context.Provider
      key={`${account.id}:${account.role}`}
      value={{ account, signOut }}
    >
      {children}
    </Context.Provider>
  )
}

export function GameCheckIn({ children }: { children: ReactNode }) {
  const { account, signOut } = useAccount()
  const [name, setName] = useState(account.display_name || account.username)
  const [acknowledged, setAcknowledged] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [registration, setRegistration] = useState<PlaySession | null>(() => {
    try {
      const cached = sessionStorage.getItem("silph:active-play-session")
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  async function start(event?: FormEvent) {
    if (event) event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const body = await accountRequest("/play-sessions", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName(name || account.display_name || account.username),
          analytics_acknowledged: true,
        }),
      })
      if (!body?.session?.id) {
        throw new Error(
          "Session registration was not acknowledged. Please retry.",
        )
      }
      setRegistration(body.session)
      try {
        sessionStorage.setItem("silph:active-play-session", JSON.stringify(body.session))
      } catch {
        /* storage safe */
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Check-in failed. Please retry.",
      )
    } finally {
      setBusy(false)
    }
  }

  if (registration) {
    return (
      <SessionCtx.Provider value={registration}>
        {children}
      </SessionCtx.Provider>
    )
  }

  return (
    <AccessShell label={`${account.role.toUpperCase()} / CHECK-IN`}>
      <Panel
        code="02"
        title="PLAYER SESSION CHECK-IN"
        tag="REQUIRED BEFORE PLAY"
        className="c-access-panel"
      >
        <form className="c-access-form" onSubmit={start}>
          <BriefingButton lobby />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="green">
              SIGNED IN · {account.username}
            </Badge>
            {account.section_and_group && (
              <Badge tone="yellow">
                {account.section_and_group}
              </Badge>
            )}
          </div>
          <h2>Confirm Field Identity</h2>
          <p>
            Your session is linked to <strong>{account.section_and_group || "your section"}</strong> in the professor's research analytics roster.
          </p>
          <label>
            PLAYER DISPLAY NAME
            <input
              required
              autoFocus
              minLength={2}
              maxLength={40}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name or nickname"
            />
          </label>
          <label className="c-consent">
            <input
              type="checkbox"
              required
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I understand that my username, section, and session start will be visible to exhibition administrators.
            </span>
          </label>
          {error && (
            <p className="c-access-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="c-primary-button" disabled={busy}>
            {busy ? "REGISTERING SESSION…" : "REGISTER & START GAME"}
            <Icon name="play" size={15} />
          </button>
          {account.role === "admin" && (
            <button
              type="button"
              className="c-secondary-button"
              onClick={() => void start()}
              style={{ borderColor: "#8ae88b", color: "#8ae88b" }}
            >
              ADMIN INSTANT GAMEPLAY LAUNCH ↗
            </button>
          )}
          <Link className="c-secondary-button" to="/app">
            BACK TO DATA-DEX
          </Link>
          <button
            type="button"
            className="c-secondary-button"
            onClick={() => void signOut()}
          >
            NOT YOUR ACCOUNT? SIGN OUT
          </button>
          <p className="c-method">
            Check-in records your session start with your Section and Group Number.
          </p>
        </form>
      </Panel>
    </AccessShell>
  )
}
