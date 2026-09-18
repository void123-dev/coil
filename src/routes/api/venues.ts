import { createFileRoute } from "@tanstack/react-router"
import { handleVenues, optionsResponse } from "@/lib/api-handlers.ts"

export const Route = createFileRoute("/api/venues")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      GET: async ({ request }) => handleVenues(request),
    },
  },
})
