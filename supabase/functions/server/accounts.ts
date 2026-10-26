export type Role = "admin" | "player"

export type Account = {
  id: string
  role: Role
  display_name: string
  username: string
  section_and_group: string
}

export type Identity = {
  id: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export type PlaySession = {
  id: string
  user_id: string
  username: string
  section_and_group: string
  display_name: string
  started_at: string
  source: "player_registration"
  outcome?: "active" | "escaped" | "eliminated"
}

// Determine role from identity metadata
export function roleFor(user: Identity): Role {
  return (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin") ? "admin" : "player"
}

export function validateUsername(value: unknown): string {
  if (typeof value !== "string") throw new Error("Username is required.")
  const trimmed = value.trim()
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new Error("Username must be between 2 and 40 characters.")
  }
  if (!/^[a-zA-Z0-9_\-\. ]+$/.test(trimmed)) {
    throw new Error("Username can only contain letters, numbers, spaces, dots, dashes, and underscores.")
  }
  return trimmed
}

export function validateSectionAndGroup(value: unknown): string {
  if (typeof value !== "string") throw new Error("Section and Group Number is required.")
  const trimmed = value.trim()
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new Error("Section and Group Number must be between 2 and 60 characters (e.g. BSCS 3A - Group 4).")
  }
  return trimmed
}

export function displayName(value: unknown): string {
  if (typeof value !== "string") return "Player"
  const name = value.trim().replace(/\s+/g, " ")
  if (name.length < 2 || name.length > 40 || /[\p{C}<>]/u.test(name)) {
    return name.slice(0, 40) || "Player"
  }
  return name
}

// Password hashing using Web Crypto SHA-256 with project salt
const SALT = "liminal-defect-secure-salt-2026";

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${SALT}:${password}:${SALT}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === expectedHash;
}
