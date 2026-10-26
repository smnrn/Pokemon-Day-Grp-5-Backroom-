import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
import { createAccountApi } from "./account-api.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Health check endpoints
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/make-server-15374a1d/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Mount account API routes
const accountApi = createAccountApi({
  authenticate: async (token: string) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      app_metadata: data.user.app_metadata,
      user_metadata: data.user.user_metadata,
    };
  },
  store: {
    get: kv.get,
    set: kv.set,
    mset: kv.mset,
    list: kv.getByPrefix,
  },
  supabaseClient: supabaseAdmin,
});

app.route("/make-server-15374a1d", accountApi);
app.route("/", accountApi);

Deno.serve(app.fetch);