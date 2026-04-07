import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { getDrive, listBackupZips, readBackupMetadata } from "@/lib/gdrive";
import { log } from "@/lib/logger";

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) {
    log.error("backups_list_misconfigured", { reason: "folder id" });
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_FOLDER_ID is not configured" },
      { status: 500 },
    );
  }

  try {
    const drive = getDrive();
    const [meta, backups] = await Promise.all([
      readBackupMetadata(drive, folderId),
      listBackupZips(drive, folderId),
    ]);
    return NextResponse.json({ meta, backups });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("backups_list_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
