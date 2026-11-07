import { expect, test } from "@playwright/test";
import { readDownloadedPdf, writePdfFixture } from "./helpers";

test.describe("PDF tools", () => {
  test("merges two PDFs and downloads the combined document", async ({ page }, testInfo) => {
    const first = await writePdfFixture(testInfo.outputPath("merge-a.pdf"), {
      pageCount: 2,
      text: "Merge A",
    });
    const second = await writePdfFixture(testInfo.outputPath("merge-b.pdf"), {
      pageCount: 3,
      text: "Merge B",
    });

    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: "Nine precise tools." })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles([first, second]);
    await expect(page.getByText("merge-a.pdf")).toBeVisible();
    await expect(page.getByText("merge-b.pdf")).toBeVisible();
    await expect(page.getByText("2 files ready", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Run merge" }).click();
    await expect(page.getByText("Your PDF is ready")).toBeVisible();
    await expect(page.getByText("5 pages in total")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("merged.pdf");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const pdf = await readDownloadedPdf(downloadPath!);
    expect(pdf.getPageCount()).toBe(5);
  });

  test("splits a PDF into single pages", async ({ page }, testInfo) => {
    const source = await writePdfFixture(testInfo.outputPath("split-source.pdf"), {
      pageCount: 4,
      text: "Split source",
    });

    await page.goto("/tools");
    await page.locator("aside").getByRole("button", { name: /^Split/ }).click();
    await expect(page.getByRole("heading", { name: "Split PDF" })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(source);
    await expect(page.getByText("split-source.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Run split" }).click();

    await expect(page.getByText("4 PDFs are ready")).toBeVisible();
    await expect(page.getByText("4 pages in total")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("split-source-page-1.pdf");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const pdf = await readDownloadedPdf(downloadPath!);
    expect(pdf.getPageCount()).toBe(1);
  });

  test("rejects an invalid page range without producing a file", async ({ page }, testInfo) => {
    const source = await writePdfFixture(testInfo.outputPath("range-source.pdf"), {
      pageCount: 3,
      text: "Range source",
    });

    await page.goto("/tools");
    await page.locator("aside").getByRole("button", { name: /^Extract/ }).click();
    await page.locator('input[type="file"]').setInputFiles(source);
    await expect(page.getByText("range-source.pdf")).toBeVisible();

    await page.getByLabel("Pages to keep").fill("9-12");
    await page.getByRole("button", { name: "Run extract" }).click();

    await expect(page.getByText("Page numbers must be between 1 and 3.")).toBeVisible();
    await expect(page.getByText("Your PDF is ready")).toBeHidden();
  });
});
