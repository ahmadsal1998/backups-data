"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ToastState = { kind: "success" | "error"; message: string } | null;

export function ManualBackup({
  lastSuccessfulBackupAt,
}: {
  lastSuccessfulBackupAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function runBackup(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    setPending(true);
    try {
      const res = await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        mode?: string;
        detail?: string;
      };
      if (!res.ok) {
        const msg =
          data.error ||
          (res.status === 503
            ? "Backup is not configured on the server"
            : "Backup request failed");
        const extra = data.detail ? ` ${data.detail}` : "";
        setInlineError(msg + extra);
        showToast("error", msg);
        return;
      }
      setOpen(false);
      setPassword("");
      const summary =
        data.message ||
        (data.mode === "github"
          ? "Snapshot queued in GitHub Actions."
          : "Snapshot finished.");
      showToast("success", summary);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Manual snapshot
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Run a backup immediately (ignores{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              BACKUP_INTERVAL
            </code>
            ). Uses the same pipeline as scheduled jobs.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Last successful backup:{" "}
            {lastSuccessfulBackupAt
              ? new Date(lastSuccessfulBackupAt).toLocaleString()
              : "—"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(true);
            setInlineError(null);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-800 dark:hover:bg-emerald-700"
        >
          {pending ? "Working…" : "Create backup now"}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
            role="dialog"
            aria-labelledby="snapshot-title"
          >
            <h3
              id="snapshot-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Confirm snapshot
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Enter your dashboard password to start a backup. On hosted
              dashboards this usually queues GitHub Actions; on a server with{" "}
              <code className="text-xs">BACKUP_EXECUTION_MODE=direct</code> it
              runs the pipeline on this machine.
            </p>
            <form onSubmit={runBackup} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Dashboard password
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  required
                />
              </label>
              {inlineError ? (
                <p
                  className="text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {inlineError}
                </p>
              ) : null}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-800 dark:hover:bg-emerald-700"
                >
                  {pending ? "Starting…" : "Start backup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-60 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
