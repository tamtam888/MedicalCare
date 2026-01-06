import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseFlexibleDate,
  formatDateDMY,
  formatDateTimeDMY,
  toISODateInput,
  fromISODateInput,
  autoFormatDMY,
} from "./dateFormat";

describe("dateFormat.js", () => {
  describe("parseFlexibleDate", () => {
    it("returns null for empty-ish values (except 0)", () => {
      expect(parseFlexibleDate(null)).toBeNull();
      expect(parseFlexibleDate(undefined)).toBeNull();
      expect(parseFlexibleDate("")).toBeNull();
      expect(parseFlexibleDate("   ")).toBeNull();
    });

    it("parses number timestamp", () => {
      const ts = Date.UTC(2026, 0, 6, 0, 0, 0);
      const d = parseFlexibleDate(ts);
      expect(d).toBeInstanceOf(Date);
      expect(Number.isFinite(d.getTime())).toBe(true);
      expect(d.getUTCFullYear()).toBe(2026);
    });

    it("accepts Date instance", () => {
      const src = new Date(2026, 0, 6, 12, 0, 0, 0);
      const d = parseFlexibleDate(src);
      expect(d).toBe(src);
    });

    it("parses DMY with slashes", () => {
      const d = parseFlexibleDate("31/12/2025");
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(11);
      expect(d.getDate()).toBe(31);
    });

    it("parses DMY with dashes", () => {
      const d = parseFlexibleDate("01-01-2026");
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(1);
    });

    it("parses 2-digit year as 2000+", () => {
      const d = parseFlexibleDate("05/04/26");
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(3);
      expect(d.getDate()).toBe(5);
    });

    it("returns null for invalid date string", () => {
      expect(parseFlexibleDate("not-a-date")).toBeNull();
    });
  });

  describe("formatDateDMY", () => {
    it("returns empty string for invalid input", () => {
      expect(formatDateDMY(null)).toBe("");
      expect(formatDateDMY("")).toBe("");
      expect(formatDateDMY("not-a-date")).toBe("");
    });

    it("formats DMY correctly with padding", () => {
      expect(formatDateDMY("1/2/2026")).toBe("01/02/2026");
      expect(formatDateDMY("09/11/2026")).toBe("09/11/2026");
    });
  });

  describe("formatDateTimeDMY", () => {
    it("returns empty string for invalid input", () => {
      expect(formatDateTimeDMY(null)).toBe("");
      expect(formatDateTimeDMY("not-a-date")).toBe("");
    });

    it("formats date+time correctly", () => {
      const d = new Date(2026, 0, 6, 3, 4, 0, 0);
      expect(formatDateTimeDMY(d)).toBe("06/01/2026 03:04");
    });
  });

  describe("toISODateInput", () => {
    it("formats to YYYY-MM-DD for a given date", () => {
      const d = new Date(2026, 0, 6, 10, 0, 0, 0);
      expect(toISODateInput(d)).toBe("2026-01-06");
    });

    it("falls back to current date if input is invalid", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2030, 4, 9, 8, 0, 0, 0));
      expect(toISODateInput("not-a-date")).toBe("2030-05-09");
      vi.useRealTimers();
    });
  });

  describe("fromISODateInput", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2031, 6, 2, 9, 0, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns now.toISOString() for empty input", () => {
      const iso = fromISODateInput("");
      expect(iso).toBe(new Date().toISOString());
    });

    it("returns ISO string for a valid YYYY-MM-DD (local midday to avoid tz shifts)", () => {
      const iso = fromISODateInput("2026-01-06");
      const d = new Date(iso);
      expect(Number.isFinite(d.getTime())).toBe(true);
      expect(d.toISOString()).toBe(iso);
    });
  });

  describe("autoFormatDMY", () => {
    it("keeps only digits and formats progressively", () => {
      expect(autoFormatDMY("1")).toBe("1");
      expect(autoFormatDMY("12")).toBe("12");
      expect(autoFormatDMY("123")).toBe("12/3");
      expect(autoFormatDMY("1234")).toBe("12/34");
      expect(autoFormatDMY("12345")).toBe("12/34/5");
      expect(autoFormatDMY("12345678")).toBe("12/34/5678");
    });

    it("ignores non-digits and limits to 8 digits", () => {
      expect(autoFormatDMY("ab12-34/5678cd90")).toBe("12/34/5678");
    });
  });
});
