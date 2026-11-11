import { describe, expect, it } from "vitest";
import { TRASH_RETENTION_DAYS, isTrashExpired, trashDaysRemaining } from "@/db/database";

const DAY = 24 * 60 * 60 * 1000;

describe("trash retention", () => {
  it("keeps documents deleted less than the retention window", () => {
    const now = Date.now();
    expect(isTrashExpired(now - DAY, now)).toBe(false);
    expect(isTrashExpired(now - (TRASH_RETENTION_DAYS - 1) * DAY, now)).toBe(false);
  });

  it("expires documents past the retention window", () => {
    const now = Date.now();
    expect(isTrashExpired(now - (TRASH_RETENTION_DAYS + 1) * DAY, now)).toBe(true);
  });

  it("never treats an active document as expired", () => {
    expect(isTrashExpired(undefined)).toBe(false);
    expect(isTrashExpired(0)).toBe(false);
  });

  it("reports the remaining days rounded up", () => {
    const now = Date.now();
    expect(trashDaysRemaining(now, now)).toBe(TRASH_RETENTION_DAYS);
    expect(trashDaysRemaining(now - DAY / 2, now)).toBe(TRASH_RETENTION_DAYS);
    expect(trashDaysRemaining(now - (TRASH_RETENTION_DAYS - 1) * DAY - DAY / 2, now)).toBe(1);
  });

  it("never reports negative days", () => {
    const now = Date.now();
    expect(trashDaysRemaining(now - 90 * DAY, now)).toBe(0);
  });
});
