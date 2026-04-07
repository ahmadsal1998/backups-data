import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { log } from "@/lib/logger";

export async function POST() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  session.destroy();
  log.info("logout", {});
  return NextResponse.json({ ok: true });
}
