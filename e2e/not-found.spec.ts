import { expect, test } from "@playwright/test";

test.describe("not-found recovery", () => {
  test("renders the Paperforge 404 with working recovery actions", async ({ page }) => {
    await page.goto("/une-adresse-inconnue");
    await expect(page).toHaveTitle(/Page introuvable/);
    await expect(page.getByRole("heading", { name: "Rien ici pour l'instant." })).toBeVisible();
    await expect(page.getByText("Erreur 404")).toBeVisible();

    await page.getByRole("link", { name: /Retour au tableau de bord/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("searches saved documents from the 404 page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New PDF" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Document name").fill("Recovery Target");
    await dialog.getByRole("button", { name: /Create document/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_/);

    await page.goto("/missing-page");
    await page.getByLabel("Search your documents").fill("Recovery");
    await page.getByRole("button", { name: /Recovery Target/ }).click();
    await expect(page).toHaveURL(/\/editor\/doc_/);
  });

  test("command palette opens with Ctrl+K and navigates to a PDF tool", async ({ page }) => {
    await page.goto("/does-not-exist");
    await page.keyboard.press("Control+k");

    const input = page.getByLabel("Search documents, tools and actions");
    await expect(input).toBeVisible();
    await input.fill("watermark");
    await page.getByRole("button", { name: /Watermark/ }).first().click();

    await expect(page).toHaveURL(/\/tools\?tool=watermark/);
    await expect(page.getByText("Add a watermark", { exact: true }).first()).toBeVisible();
  });
});
