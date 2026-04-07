import { parseBackupFilenameDate } from "./backup-interval";

/**
 * Returns Drive file ids for backup zips older than retention window.
 * Uses timestamp embedded in the filename `backup-YYYY-MM-DD_HH-MM.sql.zip`.
 */
export function idsOlderThanRetention(
  files: { id: string; name: string }[],
  retentionDays: number,
  now: Date,
): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const ids: string[] = [];
  for (const f of files) {
    const d = parseBackupFilenameDate(f.name);
    if (!d) continue;
    if (d.getTime() < cutoff) ids.push(f.id);
  }
  return ids;
}
