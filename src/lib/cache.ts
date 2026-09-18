const TTL_MS = 12_000

type Entry<T> = { at: number; value: T; inflight?: Promise<T> }

const memo = new Map<string, Entry<unknown>>()

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = memo.get(key) as Entry<T> | undefined
  if (hit && now - hit.at < TTL_MS && hit.value !== undefined && !hit.inflight) {
    return hit.value
  }
  if (hit?.inflight) return hit.inflight

  const inflight = fn().then(
    (value) => {
      memo.set(key, { at: Date.now(), value })
      return value
    },
    (err: unknown) => {
      memo.delete(key)
      throw err
    },
  )
  memo.set(key, { at: 0, value: undefined as T, inflight })
  return inflight
}

export function cacheTtlMs() {
  return TTL_MS
}
