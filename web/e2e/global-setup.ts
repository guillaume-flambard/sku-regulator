import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Re-seed the demo database before the E2E suite so tests are deterministic.
 * The demo products + anomalies are recreated; resolved/undone state is reset.
 *
 * Locally we run against the repo `.venv`; in CI there is no venv, so fall back
 * to a `python3` on PATH (the workflow installs the deps into it).
 */
export default function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const venvPython = path.join(root, ".venv", "bin", "python");
  const python = existsSync(venvPython) ? venvPython : process.env.PYTHON ?? "python3";
  const seed = path.join(root, "store", "demo_enrich.py");
  console.log(`[e2e] re-seeding demo data with ${python}…`);
  execSync(`"${python}" "${seed}"`, { cwd: root, stdio: "inherit" });
}
