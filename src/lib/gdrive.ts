import { Readable } from "node:stream";
import { JWT } from "google-auth-library";
import { google, drive_v3 } from "googleapis";
import { log } from "./logger";

export const METADATA_FILENAME = "backup-metadata.json";

export type BackupMetadata = {
  lastSuccessfulBackupAt: string | null;
  lastAttemptAt: string;
  lastBackupStatus: "success" | "failure" | "skipped";
  lastBackupError: string | null;
  lastBackupFileName: string | null;
  lastBackupFileId: string | null;
};

export function parseServiceAccountJson(): {
  client_email: string;
  private_key: string;
} {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("invalid JSON shape");
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be JSON or base64 JSON");
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }
}

export function getDrive(): drive_v3.Drive {
  const creds = parseServiceAccountJson();
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export async function findFileInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  name: string,
): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function readBackupMetadata(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<BackupMetadata | null> {
  const id = await findFileInFolder(drive, folderId, METADATA_FILENAME);
  if (!id) return null;
  const buf = await downloadFileBuffer(drive, id);
  try {
    return JSON.parse(buf.toString("utf8")) as BackupMetadata;
  } catch (e) {
    log.warn("backup_metadata_parse_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function writeBackupMetadata(
  drive: drive_v3.Drive,
  folderId: string,
  data: BackupMetadata,
): Promise<void> {
  const body = Buffer.from(JSON.stringify(data, null, 2), "utf8");
  const id = await findFileInFolder(drive, folderId, METADATA_FILENAME);
  if (id) {
    await drive.files.update({
      fileId: id,
      media: { mimeType: "application/json", body: Readable.from(body) },
      supportsAllDrives: true,
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: METADATA_FILENAME,
        parents: [folderId],
      },
      media: { mimeType: "application/json", body: Readable.from(body) },
      fields: "id",
      supportsAllDrives: true,
    });
  }
}

export async function downloadFileBuffer(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function uploadBackupZip(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  buffer: Buffer,
): Promise<{ id: string }> {
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: "application/zip",
      body: Readable.from(buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error("Drive upload did not return file id");
  return { id };
}

export type DriveBackupListItem = {
  id: string;
  name: string;
  createdTime: string | null;
  size: string | null;
};

export async function listBackupZips(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<DriveBackupListItem[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,createdTime,size)",
    pageSize: 1000,
    orderBy: "createdTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files
    .filter(
      (f) =>
        f.name?.startsWith("backup-") &&
        f.name.endsWith(".sql.zip") &&
        f.id,
    )
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      createdTime: f.createdTime ?? null,
      size: f.size ?? null,
    }));
}

export async function deleteFile(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<void> {
  await drive.files.delete({ fileId, supportsAllDrives: true });
}
