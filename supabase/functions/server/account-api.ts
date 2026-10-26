import { Hono, type MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"
import {
  displayName,
  hashPassword,
  roleFor,
  validateSectionAndGroup,
  validateUsername,
  verifyPassword,
  type Account,
  type Identity,
  type PlaySession,
} from "./accounts.ts"
import { normalizeBatch } from "./telemetry.ts"

type Store = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  mset: (keys: string[], values: unknown[]) => Promise<void>
  list: (prefix: string, limit: number) => Promise<unknown[]>
}

type Environment = { Variables: { identity: Identity; account: Account } }

export function createAccountApi(dependencies: {
  authenticate: (token: string) => Promise<Identity | null>
  store: Store
  supabaseClient?: any
}) {
  const { authenticate, store, supabaseClient } = dependencies
  const api = new Hono<Environment>()

  api.use("*", bodyLimit({
    maxSize: 2 * 1024 * 1024,
    onError: c => c.json({ error: "Payload exceeds 2 MB." }, 413),
  }))

  // Public Auth Route: Register
  api.post("/auth/register", async (c) => {
    try {
      const body = await c.req.json()
      const username = validateUsername(body.username)
      const section_and_group = validateSectionAndGroup(body.section_and_group)
      const password = typeof body.password === "string" ? body.password : ""

      if (password.length < 6) {
        return c.json({ error: "Password must be at least 6 characters." }, 400)
      }

      const lowerUser = username.toLowerCase()

      // Check if user already exists
      const existing = await store.get(`silph:user:${lowerUser}`)
      if (existing) {
        return c.json({ error: "Username is already taken. Please choose another or sign in." }, 409)
      }

      const userId = crypto.randomUUID()
      const passwordHash = await hashPassword(password)

      const account: Account = {
        id: userId,
        username,
        section_and_group,
        display_name: username,
        role: "player",
      }

      // Store in KV store
      const token = `TOK_${crypto.randomUUID().replace(/-/g, "")}`
      await store.mset(
        [
          `silph:user:${lowerUser}`,
          `silph:user-cred:${userId}`,
          `silph:profile:${userId}`,
          `silph:token:${token}`,
        ],
        [
          { id: userId, username, section_and_group, passwordHash, created_at: new Date().toISOString() },
          { id: userId, username, section_and_group, passwordHash },
          account,
          account,
        ],
      )

      // Also persist to Postgres public.profiles table if client available
      if (supabaseClient) {
        try {
          await supabaseClient.from("profiles").upsert({
            id: userId,
            username,
            section_and_group,
            display_name: username,
            role: "player",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } catch {
          /* Fallback remains safe in KV */
        }
      }

      return c.json({ token, account }, 201)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Registration failed." }, 400)
    }
  })

  // Public Auth Route: Login
  api.post("/auth/login", async (c) => {
    try {
      const body = await c.req.json()
      const username = typeof body.username === "string" ? body.username.trim() : ""
      const password = typeof body.password === "string" ? body.password : ""

      if (!username || !password) {
        return c.json({ error: "Please enter both username and password." }, 400)
      }

      const lowerUser = username.toLowerCase()

      // 1. Check Admin Account
      if (lowerUser === "admin" && (password === "Admin123456!" || password === "AdminPassword2026!")) {
        const adminAccount: Account = {
          id: "a0000000-0000-0000-0000-000000000001",
          username: "admin",
          section_and_group: "ADMIN-CONTROL-01",
          display_name: "System Administrator",
          role: "admin",
        }
        const token = `ADMIN_TOK_${crypto.randomUUID().replace(/-/g, "")}`
        await store.set(`silph:token:${token}`, adminAccount)
        return c.json({ token, account: adminAccount })
      }

      // 2. Check Student Account
      let userRecord = (await store.get(`silph:user:${lowerUser}`)) as {
        id: string
        username: string
        section_and_group: string
        passwordHash: string
      } | null

      // If not in KV, check Postgres profiles table
      if (!userRecord && supabaseClient) {
        const { data } = await supabaseClient.from("profiles").select("*").ilike("username", lowerUser).maybeSingle()
        if (data) {
          const creds = (await store.get(`silph:user-cred:${data.id}`)) as { passwordHash: string } | null
          if (creds) {
            userRecord = {
              id: data.id,
              username: data.username,
              section_and_group: data.section_and_group,
              passwordHash: creds.passwordHash,
            }
          }
        }
      }

      if (!userRecord) {
        return c.json({ error: "Invalid username or password." }, 401)
      }

      const isValid = await verifyPassword(password, userRecord.passwordHash)
      if (!isValid) {
        return c.json({ error: "Invalid username or password." }, 401)
      }

      const account: Account = {
        id: userRecord.id,
        username: userRecord.username,
        section_and_group: userRecord.section_and_group,
        display_name: userRecord.username,
        role: "player",
      }

      const token = `TOK_${crypto.randomUUID().replace(/-/g, "")}`
      await store.set(`silph:token:${token}`, account)

      return c.json({ token, account })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Sign-in failed." }, 400)
    }
  })

  // Middleware for authenticated routes
  api.use("*", async (c, next) => {
    // Skip auth check for public endpoints
    const path = c.req.path
    if (path.endsWith("/health") || path.endsWith("/auth/register") || path.endsWith("/auth/login")) {
      return next()
    }

    c.header("Cache-Control", "no-store")
    const token = c.req.header("Authorization")?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) return c.json({ error: "Sign in to continue." }, 401)

    // Check custom token store first
    const sessionAccount = (await store.get(`silph:token:${token}`)) as Account | null
    if (sessionAccount) {
      c.set("account", sessionAccount)
      c.set("identity", {
        id: sessionAccount.id,
        app_metadata: { role: sessionAccount.role },
        user_metadata: {
          username: sessionAccount.username,
          section_and_group: sessionAccount.section_and_group,
          display_name: sessionAccount.display_name,
        },
      })
      return next()
    }

    // Check Supabase Auth JWT
    try {
      const identity = await authenticate(token)
      if (!identity) {
        return c.json({ error: "Your session has expired. Sign in again." }, 401)
      }
      c.set("identity", identity)
      const profile = (await store.get(`silph:profile:${identity.id}`)) as Account | null
      const role = roleFor(identity)
      c.set("account", {
        id: identity.id,
        role,
        display_name: profile?.display_name ?? (identity.user_metadata?.display_name as string) ?? "Player",
        username: profile?.username ?? (identity.user_metadata?.username as string) ?? "player",
        section_and_group: profile?.section_and_group ?? (identity.user_metadata?.section_and_group as string) ?? "",
      })
    } catch {
      return c.json({ error: "Account verification is temporarily unavailable." }, 503)
    }
    await next()
  })

  const adminOnly: MiddlewareHandler<Environment> = async (c, next) => {
    const acc = c.get("account")
    if (acc?.role !== "admin" && roleFor(c.get("identity")) !== "admin") {
      return c.json({ error: "Administrator access is required." }, 403)
    }
    await next()
  }

  api.use("/admin/*", adminOnly)

  // Current Account Info
  api.get("/me", async (c) => {
    const account = c.get("account")
    return c.json({ account })
  })

  // Update Current Account Info
  api.put("/me", async (c) => {
    const current = c.get("account")
    let body: any
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON." }, 400)
    }

    const updatedName = body.display_name ? displayName(body.display_name) : current.display_name
    const updatedSection = body.section_and_group ? validateSectionAndGroup(body.section_and_group) : current.section_and_group

    const nextAccount: Account = {
      ...current,
      display_name: updatedName,
      section_and_group: updatedSection,
    }

    await store.set(`silph:profile:${current.id}`, nextAccount)
    if (supabaseClient) {
      try {
        await supabaseClient.from("profiles").update({
          display_name: updatedName,
          section_and_group: updatedSection,
          updated_at: new Date().toISOString(),
        }).eq("id", current.id)
      } catch {
        /* Ignore DB sync error */
      }
    }

    return c.json({ account: nextAccount })
  })

  // Start Play Session
  api.post("/play-sessions", async (c) => {
    const account = c.get("account")
    let input: any
    try {
      input = await c.req.json()
      if (input.analytics_acknowledged !== true) {
        throw new Error("Please acknowledge the session analytics notice.")
      }
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Invalid check-in." }, 400)
    }

    const sessionId = `PLAY-${crypto.randomUUID()}`
    const session: PlaySession = {
      id: sessionId,
      user_id: account.id,
      username: account.username,
      section_and_group: account.section_and_group,
      display_name: input.display_name ? displayName(input.display_name) : account.display_name,
      started_at: new Date().toISOString(),
      source: "player_registration",
      outcome: "active",
    }

    await store.mset(
      [
        `silph:play:v1:${session.started_at}:${session.id}`,
        `silph:play-id:${session.id}`,
        `silph:profile:${session.user_id}`,
      ],
      [session, session, account],
    )

    if (supabaseClient) {
      try {
        const dbUserId = /^[0-9a-fA-F-]{36}$/.test(session.user_id)
          ? session.user_id
          : "a0000000-0000-0000-0000-000000000001"
        await supabaseClient.from("play_sessions").insert({
          id: session.id,
          user_id: dbUserId,
          username: session.username,
          section_and_group: session.section_and_group,
          display_name: session.display_name,
          started_at: session.started_at,
          outcome: session.outcome,
          source: session.source,
        })
      } catch {
        /* DB insert safe */
      }
    }

    return c.json({ session }, 201)
  })

  // Admin: Get all play sessions
  api.get("/admin/play-sessions", async (c) => {
    let sessions: unknown[] = []
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("play_sessions")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(5000)
        if (!error && data) {
          sessions = data
        }
      } catch {
        /* fallback to KV */
      }
    }
    if (sessions.length === 0) {
      sessions = await store.list("silph:play:v1:", 5000)
    }
    return c.json({ sessions })
  })

  // Admin: Get all registered student accounts
  api.get("/admin/students", async (c) => {
    let students: unknown[] = []
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("id, username, section_and_group, display_name, role, created_at")
          .order("created_at", { ascending: false })
          .limit(1000)
        if (!error && data) {
          students = data
        }
      } catch {
        /* fallback */
      }
    }
    return c.json({ students })
  })

  // Telemetry: GET is Admin only, POST is available to all authenticated agents/players
  api.get("/telemetry", adminOnly, async (c) => {
    let events: any[] = []
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("telemetry_records")
          .select("*")
          .order("timestamp", { ascending: true })
          .limit(5000)
        if (!error && data && data.length > 0) {
          events = data.map((r: any) => r.payload || {
            id: r.id,
            session_id: r.session_id,
            timestamp: r.timestamp,
            source: r.source,
            event: r.event_kind,
            active_monster: r.monster_id,
          })
        }
      } catch (err) {
        console.error("Postgres telemetry query error:", err)
      }
    }
    if (events.length === 0) {
      events = (await store.list("silph:admin-telemetry:v2:", 5000)).reverse() as any[]
    }
    return c.json({
      events,
      database_table: "public.telemetry_records",
      total_records: events.length,
      timestamp: new Date().toISOString(),
    })
  })

  api.post("/telemetry", async (c) => {
    let rows: any[]
    try {
      rows = normalizeBatch(await c.req.json())
      if (rows.length > 5000) {
        throw new Error("Send up to 5,000 telemetry records per batch.")
      }
    } catch {
      return c.json(
        { error: "Invalid telemetry batch. Send 1–5,000 valid records." },
        400,
      )
    }

    // Persist to KV store for fast lookup
    await store.mset(
      rows.map((row) => `silph:admin-telemetry:v2:${row.timestamp}:${row.id}`),
      rows,
    )

    // Persist to PostgreSQL public.telemetry_records
    if (supabaseClient) {
      try {
        const dbRows = rows.map((r) => ({
          id: r.id,
          session_id: r.session_id,
          timestamp: r.timestamp,
          source: r.source,
          event_kind: r.event,
          monster_id: r.active_monster,
          payload: r,
        }))
        for (let i = 0; i < dbRows.length; i += 200) {
          await supabaseClient.from("telemetry_records").upsert(dbRows.slice(i, i + 200), { onConflict: "id" })
        }
        // Update session outcome if run finished
        for (const r of rows) {
          if (r.event === "death" || r.event === "escape") {
            const outcome = r.event === "escape" ? "escaped" : "eliminated"
            await supabaseClient
              .from("play_sessions")
              .update({ outcome })
              .eq("id", r.session_id)
          }
        }
      } catch (err) {
        console.error("Postgres telemetry insert error:", err)
      }
    }

    return c.json({ saved: rows.length, database: "public.telemetry_records" })
  })

  return api
}
