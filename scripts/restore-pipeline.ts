/**
 * GitHub Actions restore job: download zip from Drive → unzip → psql restore.
 * Env: DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_JSON, RESTORE_FILE_ID
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDrive, downloadFileBuffer } from "../src/lib/gdrive";
import { log } from "../src/lib/logger";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing required env: ${name}`);
  return v.trim();
}

function run(cmd: string, args: string[], cwd?: string): void {
  log.info("exec", { cmd, args: args.join(" ") });
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim();
    throw new Error(`${cmd} failed (${r.status}): ${err}`);
  }
}

async function main() {
  const fileId = requireEnv("RESTORE_FILE_ID");
  const dbUrl = requireEnv("DATABASE_URL");
  const drive = getDrive();

  const zipBuf = await downloadFileBuffer(drive, fileId);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rs-"));
  const zipPath = path.join(tmp, "restore.sql.zip");
  fs.writeFileSync(zipPath, zipBuf);

  try {
    run("unzip", ["-o", zipPath, "-d", tmp]);
    const entries = fs.readdirSync(tmp, { withFileTypes: true });
    const sql = entries.find(
      (e) => e.isFile() && e.name.endsWith(".sql") && e.name.startsWith("backup-"),
    );
    if (!sql) {
      throw new Error("No backup-*.sql file found inside zip");
    }
    const sqlPath = path.join(tmp, sql.name);
    run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath]);
    log.info("restore_success", { fileId, sql: sql.name });
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  log.error("restore_failure", {
    error: e instanceof Error ? e.message : String(e),
  });
  process.exitCode = 1;
});
