import { createFileRoute } from "@tanstack/react-router"
import { handleBreadth, optionsResponse } from "@/lib/api-handlers.ts"

export const Route = createFileRoute("/api/breadth")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      GET: async ({ request }) => handleBreadth(request),
    },
  },
})
