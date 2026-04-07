import {
  getDrive,
  listBackupZips,
  readBackupMetadata,
  type BackupMetadata,
} from "@/lib/gdrive";
import { BackupActions } from "./backup-actions";
import { ManualBackup } from "./manual-backup";

export default async function DashboardPage() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">Google Drive is not configured</p>
        <p className="mt-1 text-sm opacity-90">
          Set <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">GOOGLE_DRIVE_FOLDER_ID</code>{" "}
          and <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">GOOGLE_SERVICE_ACCOUNT_JSON</code>{" "}
          in the environment.
        </p>
      </div>
    );
  }

  let meta: BackupMetadata | null = null;
  let backups: Awaited<ReturnType<typeof listBackupZips>> = [];
  let loadError: string | null = null;

  try {
    const drive = getDrive();
    const pair = await Promise.all([
      readBackupMetadata(drive, folderId),
      listBackupZips(drive, folderId),
    ]);
    meta = pair[0];
    backups = pair[1];
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Backup dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Supabase dumps stored in Google Drive. Schedules run from GitHub Actions
          (hourly tick; spacing follows{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">BACKUP_INTERVAL</code>
          ).
        </p>
      </div>

      <ManualBackup
        lastSuccessfulBackupAt={meta?.lastSuccessfulBackupAt ?? null}
      />

      {loadError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          <p className="font-medium">Failed to load backups</p>
          <p className="mt-1 font-mono text-sm">{loadError}</p>
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Last run
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Last attempt</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {meta?.lastAttemptAt
                ? new Date(meta.lastAttemptAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Last success</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {meta?.lastSuccessfulBackupAt
                ? new Date(meta.lastSuccessfulBackupAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd>
              <StatusBadge status={meta?.lastBackupStatus ?? null} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Error (if any)</dt>
            <dd className="font-mono text-xs text-red-700 dark:text-red-300">
              {meta?.lastBackupError ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Available backups
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  File
                </th>
                <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Created (Drive)
                </th>
                <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Size
                </th>
                <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No backup files found in this folder yet.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {b.name}
                    </td>
                    <td className="px-6 py-3 text-zinc-600 dark:text-zinc-300">
                      {b.createdTime
                        ? new Date(b.createdTime).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-zinc-600 dark:text-zinc-300">
                      {b.size != null ? formatBytes(Number(b.size)) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <BackupActions fileId={b.id} fileName={b.name} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({
  status,
}: {
  status: "success" | "failure" | "skipped" | null;
}) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        unknown
      </span>
    );
  }
  const styles = {
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    failure: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    skipped:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  } as const;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
