import { accountRequest } from "./api"
import {
  normalizeBatch,
  type Telemetry,
} from "../../supabase/functions/server/telemetry"
async function request(events?: Telemetry[], signal?: AbortSignal) {
  return accountRequest("/telemetry", {
    method: events ? "POST" : "GET",
    body: events ? JSON.stringify({ events }) : undefined,
    signal,
  })
}
export async function loadCloud(signal?: AbortSignal) {
  const body = await request(undefined, signal)
  if (!body || !Array.isArray(body.events)) {
    throw new Error("Unexpected cloud response. Records remain on this device.")
  }
  return body.events.length ? normalizeBatch(body.events) : []
}
export async function saveCloud(events: Telemetry[]) {
  const body = await request(events)
  if (body?.saved !== events.length) {
    throw new Error("Cloud write was not acknowledged. Records remain queued.")
  }
}
