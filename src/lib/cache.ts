const TTL_MS = 12_000
const SERIES_TTL_MS = 60_000

type Entry<T> = { at: number; ttl: number; value: T; inflight?: Promise<T> }

const memo = new Map<string, Entry<unknown>>()

export async function cached<T>(key: string, fn: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const now = Date.now()
  const hit = memo.get(key) as Entry<T> | undefined
  if (hit && now - hit.at < hit.ttl && hit.value !== undefined && !hit.inflight) {
    return hit.value
  }
  if (hit?.inflight) return hit.inflight

  const inflight = fn().then(
    (value) => {
      memo.set(key, { at: Date.now(), ttl: ttlMs, value })
      return value
    },
    (err: unknown) => {
      memo.delete(key)
      throw err
    },
  )
  memo.set(key, { at: 0, ttl: ttlMs, value: undefined as T, inflight })
  return inflight
}

export function cacheTtlMs() {
  return TTL_MS
}

export function seriesCacheTtlMs() {
  return SERIES_TTL_MS
}