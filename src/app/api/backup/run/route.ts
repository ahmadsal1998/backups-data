import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { dispatchBackupWorkflow } from "@/lib/github-dispatch";
import {
  resolveBackupExecutionMode,
  runBackupPipelineDirect,
} from "@/lib/backup-exec";
import { log } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected || body.password !== expected) {
    log.warn("backup_run_password_rejected");
    return NextResponse.json(
      { error: "A valid dashboard password is required" },
      { status: 403 },
    );
  }

  const mode = resolveBackupExecutionMode();
  if (!mode) {
    log.warn("backup_run_not_configured");
    return NextResponse.json(
      {
        error:
          "Backup is not configured for this server. Set GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO to queue GitHub Actions, or set DATABASE_URL and Google Drive variables for direct runs (requires pg_dump and zip on the host; use BACKUP_EXECUTION_MODE=direct).",
      },
      { status: 503 },
    );
  }

  try {
    if (mode === "github") {
      await dispatchBackupWorkflow({ force: true });
      log.info("backup_run_github_queued");
      return NextResponse.json({
        ok: true,
        mode: "github" as const,
        message: "Backup workflow queued in GitHub Actions",
      });
    }

    const { code, output } = await runBackupPipelineDirect();
    if (code !== 0) {
      log.error("backup_run_direct_failed", {
        code,
        output: output.slice(-2000),
      });
      return NextResponse.json(
        {
          error: "Backup failed",
          detail: output.slice(-4000) || `exit code ${code}`,
        },
        { status: 500 },
      );
    }
    log.info("backup_run_direct_ok");
    return NextResponse.json({
      ok: true,
      mode: "direct" as const,
      message: "Backup completed",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("backup_run_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
