import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { dispatchRestoreWorkflow } from "@/lib/github-dispatch";
import { log } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fileId?: string; password?: string };
  try {
    body = (await request.json()) as { fileId?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected || body.password !== expected) {
    log.warn("restore_password_rejected", { fileId: body.fileId });
    return NextResponse.json(
      { error: "Restore requires a valid confirmation password" },
      { status: 403 },
    );
  }

  if (!body.fileId?.trim()) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  try {
    await dispatchRestoreWorkflow(body.fileId.trim());
    log.info("restore_dispatched", { fileId: body.fileId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("restore_dispatch_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
