import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const composition = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.composition.v1")!),
  );
const point = (page: Page, x: number, y: number) =>
  page.locator("#compositionCanvas").evaluate(
    (svg, p) => {
      const result = new DOMPoint(p.x, p.y).matrixTransform(
        (svg as SVGSVGElement).getScreenCTM()!,
      );
      return { x: result.x, y: result.y };
    },
    { x, y },
  );
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./#compose");
  await expect(page.locator("#compositionCanvas")).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

test("adds radicals and strokes, moves/resizes/crops parts and opens the result in the editor", async ({
  page,
}) => {
  const addWood = page.getByRole("button", {
    name: "Add 木 radical",
    exact: true,
  });
  await expect(addWood).toBeEnabled();
  await addWood.click();
  await expect(page.locator("[data-component]")).toHaveCount(1);
  await page.getByLabel("Width %", { exact: true }).fill("30");
  await expect
    .poll(async () => (await composition(page)).parts[0].width)
    .toBeCloseTo(300);
  let part = (await composition(page)).parts[0];
  const start = await point(
    page,
    part.x + part.width / 2,
    part.y + part.height / 2,
  );
  const end = await point(
    page,
    part.x + part.width / 2 + 100,
    part.y + part.height / 2 + 50,
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await composition(page)).parts[0].x)
    .toBeCloseTo(part.x + 100, 0);
  part = (await composition(page)).parts[0];
  await page
    .getByRole("button", { name: "Crop component", exact: true })
    .click();
  const handle = (await page.locator('[data-handle="w"]').boundingBox())!;
  const cropEnd = await point(
    page,
    part.x + part.width / 4,
    part.y + part.height / 2,
  );
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(cropEnd.x, cropEnd.y, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await composition(page)).parts[0].crop.x)
    .toBeCloseTo(250, 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await composition(page)).parts[0].crop.x)
    .toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await composition(page)).parts[0].crop.x)
    .toBeCloseTo(250, 0);
  await page.getByRole("tab", { name: "Strokes", exact: true }).click();
  await page
    .getByRole("button", { name: "Add horizontal stroke", exact: true })
    .click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  await expect(
    page.getByLabel("Composition name", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save composition to library", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("kanji-maker.library.v1")!).length,
      ),
    )
    .toBe(1);
  const project = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("kanji-maker.library.v1")!)[0]
        .composition,
  );
  expect(project.parts).toHaveLength(2);
  expect(project.parts[0].crop.x).toBeCloseTo(250, 0);
  await expect(page.locator(".component-inspector")).not.toContainText("SVG");
  await expect(page.locator(".component-inspector")).not.toContainText(
    "Save to library",
  );
  await expect(
    page.getByRole("link", { name: "Back to character editor" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open composition library" }).click();
  await expect(
    page.locator("#libraryDialog input[accept='.json']"),
  ).toHaveCount(0);
  await expect(page.locator("#libraryDialog .library-copy")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Export Radical composition", exact: true })
    .click();
  const exportDialog = page.getByRole("dialog", {
    name: "Export",
    exact: true,
  });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByRole("radio")).toHaveCount(2);
  await exportDialog.getByRole("radio", { name: "SVG", exact: true }).check();
  const svgDownload = page.waitForEvent("download");
  await exportDialog
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const svg = await readFile((await (await svgDownload).path())!, "utf-8");
  expect(svg).toContain("clipPath");
  expect(svg).not.toContain("data-handle");
  await expect(exportDialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Export Radical composition", exact: true })
    .click();
  await exportDialog.getByRole("radio", { name: "PNG", exact: true }).check();
  const pngDownload = page.waitForEvent("download");
  await exportDialog
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const png = await readFile((await (await pngDownload).path())!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(exportDialog).toHaveCount(0);
  await page.getByRole("button", { name: "Close library" }).click();
  await page
    .getByRole("button", { name: "Open composition in character editor" })
    .click();
  await expect(page).toHaveURL(/#editor$/);
  await expect(page.locator("#glyphName")).toHaveValue("Radical composition");
  await expect(page.locator("#saveGlyph")).toBeEnabled();
  await page.getByRole("link", { name: "Radicals & strokes" }).click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
});

test("restores the editable composition independently of the normal editor", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Strokes", exact: true }).click();
  await page
    .getByRole("button", { name: "Add vertical hook stroke", exact: true })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  const ids = (await composition(page)).parts.map((p: { id: string }) => p.id);
  expect(new Set(ids).size).toBe(2);
  await page.getByLabel("Left", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Save composition to library", exact: true })
    .click();
  await expect
    .poll(async () => (await composition(page)).libraryId)
    .toBeTruthy();
  await page.locator("#compositionCanvas").focus();
  await page.keyboard.press("Escape");
  const selector = page.getByRole("combobox", {
    name: "Selected component",
    exact: true,
  });
  await expect(selector).toHaveValue("");
  await expect(selector).toBeEnabled();
  await expect(page.getByLabel("Width %", { exact: true })).toHaveCount(0);
  const selectedId = (await composition(page)).parts[0].id;
  await selector.selectOption(selectedId);
  await expect(selector).toHaveValue(selectedId);
  await expect(page.getByLabel("Width %", { exact: true })).toBeVisible();
  const before = await composition(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("[data-component]")).toHaveCount(0);
  expect((await composition(page)).libraryId).toBeUndefined();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  expect(await composition(page)).toEqual(before);
  await page.reload();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  expect(await composition(page)).toEqual(before);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator("[data-component]")).toHaveCount(1);
  await page.getByRole("button", { name: "Open composition library" }).click();
  await page
    .getByRole("button", { name: "Open Radical composition", exact: true })
    .click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
  await page.getByRole("button", { name: "Open composition library" }).click();
  const backupDownload = page.waitForEvent("download");
  await page.locator("#exportProject").click();
  const backup = await readFile((await (await backupDownload).path())!);
  await page.getByRole("button", { name: "Close library" }).click();
  await page.locator("#compositionImportFile").setInputFiles({
    name: "compositions.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page.getByRole("button", { name: "Open composition library" }).click();
  await expect(page.locator("#library .library-item")).toHaveCount(2);
  await page.locator(".library-load").first().click();
  await expect(page.locator("[data-component]")).toHaveCount(2);
});

test.describe("phone composer", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("keeps the canvas on screen and edits components through sheets", async ({
    page,
  }) => {
    await expect(
      page
        .locator(".composer-toolbar")
        .getByRole("button", { name: "Add radical or stroke", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".composer-toolbar")
        .getByRole("button", { name: "Component settings", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".composer-bottom > button")).toHaveCount(0);
    await expect(
      page.locator(".composer-header > button").first(),
    ).toHaveAccessibleName("Open composition in character editor");
    await page
      .getByRole("button", { name: "Add radical or stroke", exact: true })
      .click();
    await page.getByRole("tab", { name: "Strokes", exact: true }).click();
    await page
      .getByRole("button", { name: "Add horizontal stroke", exact: true })
      .click();
    await expect(page.locator("#compositionSheet")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Component settings", exact: true })
      .click();
    await page.getByLabel("Width %", { exact: true }).fill("80");
    await expect(
      page.locator('[aria-label="Selected component mode"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('#compositionSheet input[type="file"]'),
    ).toHaveCount(0);
    await expect(page.locator("#compositionImportFile")).toHaveCount(1);
    await expect(
      page.getByLabel("Composition name", { exact: true }),
    ).toHaveCount(0);
    const close = page.getByRole("button", { name: "Close component panel" });
    const before = (await close.boundingBox())!;
    await page.getByLabel("Left", { exact: true }).fill("25");
    await page.locator(".panel-dialog-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const after = (await close.boundingBox())!;
    expect(after.y).toBeCloseTo(before.y);
    await page.getByRole("button", { name: "Close component panel" }).click();
    expect((await composition(page)).parts[0].crop.x).toBe(250);
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const selector of [".composer-header", ".composer-toolbar"]) {
        const bounds = (await page.locator(selector).boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(
          await page
            .locator(selector)
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
      }
      const canvas = (await page.locator("#compositionCanvas").boundingBox())!;
      expect(canvas.x).toBeGreaterThanOrEqual(0);
      expect(canvas.y).toBeGreaterThanOrEqual(0);
      expect(canvas.x + canvas.width).toBeLessThanOrEqual(width);
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(height);
    }
  });
});

test("radicals are grouped by stroke count and the preview uses real text", async ({
  page,
}) => {
  await expect(page.locator("[data-radical-number]")).toHaveCount(214);
  await expect(
    page.getByRole("button", { name: "Add 龠 radical", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Add 木 radical", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview composition in text" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Text preview" }),
  ).toBeVisible();
  await expect(page.locator(".composition-text-preview")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".composition-text-preview svg")).toHaveCount(0);
  await expect(page.locator(".composition-text-preview mark")).toHaveText([
    "\uE000",
    "\uE000",
    "\uE000",
  ]);
  expect(
    await page
      .locator(".composition-text-preview")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("KanjiPreview-");
});
