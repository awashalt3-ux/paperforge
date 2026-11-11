import { expect, test } from "@playwright/test";

test.describe("editor interactions", () => {
  test("dragging an element updates its position and is undoable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New PDF" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Document name").fill("Drag check");
    await dialog.getByRole("button", { name: /Create document/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_/);

    await page.getByRole("button", { name: "Add heading" }).click();
    await page.getByRole("button", { name: "Select and move (V)" }).click();

    const xField = page.locator('input[aria-label="X"]').first();
    const yField = page.locator('input[aria-label="Y"]').first();
    await expect(xField).toBeVisible();
    const beforeX = Number(await xField.inputValue());
    const beforeY = Number(await yField.inputValue());

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Click inside the heading frame, then drag it down and to the right.
    const startX = box!.x + beforeX + 40;
    const startY = box!.y + beforeY + 20;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 80, { steps: 15 });
    await page.mouse.up();

    await expect.poll(async () => Number(await xField.inputValue())).toBeGreaterThan(beforeX);
    await expect.poll(async () => Number(await yField.inputValue())).toBeGreaterThan(beforeY);

    // A drag is one undo step.
    await page.keyboard.press("Control+z");
    await expect.poll(async () => Number(await xField.inputValue())).toBeCloseTo(beforeX, 1);
  });
});

test.describe("trash and recovery", () => {
  test("moves a document to the trash, restores it, then empties the trash", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New PDF" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Document name").fill("Keep me safe");
    await dialog.getByRole("button", { name: /Create document/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_/);
    await page.getByRole("link", { name: "Back to dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Move to trash.
    const card = page.locator("[role='button']").filter({ hasText: "Keep me safe" }).first();
    await card.hover();
    await card.getByRole("button", { name: "Actions for Keep me safe" }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByText("Move this document to the trash?")).toBeVisible();
    await confirm.getByRole("button", { name: "Move to trash" }).click();
    await expect(page.getByText("Moved to trash")).toBeVisible();

    // The document is gone from the shelf but present in the trash.
    await expect(page.getByText("Keep me safe")).toHaveCount(0);
    await page.getByRole("tab", { name: /Trash/ }).click();
    await expect(page.getByText("Keep me safe").first()).toBeVisible();
    await expect(page.getByText(/kept for 30 days/)).toBeVisible();

    // Restore it.
    await page.getByRole("button", { name: "Restore" }).first().click();
    await expect(page.getByText("Document restored")).toBeVisible();
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page.getByText("Keep me safe").first()).toBeVisible();
  });
});

test.describe("help centre", () => {
  test("searches the guide and opens shortcuts", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Learn the studio." })).toBeVisible();

    const search = page.getByLabel("Search the help guide");
    await search.fill("watermark");
    await expect(page.getByRole("heading", { name: "Use the PDF tool bench" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a document" })).toHaveCount(0);

    await search.fill("");
    await page.getByRole("button", { name: "Shortcuts" }).first().click();
    const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(shortcuts).toBeVisible();
    await expect(shortcuts.getByText("Print", { exact: true })).toBeVisible();
    await expect(shortcuts.getByText("Export PDF", { exact: true })).toBeVisible();
  });

  test("is reachable from the sidebar navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("complementary").getByRole("link", { name: "Help" }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole("heading", { name: "Learn the studio." })).toBeVisible();
  });

  test("opens quick help from the sidebar footer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open quick help" }).click();
    const dialog = page.getByRole("dialog", { name: "Quick help" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Start a document")).toBeVisible();
  });
});

test.describe("welcome tour", () => {
  test("can be opened, stepped through, and is not blocking the workspace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("First time here?")).toBeVisible();
    await page.getByRole("button", { name: "Take the tour" }).click();

    const tour = page.getByRole("dialog").filter({ hasText: "Getting started" });
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("heading", { name: "Welcome to Paperforge" })).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByRole("heading", { name: "Start any way you like" })).toBeVisible();
    await tour.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(tour).toBeHidden();
  });
});

test.describe("image export", () => {
  test("exports a page as a PNG download", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New PDF" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Document name").fill("Image Export");
    await dialog.getByRole("button", { name: /Create document/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_/);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "More document actions" }).click();
    await page.getByRole("menuitem", { name: "Export images (PNG / JPEG)" }).click();

    const imageDialog = page.getByRole("dialog", { name: "Export images" });
    await expect(imageDialog).toBeVisible();
    await expect(imageDialog.getByText(/px per page/)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await imageDialog.getByRole("button", { name: "Download image" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Image Export-page-01.png");
  });
});
