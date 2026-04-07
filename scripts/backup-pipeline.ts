/**
 * Runs in GitHub Actions: pg_dump → zip → Google Drive upload, metadata, retention.
 * Env: DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID,
 *      BACKUP_INTERVAL (default 24h), RETENTION_DAYS (default 7)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getDrive,
  readBackupMetadata,
  writeBackupMetadata,
  uploadBackupZip,
  listBackupZips,
  deleteFile,
  type BackupMetadata,
} from "../src/lib/gdrive";
import { shouldRunBackup } from "../src/lib/backup-interval";
import { idsOlderThanRetention } from "../src/lib/retention";
import { log } from "../src/lib/logger";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing required env: ${name}`);
  return v.trim();
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;
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
  const folderId = requireEnv("GOOGLE_DRIVE_FOLDER_ID");
  const interval = process.env.BACKUP_INTERVAL?.trim() || "24h";
  const retentionDays = Math.max(
    1,
    parseInt(process.env.RETENTION_DAYS || "7", 10) || 7,
  );

  const drive = getDrive();
  const now = new Date();

  const forceBackup =
    process.env.FORCE_BACKUP === "1" ||
    process.env.FORCE_BACKUP?.toLowerCase() === "true";

  const existingMeta = await readBackupMetadata(drive, folderId);
  const lastOk = existingMeta?.lastSuccessfulBackupAt
    ? new Date(existingMeta.lastSuccessfulBackupAt)
    : null;

  if (forceBackup) {
    log.info("backup_forced", { interval });
  }

  if (!forceBackup && !shouldRunBackup(lastOk, interval, now)) {
    log.info("backup_skipped_interval", { interval, lastOk: lastOk?.toISOString() });
    const skipped: BackupMetadata = {
      lastSuccessfulBackupAt: existingMeta?.lastSuccessfulBackupAt ?? null,
      lastAttemptAt: now.toISOString(),
      lastBackupStatus: "skipped",
      lastBackupError: null,
      lastBackupFileName: existingMeta?.lastBackupFileName ?? null,
      lastBackupFileId: existingMeta?.lastBackupFileId ?? null,
    };
    await writeBackupMetadata(drive, folderId, skipped);
    return;
  }

  const stamp = nowStamp();
  const base = `backup-${stamp}`;
  const sqlName = `${base}.sql`;
  const zipName = `${base}.sql.zip`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bk-"));
  const sqlPath = path.join(tmp, sqlName);
  const zipPath = path.join(tmp, zipName);

  const dbUrl = requireEnv("DATABASE_URL");

  try {
    run("pg_dump", [dbUrl, "-f", sqlPath, "--no-owner", "--no-acl"]);
    run("zip", ["-j", zipPath, sqlPath]);

    const buf = fs.readFileSync(zipPath);
    const { id } = await uploadBackupZip(drive, folderId, zipName, buf);

    const meta: BackupMetadata = {
      lastSuccessfulBackupAt: now.toISOString(),
      lastAttemptAt: now.toISOString(),
      lastBackupStatus: "success",
      lastBackupError: null,
      lastBackupFileName: zipName,
      lastBackupFileId: id,
    };
    await writeBackupMetadata(drive, folderId, meta);
    log.info("backup_success", { file: zipName, fileId: id });

    const listed = await listBackupZips(drive, folderId);
    const toRemove = idsOlderThanRetention(
      listed.map((x) => ({ id: x.id, name: x.name })),
      retentionDays,
      now,
    );
    for (const fid of toRemove) {
      try {
        await deleteFile(drive, fid);
        log.info("retention_deleted", { fileId: fid });
      } catch (e) {
        log.error("retention_delete_failed", {
          fileId: fid,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("backup_failure", { error: message });
    const meta: BackupMetadata = {
      lastSuccessfulBackupAt: existingMeta?.lastSuccessfulBackupAt ?? null,
      lastAttemptAt: now.toISOString(),
      lastBackupStatus: "failure",
      lastBackupError: message,
      lastBackupFileName: existingMeta?.lastBackupFileName ?? null,
      lastBackupFileId: existingMeta?.lastBackupFileId ?? null,
    };
    await writeBackupMetadata(drive, folderId, meta);
    process.exitCode = 1;
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  log.error("backup_pipeline_fatal", {
    error: e instanceof Error ? e.message : String(e),
  });
  process.exitCode = 1;
});
