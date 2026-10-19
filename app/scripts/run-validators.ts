// Runs the data validators owned by streams A and B (PLAN.md §5.5) if they exist yet.
// validate-geo.ts belongs to A, validate-kb.ts to B; this runner belongs to C.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const validators = ["validate-geo.ts", "validate-kb.ts"];
let failed = false;

for (const file of validators) {
  const full = path.join(__dirname, file);
  if (!existsSync(full)) {
    console.log(`skip ${file} (not created yet)`);
    continue;
  }
  console.log(`run  ${file}`);
  const result = spawnSync(process.execPath, ["--import", "tsx", full], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
