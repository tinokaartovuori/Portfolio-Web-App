import type { H3Event } from 'h3'

/**
 * A small in-memory guard per client address: at most `limit` hits of a
 * named action inside a sliding window. It only has to stop a script from
 * running the like counter up or flooding the visit log, so it is a Map and
 * a clock rather than a store, and it forgets everything on restart.
 *
 * The address is read from `X-Forwarded-For`, which the reverse proxy in
 * front of the app sets; it is never written anywhere.
 */
const hits = new Map<string, { count: number; start: number }>()
const MAX_ENTRIES = 10_000

export function rateLimited(
  event: H3Event,
  action: string,
  limit: number,
  windowMs: number,
) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = `${action}:${ip}`
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || now - entry.start > windowMs) {
    if (hits.size >= MAX_ENTRIES) prune(now, windowMs)
    hits.set(key, { count: 1, start: now })
    return false
  }
  entry.count += 1
  return entry.count > limit
}

function prune(now: number, windowMs: number) {
  for (const [key, entry] of hits) {
    if (now - entry.start > windowMs) hits.delete(key)
  }
  // Still full of live entries: drop the oldest rather than grow without end
  if (hits.size >= MAX_ENTRIES) {
    const oldest = hits.keys().next().value
    if (oldest !== undefined) hits.delete(oldest)
  }
}
