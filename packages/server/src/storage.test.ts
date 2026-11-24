import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./db.js";
import { appDataDir } from "./paths.js";
import { getResume, removeResume, resumePath, saveResume } from "./resume.js";
import { defaultSettings, loadSettings, updateSettings } from "./settings.js";

let dir: string;
let db: Db;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shorebound-"));
  db = openDb(join(dir, "app.db"));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("settings", () => {
  it("returns defaults on first run: 7-day window, bonus relocation, negatives excluded", () => {
    const s = loadSettings(db, ["DE", "AE"]);
    expect(s.countries).toEqual(["DE", "AE"]);
    expect(s.search.lookbackDays).toBe(7);
    expect(s.sponsorship).toEqual({
      excludeNegative: true,
      relocation: "bonus",
      includePossible: true,
      includeRegister: true,
    });
  });

  it("persists updates across reopening the database", () => {
    updateSettings(db, ["DE"], { countries: ["GB"], appearance: { theme: "dark" } });
    db.close();
    db = openDb(join(dir, "app.db"));
    const s = loadSettings(db, ["DE"]);
    expect(s.countries).toEqual(["GB"]);
    expect(s.appearance.theme).toBe("dark");
  });

  it("rejects invalid values", () => {
    expect(() => updateSettings(db, [], { search: { ...defaultSettings([]).search, lookbackDays: 0 } })).toThrow();
  });
});

describe("resume", () => {
  it("is copied into app data and remembered", () => {
    const info = saveResume(db, dir, "My CV.pdf", new Uint8Array([1, 2, 3]));
    expect(getResume(db)?.originalName).toBe("My CV.pdf");
    expect(readFileSync(resumePath(dir, info))).toEqual(Buffer.from([1, 2, 3]));
  });

  it("replacing with another type removes the old file", () => {
    const a = saveResume(db, dir, "cv.pdf", new Uint8Array([1]));
    saveResume(db, dir, "cv.txt", new Uint8Array([2]));
    expect(existsSync(resumePath(dir, a))).toBe(false);
  });

  it("removeResume deletes file and record", () => {
    const a = saveResume(db, dir, "cv.docx", new Uint8Array([1]));
    removeResume(db, dir);
    expect(getResume(db)).toBeUndefined();
    expect(existsSync(resumePath(dir, a))).toBe(false);
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(() => saveResume(db, dir, "cv.exe", new Uint8Array([1]))).toThrow(/Unsupported/);
    expect(() => saveResume(db, dir, "cv.pdf", new Uint8Array())).toThrow(/empty/);
    expect(() => saveResume(db, dir, "cv.pdf", new Uint8Array(10 * 1024 * 1024 + 1))).toThrow(/10 MB/);
  });
});

describe("appDataDir", () => {
  it("honours SHOREBOUND_HOME and uses OS conventions", () => {
    expect(appDataDir({ SHOREBOUND_HOME: "/x" })).toBe("/x");
    expect(appDataDir({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32")).toMatch(/Shorebound$/);
    expect(appDataDir({ XDG_CONFIG_HOME: "/c" }, "linux")).toBe(join("/c", "shorebound"));
  });
});
