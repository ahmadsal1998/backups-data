import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { log } from "@/lib/logger";

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected) {
    log.error("login_misconfigured", { reason: "DASHBOARD_PASSWORD not set" });
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (!body.password || body.password !== expected) {
    log.warn("login_failed", {});
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  session.isLoggedIn = true;
  await session.save();
  log.info("login_ok", {});
  return NextResponse.json({ ok: true });
}
