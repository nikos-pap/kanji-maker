import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const draft = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("kanji-maker.draft.v1")!),
  );
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Save to library", exact: true }),
  ).toBeEnabled();
});
test.afterEach(() => expect(errors).toEqual([]));

test("phone canvas and controls fit the viewport in portrait and landscape", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".phone-screen")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    for (const selector of [
      ".phone-topbar",
      "#canvas",
      ".phone-dials",
      ".phone-view-actions",
      "#phoneTools",
    ]) {
      const bounds = (await page.locator(selector).boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    }
    await page.locator("#phoneTools").click();
    await expect(page.locator("#phoneToolPalette [data-tool]")).toHaveText([
      "Draw",
      "Erase",
      "Cut area",
      "Line",
      "Points",
    ]);
    const palette = (await page.locator("#phoneToolPalette").boundingBox())!;
    expect(palette.y).toBeGreaterThanOrEqual(50);
    expect(palette.y + palette.height).toBeLessThanOrEqual(height);
    if (width === 390) await page.screenshot({ path: "tmp/phone-tools.png" });
    if (width === 844)
      await page.screenshot({ path: "tmp/phone-landscape-tools.png" });
    await page.getByRole("button", { name: "Line", exact: true }).click();
    await expect(page.locator("#phoneToolPalette")).toHaveCount(0);
    await expect(page.locator("#canvas")).toHaveAttribute("data-mode", "line");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.wheel(0, 800);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: "tmp/phone-portrait.png" });
});

test("two-tap tools, brush shape, dials and touch gestures edit without scrolling", async ({
  page,
}) => {
  for (const tool of ["Erase", "Cut area", "Line", "Points", "Draw"]) {
    await page.locator("#phoneTools").click();
    await page.getByRole("button", { name: tool, exact: true }).click();
    await expect(page.locator("#phoneTools")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
  expect((await draft(page)).model.operations).toHaveLength(0);
  await page.locator("#phoneTools").click();
  await page.getByRole("switch", { name: "Square brush" }).click();
  await expect(page.locator("#phoneToolPalette")).toHaveCount(0);
  await page.getByRole("slider", { name: "Brush size", exact: true }).focus();
  const dial = (await page
    .getByRole("slider", { name: "Brush size", exact: true })
    .boundingBox())!;
  await page.mouse.move(
    dial.x + (dial.width * 16) / 120,
    dial.y + (dial.height * 62) / 88,
  );
  await page.mouse.down();
  await page.mouse.move(
    dial.x + dial.width / 2,
    dial.y + (dial.height * 18) / 88,
    { steps: 8 },
  );
  await page.mouse.up();
  const changedSize = Number(
    await page
      .getByRole("slider", { name: "Brush size", exact: true })
      .getAttribute("aria-valuenow"),
  );
  expect(changedSize).toBeGreaterThan(75);
  expect(changedSize).toBeLessThan(85);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("slider", { name: "Brush size", exact: true }),
  ).toHaveAttribute("aria-valuenow", "160");
  await page.getByRole("slider", { name: "Zoom", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("slider", { name: "Zoom", exact: true }),
  ).toHaveAttribute("aria-valuetext", "1600%");
  await page.getByRole("button", { name: "Fit canvas" }).click();
  const fitted = (await page.locator("#canvas").getAttribute("viewBox"))!
    .split(" ")
    .map(Number);
  expect(fitted[0] + fitted[2] / 2).toBeCloseTo(500);
  expect(fitted[1] + fitted[3] / 2).toBeCloseTo(500);
  const bounds = (await page.locator("#canvas").boundingBox())!,
    x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 35, y, id: 1 },
      { x: x + 35, y, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 70, y, id: 1 },
      { x: x + 70, y, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () =>
      Number(
        (await page.locator("#canvas").getAttribute("viewBox"))!.split(" ")[2],
      ),
    )
    .toBeLessThan(1000);
  expect((await draft(page)).model.operations).toHaveLength(0);
  await page.getByRole("button", { name: "Fit canvas" }).click();
  await page.touchscreen.tap(x, y);
  await expect
    .poll(async () => (await draft(page)).model.operations.length)
    .toBe(1);
  expect((await draft(page)).model.operations[0]).toMatchObject({
    kind: "draw",
    brushShape: "square",
    width: 160,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).model.operations.length)
    .toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).model.operations.length)
    .toBe(1);
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  await expect(page.locator("#grid")).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("top bar opens character/library and export panels and saves/imports files", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Choose character" }).click();
  await expect(page.getByRole("dialog", { name: "Character" })).toBeVisible();
  await expect(page.locator("#phonePanel .library-panel")).toHaveCount(0);
  await expect(page.locator("#phonePanel #fontFile")).toHaveCount(0);
  await page.locator("#character").fill("日");
  await page.locator("#loadCharacter").click();
  await expect(page.locator("#phonePanel")).toHaveCount(0);
  await expect(page.locator(".phone-character span")).toHaveText("日");
  await page.getByRole("button", { name: "Choose font", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Font", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#fontFile")).toHaveCount(1);
  await expect(page.locator("#phonePanel #character")).toHaveCount(0);
  await expect(page.locator("#phonePanel .library-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).click();
  const libraryButton = (await page
    .getByRole("button", { name: "Open library", exact: true })
    .boundingBox())!;
  const saveButton = (await page
    .getByRole("button", { name: "Save to library", exact: true })
    .boundingBox())!;
  expect(libraryButton.x + libraryButton.width).toBeLessThanOrEqual(
    saveButton.x,
  );
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await page.getByRole("button", { name: "Open library" }).click();
  await expect(page.locator(".library-item")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.locator("#exportProject").click();
  const backup = await readFile((await (await download).path())!);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.locator("#phoneImportFile").setInputFiles({
    name: "phone-library.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page.getByRole("button", { name: "Open library" }).click();
  await expect(page.locator(".library-item")).toHaveCount(2);
  await page.screenshot({ path: "tmp/phone-character-panel.png" });
  await page.getByRole("button", { name: "Close panel" }).click();
  await page
    .getByRole("button", { name: "Export and copy", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Export and copy" }),
  ).toBeVisible();
  const svgDownload = page.waitForEvent("download");
  await page.locator("#exportSvg").click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);
  await page.getByRole("button", { name: "Close panel" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});
