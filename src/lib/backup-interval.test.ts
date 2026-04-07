import { describe, it, expect } from "vitest";
import {
  parseIntervalToHours,
  shouldRunBackup,
  parseBackupFilenameDate,
} from "./backup-interval";

describe("parseIntervalToHours", () => {
  it("maps supported labels", () => {
    expect(parseIntervalToHours("1h")).toBe(1);
    expect(parseIntervalToHours("2h")).toBe(2);
    expect(parseIntervalToHours("4h")).toBe(4);
    expect(parseIntervalToHours("6h")).toBe(6);
    expect(parseIntervalToHours("24h")).toBe(24);
    expect(parseIntervalToHours("daily")).toBe(24);
    expect(parseIntervalToHours("weekly")).toBe(168);
    expect(parseIntervalToHours("168h")).toBe(168);
    expect(parseIntervalToHours("7d")).toBe(168);
  });

  it("rejects unknown values", () => {
    expect(() => parseIntervalToHours("3h")).toThrow();
  });
});

describe("shouldRunBackup", () => {
  it("runs when there is no prior success", () => {
    expect(shouldRunBackup(null, "24h", new Date("2026-04-07T12:00:00Z"))).toBe(
      true,
    );
  });

  it("waits until the interval has elapsed", () => {
    const last = new Date("2026-04-07T00:00:00Z");
    const now = new Date("2026-04-07T12:00:00Z");
    expect(shouldRunBackup(last, "24h", now)).toBe(false);
  });

  it("runs after the interval has elapsed", () => {
    const last = new Date("2026-04-06T00:00:00Z");
    const now = new Date("2026-04-07T12:00:00Z");
    expect(shouldRunBackup(last, "24h", now)).toBe(true);
  });
});

describe("parseBackupFilenameDate", () => {
  it("parses UTC timestamp from filename", () => {
    const d = parseBackupFilenameDate("backup-2026-04-07_14-30.sql.zip");
    expect(d?.toISOString()).toBe("2026-04-07T14:30:00.000Z");
  });

  it("returns null for invalid names", () => {
    expect(parseBackupFilenameDate("other.zip")).toBeNull();
  });
});
