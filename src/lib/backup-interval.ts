/** Supported backup intervals (env: BACKUP_INTERVAL). */
export const BACKUP_INTERVAL_VALUES = [
  "1h",
  "2h",
  "4h",
  "6h",
  "24h",
  "daily",
  "168h",
  "7d",
  "weekly",
] as const;

export type BackupIntervalString = (typeof BACKUP_INTERVAL_VALUES)[number];

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Maps human-readable interval strings to hours.
 * daily = 24h, weekly = 168h (7 days between runs).
 */
export function parseIntervalToHours(raw: string): number {
  const s = raw.trim().toLowerCase();
  switch (s) {
    case "1h":
      return 1;
    case "2h":
      return 2;
    case "4h":
      return 4;
    case "6h":
      return 6;
    case "24h":
    case "daily":
      return 24;
    case "168h":
    case "7d":
    case "weekly":
      return 168;
    default:
      throw new Error(
        `Invalid BACKUP_INTERVAL "${raw}". Use one of: ${BACKUP_INTERVAL_VALUES.join(", ")}`,
      );
  }
}

export function getIntervalMs(raw: string): number {
  return parseIntervalToHours(raw) * MS_PER_HOUR;
}

/**
 * Returns true if a new backup should run based on last successful backup time.
 */
export function shouldRunBackup(
  lastSuccessfulBackupAt: Date | null,
  intervalRaw: string,
  now: Date,
): boolean {
  if (!lastSuccessfulBackupAt) return true;
  const ms = getIntervalMs(intervalRaw);
  return now.getTime() - lastSuccessfulBackupAt.getTime() >= ms;
}

const FILENAME_RE =
  /^backup-(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})\.sql\.zip$/;

/** Parses timestamp from backup filename for retention. */
export function parseBackupFilenameDate(name: string): Date | null {
  const m = name.match(FILENAME_RE);
  if (!m) return null;
  const [, d, t] = m;
  const iso = `${d}T${t.replace("-", ":")}:00.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
