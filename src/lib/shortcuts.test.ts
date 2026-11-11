import { describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS, modifierLabel } from "@/lib/shortcuts";
import { TIPS, tipsFor } from "@/lib/tips";

describe("shortcut registry", () => {
  it("exposes every documented action with at least one key", () => {
    const items = SHORTCUT_GROUPS.flatMap((group) => group.items);
    expect(items.length).toBeGreaterThan(30);
    for (const item of items) {
      expect(item.keys.length).toBeGreaterThan(0);
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate groups or duplicate labels within a group", () => {
    const groups = SHORTCUT_GROUPS.map((group) => group.group);
    expect(new Set(groups).size).toBe(groups.length);
    for (const group of SHORTCUT_GROUPS) {
      const labels = group.items.map((item) => item.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("documents the save, export, print, and palette shortcuts", () => {
    const labels = SHORTCUT_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Save now");
    expect(labels).toContain("Export PDF");
    expect(labels).toContain("Print");
    expect(labels).toContain("Search documents, tools and actions");
  });

  it("returns a platform-aware modifier label", () => {
    expect(["Ctrl", "⌘"]).toContain(modifierLabel());
  });
});

describe("tips registry", () => {
  it("covers every surface of the app", () => {
    const contexts = new Set(TIPS.map((tip) => tip.context));
    expect(contexts).toEqual(new Set(["editor", "dashboard", "tools", "templates"]));
  });

  it("keeps tip ids unique and copy concise", () => {
    const ids = TIPS.map((tip) => tip.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tip of TIPS) {
      expect(tip.title.length).toBeLessThanOrEqual(48);
      expect(tip.body.length).toBeLessThanOrEqual(180);
    }
  });

  it("filters by context", () => {
    const editor = tipsFor("editor");
    expect(editor.length).toBeGreaterThan(2);
    expect(editor.every((tip) => tip.context === "editor")).toBe(true);
  });
});
