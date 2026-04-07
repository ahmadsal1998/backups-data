import { spawn } from "node:child_process";
import { log } from "./logger";

function hasDirectEnv(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() &&
      process.env.GOOGLE_DRIVE_FOLDER_ID?.trim(),
  );
}

function hasGithubDispatchEnv(): boolean {
  return Boolean(
    process.env.GITHUB_PAT?.trim() &&
      process.env.GITHUB_OWNER?.trim() &&
      process.env.GITHUB_REPO?.trim(),
  );
}

/**
 * How manual backup runs from the API:
 * - `github`: workflow_dispatch (needs GITHUB_*)
 * - `direct`: spawn `tsx scripts/backup-pipeline.ts` with FORCE_BACKUP=1 (needs pg_dump + zip on PATH)
 * - `auto`: prefer GitHub when configured, else direct when DB + Drive env is present
 */
export function resolveBackupExecutionMode():
  | "github"
  | "direct"
  | null {
  const raw = process.env.BACKUP_EXECUTION_MODE?.trim().toLowerCase();
  if (raw === "github") {
    return hasGithubDispatchEnv() ? "github" : null;
  }
  if (raw === "direct") {
    return hasDirectEnv() ? "direct" : null;
  }
  if (raw && raw !== "auto") {
    return null;
  }

  if (hasGithubDispatchEnv()) return "github";
  if (hasDirectEnv()) return "direct";
  return null;
}

export function runBackupPipelineDirect(): Promise<{
  code: number | null;
  output: string;
}> {
  return new Promise((resolve, reject) => {
    const cwd = process.cwd();
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "scripts/backup-pipeline.ts"],
      {
        cwd,
        env: { ...process.env, FORCE_BACKUP: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      log.error("backup_direct_spawn_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      reject(err);
    });
    child.on("close", (code) => {
      const output = (stderr + stdout).trim();
      log.info("backup_direct_finished", {
        code,
        tail: output.slice(-4000),
      });
      resolve({ code, output });
    });
  });
}
