/**
 * Client Zero proof-harness CLI.
 *
 *   run    <fixture.json> [--out <dir>] [--now <iso>] [--salt <s>]
 *   verify <proof.json>
 *   regen                      # regenerate all committed sample artifacts
 *
 * Run with Node's native type stripping (no build step, no dependencies):
 *   node --experimental-strip-types proof/src/cli.ts run proof/fixtures/lead-approved.json
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanPii,
  verifyChain,
} from "../../packages/core/src/index.ts";
import type { ProofArtifact } from "../../packages/core/src/index.ts";
import { runScenario } from "./harness.ts";
import { renderReport } from "./report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = resolve(HERE, "..");
const FIXTURES_DIR = join(PROOF_DIR, "fixtures");
const ARTIFACTS_DIR = join(PROOF_DIR, "artifacts");

/** Fixtures whose generated artifacts are committed to the repo. */
const COMMITTED_SAMPLES = ["lead-approved", "lead-blocked-compliance"];

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      out[args[i].slice(2)] = args[i + 1];
      i += 1;
    }
  }
  return out;
}

function writeArtifact(artifact: ProofArtifact, outDir: string): { json: string; md: string } {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `${artifact.scenarioId}.proof.json`);
  const mdPath = join(outDir, `${artifact.scenarioId}.report.md`);
  writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderReport(artifact), "utf8");
  return { json: jsonPath, md: mdPath };
}

function cmdRun(args: string[]): number {
  const fixture = args[0];
  if (!fixture) {
    console.error("usage: run <fixture.json> [--out <dir>] [--now <iso>] [--salt <s>]");
    return 2;
  }
  const flags = parseFlags(args.slice(1));
  const artifact = runScenario(readJson(fixture), { now: flags.now, salt: flags.salt });
  if (flags.out) {
    const { json, md } = writeArtifact(artifact, flags.out);
    console.log(`wrote ${json}`);
    console.log(`wrote ${md}`);
  } else {
    console.log(JSON.stringify(artifact, null, 2));
  }
  console.log(
    `outcome=${artifact.outcome} chainValid=${artifact.verification.chainValid} rawPiiFound=${artifact.piiScan.rawPiiFound}`,
  );
  return 0;
}

function cmdVerify(args: string[]): number {
  const path = args[0];
  if (!path) {
    console.error("usage: verify <proof.json>");
    return 2;
  }
  const artifact = readJson(path) as ProofArtifact;
  const chainValid = verifyChain(artifact);
  const { found } = scanPii({ ...artifact, piiScan: undefined });
  const ok = chainValid && !found;
  console.log(`scenario=${artifact.scenarioId}`);
  console.log(`outcome=${artifact.outcome}`);
  console.log(`chainValid=${chainValid}`);
  console.log(`rawPiiFound=${found}`);
  console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");
  return ok ? 0 : 1;
}

function cmdRegen(): number {
  for (const name of COMMITTED_SAMPLES) {
    const artifact = runScenario(readJson(join(FIXTURES_DIR, `${name}.json`)));
    // scenarioId in fixtures equals the file stem, so artifact names line up.
    const { json, md } = writeArtifact(artifact, ARTIFACTS_DIR);
    console.log(`regenerated ${json} + ${md} (outcome=${artifact.outcome})`);
  }
  return 0;
}

function main(): number {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "run":
      return cmdRun(rest);
    case "verify":
      return cmdVerify(rest);
    case "regen":
      return cmdRegen();
    case "list":
      for (const f of readdirSync(FIXTURES_DIR)) console.log(f);
      return 0;
    default:
      console.error("usage: cli.ts <run|verify|regen|list> ...");
      return 2;
  }
}

process.exit(main());
