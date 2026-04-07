import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { Readable } from "node:stream";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { getDrive } from "@/lib/gdrive";
import { log } from "@/lib/logger";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await context.params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  try {
    const drive = getDrive();
    const meta = await drive.files.get({
      fileId,
      fields: "name,mimeType",
      supportsAllDrives: true,
    });
    const name = meta.data.name || `backup-${fileId}.sql.zip`;

    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );

    const raw = res.data as unknown;
    log.info("backup_download", { fileId, name });

    const webBody =
      raw instanceof Readable
        ? Readable.toWeb(raw)
        : (raw as BodyInit);

    return new NextResponse(webBody as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("backup_download_failed", { error: message, fileId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
