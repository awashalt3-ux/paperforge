import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  countPdfImages,
  extractPdfText,
  readDownloadedPdf,
  writePdfFixture,
  writePngFixture,
} from "./helpers";

test.describe("document lifecycle", () => {
  test("creates a blank PDF, edits text, and exports a real PDF", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Make paper/ })).toBeVisible();

    await page.getByRole("button", { name: "New PDF" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Create a blank PDF" })).toBeVisible();
    await createDialog.getByLabel("Document name").fill("E2E Report");
    await createDialog.getByRole("button", { name: /Create document/ }).click();

    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("E2E Report");

    await page.getByRole("button", { name: "Add heading" }).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Enter");

    const inlineEditor = page.getByRole("textbox", { name: "Edit text" });
    await expect(inlineEditor).toBeVisible();
    await inlineEditor.fill("Automated quarterly report");
    await inlineEditor.press("Control+Enter");
    await expect(inlineEditor).toBeHidden();

    await page.keyboard.press("Control+Shift+E");
    const exportDialog = page.getByRole("dialog", { name: "Export PDF" });
    await expect(exportDialog).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("E2E Report.pdf");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const pdf = await readDownloadedPdf(downloadPath!);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("E2E Report");
    expect(pdf.getCreator()).toBe("Paperforge");

    const text = await extractPdfText(new Uint8Array(await readFile(downloadPath!)));
    expect(text.join(" ").replace(/\s+/g, "")).toContain("Automatedquarterlyreport");
    await expect(exportDialog.getByText(/Your PDF was downloaded/)).toBeVisible();
  });

  test("inserts an uploaded image and embeds it in the exported PDF", async ({
    page,
  }, testInfo) => {
    const imagePath = await writePngFixture(testInfo.outputPath("inserted-image.png"), {
      width: 120,
      height: 80,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "New PDF" }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Document name").fill("Image Report");
    await createDialog.getByRole("button", { name: /Create document/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add image" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);
    await expect(page.getByText("Image added", { exact: true })).toBeVisible();
    await expect(page.getByText("1 selected", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+Shift+E");
    const exportDialog = page.getByRole("dialog", { name: "Export PDF" });
    await expect(exportDialog).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const pdf = await readDownloadedPdf(downloadPath!);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Image Report");
    expect(countPdfImages(pdf)).toBeGreaterThanOrEqual(1);
  });

  test("imports an existing PDF, renders its pages, and preserves them on export", async ({
    page,
  }, testInfo) => {
    const sourcePath = await writePdfFixture(testInfo.outputPath("source.pdf"), {
      pageCount: 2,
      width: 400,
      height: 600,
      text: "Imported source",
    });

    await page.goto("/");
    await page.getByRole("complementary").getByRole("button", { name: "Import PDF" }).click();
    const importDialog = page.getByRole("dialog", { name: /Import an existing PDF/i });
    await expect(importDialog).toBeVisible();
    await importDialog.locator('input[type="file"]').setInputFiles(sourcePath);
    await expect(importDialog.getByText("PDF verified and ready to import")).toBeVisible();
    await expect(importDialog.getByText("2 pages")).toBeVisible();
    await importDialog.getByRole("button", { name: "Import PDF" }).click();

    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("button", { name: "Export", exact: true }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export PDF" });
    await expect(exportDialog.getByText("Original size")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const pdf = await readDownloadedPdf(downloadPath!);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(400, 0);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(600, 0);

    const text = await extractPdfText(new Uint8Array(await readFile(downloadPath!)));
    expect(text.join(" ").replace(/\s+/g, "")).toContain("Importedsource1");
  });

  test("exports and re-imports a portable project with its PDF assets", async ({
    page,
  }, testInfo) => {
    const sourcePath = await writePdfFixture(testInfo.outputPath("project-source.pdf"), {
      pageCount: 2,
      width: 360,
      height: 540,
      text: "Project asset",
    });

    await page.goto("/");
    await page.getByRole("complementary").getByRole("button", { name: "Import PDF" }).click();
    const importDialog = page.getByRole("dialog", { name: /Import an existing PDF/i });
    await importDialog.locator('input[type="file"]').setInputFiles(sourcePath);
    await expect(importDialog.getByText("PDF verified and ready to import")).toBeVisible();
    await importDialog.getByRole("button", { name: "Import PDF" }).click();
    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const originalDocumentId = page.url().split("/").pop();

    await page.getByRole("button", { name: "More document actions" }).click();
    const projectDownloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export project file" }).click();
    const projectDownload = await projectDownloadPromise;
    expect(projectDownload.suggestedFilename()).toBe("project-source.paperforge.json");
    const projectPath = await projectDownload.path();
    expect(projectPath).toBeTruthy();

    const project = JSON.parse(await readFile(projectPath!, "utf8")) as {
      format: string;
      version: number;
      document: { id: string };
      assets: { id: string; pageCount: number }[];
    };
    expect(project.format).toBe("paperforge-project");
    expect(project.version).toBe(1);
    expect(project.document.id).toBe(originalDocumentId);
    expect(project.assets).toHaveLength(1);
    expect(project.assets[0].pageCount).toBe(2);

    await page.goto("/");
    await page.locator('input[type="file"][accept*=".json"]').setInputFiles(projectPath!);
    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue(
      /^project-source( \(imported\))?$/,
    );
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();

    const importedDocumentId = page.url().split("/").pop();
    expect(importedDocumentId).not.toBe(originalDocumentId);
  });

  test("creates a document from a template", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Begin with intention." })).toBeVisible();

    await page.getByRole("button", { name: "Use template" }).first().click();
    await expect(page).toHaveURL(/\/editor\/doc_[a-z0-9-]+/i);
    await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Invoice");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
  });
});
