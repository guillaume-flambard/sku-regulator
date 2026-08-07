import { api } from "@/lib/api";
import Home from "@/components/home";

export const dynamic = "force-dynamic";

export default async function Page() {
  let stats = null;
  try {
    stats = await api.stats();
  } catch {
    // backend down — render the demo with graceful fallback
  }
  return <Home stats={stats} />;
}
