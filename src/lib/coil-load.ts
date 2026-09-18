import { createServerFn } from "@tanstack/react-start"
import { getBreadth, getCoilSnapshot, getVenuesPayload, parseCoilQuery } from "./coil-service.ts"

export const loadInitialDesk = createServerFn({ method: "GET" }).handler(async () => {
  const query = await parseCoilQuery(new URL("https://coil.local/api/coil"))
  const [snapshot, breadth, venues] = await Promise.all([
    getCoilSnapshot(query),
    getBreadth(query),
    getVenuesPayload(query),
  ])
  return { snapshot, breadth, venues }
})
