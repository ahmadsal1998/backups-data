/**
 * Optional VPS/cron alternative to GitHub Actions: runs every hour and executes
 * backup-pipeline.ts (which respects BACKUP_INTERVAL using Drive metadata).
 *
 * Usage: BACKUP_INTERVAL=24h DATABASE_URL=... npx tsx scripts/local-scheduler.ts
 */
import cron from "node-cron";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { log } from "../src/lib/logger";

const root = path.resolve(__dirname, "..");

cron.schedule("0 * * * *", () => {
  log.info("local_scheduler_tick", {});
  const r = spawnSync("npx", ["tsx", "scripts/backup-pipeline.ts"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    log.error("local_scheduler_backup_failed", { code: r.status });
  }
});

log.info("local_scheduler_started", {
  pattern: "0 * * * * (hourly UTC)",
  note: "Spacing still enforced by BACKUP_INTERVAL in backup-pipeline.ts",
});
