import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Re-seed the demo database before the E2E suite so tests are deterministic.
 * The demo products + anomalies are recreated; resolved/undone state is reset.
 */
export default function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const venvPython = path.join(root, ".venv", "bin", "python");
  const seed = path.join(root, "store", "demo_enrich.py");
  console.log("[e2e] re-seeding demo data…");  execSync(`"${venvPython}" "${seed}"`, { cwd: root, stdio: "inherit" });
}
