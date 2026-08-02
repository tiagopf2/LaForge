import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * Guard around `scripts/seed.ts`.
 *
 * The seed runs against whatever DATABASE_URL points at, which may be the
 * studio's live database, so it must never be able to remove member data.
 *
 * This check fails *closed*: if the seed file cannot be read or scanned, the
 * seed does not run. A guard that silently skips itself is worse than no guard
 * at all, because it still gets trusted.
 */

const seedFile = path.resolve(process.cwd(), "scripts/seed.ts");

const FORBIDDEN: Array<{ pattern: RegExp; describes: string }> = [
  { pattern: /\.\s*delete\s*\(/, describes: "a .delete() call" },
  { pattern: /\.\s*deleteMany\s*\(/, describes: "a .deleteMany() call" },
  {
    pattern: /\$(execute|query)Raw(Unsafe)?/,
    describes: "a raw SQL escape hatch that this guard cannot inspect",
  },
  {
    pattern: /\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM)\b/i,
    describes: "a destructive SQL statement",
  },
];

function abort(reason: string): never {
  console.error(`Seed aborted: ${reason}`);
  console.error(
    "scripts/seed.ts must never delete data — it can run against the live studio database."
  );
  console.error("Do not weaken this check to push a seed through; fix the seed instead.");
  process.exit(1);
}

let content: string;
try {
  content = fs.readFileSync(seedFile, "utf-8");
} catch (err) {
  abort(`could not read ${seedFile} (${(err as Error).message}).`);
}

const violations = FORBIDDEN.filter(({ pattern }) => pattern.test(content));

if (violations.length > 0) {
  abort(`scripts/seed.ts contains ${violations.map((v) => v.describes).join(", ")}.`);
}

execSync("tsx --require dotenv/config scripts/seed.ts", { stdio: "inherit" });
