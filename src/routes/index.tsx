import { createFileRoute } from "@tanstack/react-router"
import { CoilDesk } from "@/components/coil/desk.tsx"
import { loadInitialDesk } from "@/lib/coil-load.ts"

export const Route = createFileRoute("/")({
  loader: () => loadInitialDesk(),
  component: Home,
})

function Home() {
  const initial = Route.useLoaderData()
  return <CoilDesk seed={initial} />
}
