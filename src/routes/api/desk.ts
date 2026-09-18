import { createFileRoute } from "@tanstack/react-router"
import { handleDesk, optionsResponse } from "@/lib/api-handlers.ts"

export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      GET: async ({ request }) => handleDesk(request),
    },
  },
})
