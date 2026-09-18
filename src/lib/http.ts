export function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("Origin")?.trim()
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

export const CORS_HEADERS: Record<string, string> = corsHeaders()

export function jsonResponse(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string>; request?: Request },
) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...corsHeaders(init?.request),
      "Cache-Control": "public, max-age=12",
      ...init?.headers,
    },
  })
}

export function optionsResponse(request?: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export function textResponse(
  body: string,
  contentType: string,
  extra?: Record<string, string>,
  request?: Request,
) {
  return new Response(body, {
    headers: {
      ...corsHeaders(request),
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=12",
      ...extra,
    },
  })
}

export async function getJson<T>(url: string, ms = 4500): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: {
        Accept: "application/json",
        "User-Agent": "COIL-1.0",
      },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
