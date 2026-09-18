import { createFileRoute } from "@tanstack/react-router"
import { handleCoil, optionsResponse } from "@/lib/api-handlers.ts"

export const Route = createFileRoute("/api/coil")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      GET: async ({ request }) => handleCoil(request),
    },
  },
})
