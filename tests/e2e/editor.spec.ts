import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator("#exportSvg")).toBeEnabled();
  await expect
    .poll(
      async () =>
        (await page.locator("#artwork path").first().getAttribute("d"))
          ?.length || 0,
    )
    .toBeGreaterThan(100);
});
test.afterEach(() => expect(errors).toEqual([]));
const draft = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.draft.v1")!),
  );

test("drawing, undo, redo, visible area cuts, points and zoom", async ({
  page,
}) => {
  await expect(page).toHaveURL(/\/kanji-maker\/$/);
  const box = (await page.locator("#canvas").boundingBox())!;
  await expect(page.locator(".tool-group button")).toHaveText([
    "Draw",
    "Erase",
    "Cut area",
    "Line",
    "Pan",
    "Points",
  ]);
  await expect(page.locator('[data-tool="polygon"]')).toHaveCount(0);
  await expect(page.locator(".editor-toolbar #showGrid")).toBeChecked();
  await page.locator("#showGrid").uncheck();
  await expect(page.locator("#grid")).toHaveCount(0);
  await page.locator("#showGrid").check();
  await page.locator('[data-brush-shape="square"]').click();
  await page.locator('[data-tool="draw"]').click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await draft(page)).model.operations.length)
    .toBe(1);
  await page.locator("#undo").click();
  await expect
    .poll(async () => (await draft(page)).model.operations.length)
    .toBe(0);
  await page.locator("#redo").click();
  await expect
    .poll(async () => (await draft(page)).model.operations[0].kind)
    .toBe("draw");
  expect((await draft(page)).model.operations[0].brushShape).toBe("square");
  await page.locator('[data-tool="cut"]').click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4, {
    steps: 4,
  });
  await expect(page.locator("#cutPreview")).toBeVisible();
  await expect(page.locator("#cutPreview")).toHaveAttribute("width", /[1-9]/);
  await page.screenshot({ path: "tmp/cut-preview.png", fullPage: true });
  await page.mouse.up();
  await expect(page.locator("#cutPreview")).toHaveCount(0);
  await expect
    .poll(async () => (await draft(page)).model.operations.at(-1).kind)
    .toBe("cut");
  await page.locator('[data-tool="points"]').click();
  await page.locator("#outlineOverlay .anchor").first().click();
  const oldPath = (await draft(page)).model.basePath;
  const x = Number(await page.locator("#pointX").inputValue());
  await page.locator("#pointX").fill(String(x + 2));
  await expect
    .poll(async () => (await draft(page)).model.basePath)
    .not.toBe(oldPath);
  await page.locator("#undo").click();
  await expect
    .poll(async () => (await draft(page)).model.basePath)
    .toBe(oldPath);
  await page.locator("#zoomIn").click();
  await expect(page.locator("#zoomLevel")).toHaveValue("1.5");
  await page.locator("#zoomFit").click();
  await expect(page.locator("#zoomLevel")).toHaveValue("1");
  // Composed cuts and strokes exercise silhouette tracing, rather than native outlines.
  const fontDownload = page.waitForEvent("download");
  await page.locator("#exportFont").click();
  const tracedFont = await readFile((await (await fontDownload).path())!);
  expect(
    fontkit.create(new Uint8Array(tracedFont)).hasGlyphForCodePoint(0xe000),
  ).toBe(true);
  await expect(page.locator("#saveGlyph")).toBeEnabled();
  await page.screenshot({ path: "tmp/react-editor.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tmp/editor-mobile.png", fullPage: true });
});

test("library survives reload and exports JSON, SVG, PNG, font and Word", async ({
  page,
}) => {
  await page.locator("#glyphName").fill("React library test");
  await page.locator("#saveGlyph").click();
  await expect(page.locator("#library .library-item")).toHaveCount(1);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.library.v1")!),
  );
  expect(stored[0].codePoint).toBe(0xe000);
  await page.reload();
  await expect(page.locator("#exportLibraryFont")).toBeEnabled();
  for (const [id, extension] of [
    ["exportSvg", ".svg"],
    ["exportPng", ".png"],
    ["exportFont", ".ttf"],
    ["exportProject", ".json"],
    ["exportLibraryFont", ".ttf"],
    ["exportLibraryWord", ".docx"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.locator(`#${id}`).click();
    const file = await pending;
    expect(file.suggestedFilename()).toContain(extension);
    const bytes = await readFile((await file.path())!);
    expect(bytes.length).toBeGreaterThan(100);
    if (extension === ".ttf") {
      const font = fontkit.create(new Uint8Array(bytes));
      expect(font.hasGlyphForCodePoint(0xe000)).toBe(true);
    } else if (extension === ".json")
      expect(JSON.parse(bytes.toString()).glyphs[0].id).toBe(stored[0].id);
    else if (extension === ".png")
      expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
    else if (extension === ".svg") expect(bytes.toString()).toContain("<path");
    else if (extension === ".docx")
      expect(bytes.includes(Buffer.from("word/fonts/library.odttf"))).toBe(
        true,
      );
    await expect(page.locator("#saveGlyph")).toBeEnabled();
  }
});

test("imports compatible backups with stable codes and loads a selected font", async ({
  page,
}) => {
  const current = (await draft(page)).model;
  const identity = "abcdefab-1234-5678-9012-abcdefabcdef";
  const backup = {
    format: "kanji-maker-library",
    version: 2,
    font: { id: identity, nextCodePoint: 0xe081, revision: 1 },
    glyphs: [
      {
        id: "legacy-entry",
        codePoint: 0xe080,
        model: { ...current, name: "Imported glyph" },
      },
    ],
  };
  const importBackup = () =>
    page.locator("#projectFile").setInputFiles({
      name: "library.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await importBackup();
  await expect(page.locator("#library .library-item")).toHaveCount(1);
  let stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.library.v1")!),
  );
  expect(stored[0].codePoint).toBe(0xe080);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kanji-maker.library-metadata.v1")!).id,
    ),
  ).toBe(identity);
  await importBackup();
  await expect(page.locator("#library .library-item")).toHaveCount(2);
  stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.library.v1")!),
  );
  expect(stored[0].codePoint).toBe(0xe081);
  await page
    .locator("#fontFile")
    .setInputFiles(path.resolve("assets/fonts/N5PDFSerif-Regular.ttf"));
  await expect(page.locator("#fontName")).toHaveText("N5PDFSerif-Regular.ttf");
  await expect(page.locator("#exportSvg")).toBeEnabled();
  await page.locator("#library .library-delete").first().click();
  await page
    .locator("#confirmDialog")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.locator("#library .library-item")).toHaveCount(1);
  await page.locator("#help").click();
  await expect(page.locator("#helpDialog")).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator("#helpDialog")).toHaveCount(0);
});
