import { projectId, publicAnonKey } from "../../utils/supabase/info"
import { supabase } from "./supabase"

export const TOKEN_STORAGE_KEY = "silph:token"
export const ACCOUNT_STORAGE_KEY = "silph:account"

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthSession(token: string, account: unknown) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account))
    window.dispatchEvent(new Event("silph-auth-change"))
  } catch {
    /* Storage might be disabled */
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(ACCOUNT_STORAGE_KEY)
    window.dispatchEvent(new Event("silph-auth-change"))
  } catch {
    /* Storage might be disabled */
  }
}

export async function accountRequest(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
) {
  const localToken = getAuthToken()
  const token =
    accessToken ??
    localToken ??
    (await supabase.auth.getSession()).data.session?.access_token

  if (!token) throw new Error("Sign in to continue.")

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-15374a1d${path}`,
    {
      ...options,
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    },
  )

  if (response.status === 404)
    throw new Error(
      "The research division account server is currently unavailable. Please verify the backend deployment.",
    )

  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      body?.error ??
        `Account request failed (${response.status}). Please retry.`,
    )

  return body
}
