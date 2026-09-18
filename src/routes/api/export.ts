import { createFileRoute } from "@tanstack/react-router"
import { handleExport, optionsResponse } from "@/lib/api-handlers.ts"

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      GET: async ({ request }) => handleExport(request),
    },
  },
})
