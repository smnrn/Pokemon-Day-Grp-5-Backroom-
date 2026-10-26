import type { Role } from "../../supabase/functions/server/accounts"

export function loginDestination(role: Role, requested: string | null): string {
  // Only known protected routes can be return destinations. Never redirect to
  // an arbitrary URL or grant player accounts an administrator destination.
  const target = requested?.replace(/\/+$/, "")
  if (target === "/game" || target === "/app") return target
  if (target === "/admin" && role === "admin") return "/admin"
  return role === "admin" ? "/admin" : "/app"
}

export function applicationBase(base: string): string {
  return (
    new URL(base, "https://silph.invalid").pathname.replace(/\/$/, "") || "/"
  )
}

export function isAuthenticationCallback(
  search: string,
  hash: string,
): boolean {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ""))
  return (
    query.has("code") ||
    fragment.has("access_token") ||
    fragment.has("error_description")
  )
}
