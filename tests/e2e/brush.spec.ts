import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

async function exportedAlpha(page: Page, x: number, y: number) {
  const pending = page.waitForEvent("download");
  await page.locator("#exportSvg").click();
  const text = await readFile((await (await pending).path())!, "utf8");
  return page.evaluate(
    async ({ text, x, y }) => {
      const url = URL.createObjectURL(
        new Blob([text], { type: "image/svg+xml" }),
      );
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1000;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(x, y, 1, 1).data[3];
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    { text, x, y },
  );
}

test("square brush is shared by Draw, Erase and Line and survives save/reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator("#exportSvg")).toBeEnabled();
  // Keep the source outline outside the pixel samples used to check the brush.
  const backup = {
    format: "kanji-maker-library",
    version: 2,
    font: {
      id: "abcdefab-1234-5678-9012-abcdefabcdef",
      nextCodePoint: 0xe001,
      revision: 1,
    },
    glyphs: [
      {
        id: "brush-test",
        codePoint: 0xe000,
        model: {
          version: 1,
          character: "長",
          name: "Brush test",
          basePath: "M900 900L950 900L950 950Z",
          operations: [],
        },
      },
    ],
  };
  await page
    .locator("#projectFile")
    .setInputFiles({
      name: "brush.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await page.locator(".library-load").click();
  await page.locator('[data-brush-shape="square"]').click();
  await page.locator("#brushValue").fill("100");
  const box = (await page.locator("#canvas").boundingBox())!;
  const move = (x: number, y: number) =>
    page.mouse.move(box.x + box.width * x, box.y + box.height * y);
  await move(0.5, 0.5);
  await expect(page.locator("rect#brushCursor")).toBeVisible();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  expect(await exportedAlpha(page, 455, 455)).toBe(255);
  await page.locator('[data-tool="erase"]').click();
  await expect(page.locator('[data-brush-shape="square"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await move(0.5, 0.5);
  await page.mouse.down();
  await page.mouse.up();
  expect(await exportedAlpha(page, 455, 455)).toBe(0);
  await page.locator('[data-tool="line"]').click();
  await move(0.2, 0.2);
  await page.mouse.down();
  await move(0.4, 0.4);
  await page.mouse.up();
  expect(await exportedAlpha(page, 155, 155)).toBe(255);
  await page.locator('[data-brush-shape="round"]').click();
  await move(0.7, 0.7);
  await expect(page.locator("circle#brushCursor")).toBeVisible();
  await page.locator("#showGrid").uncheck();
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await expect(page.locator("#showGrid")).not.toBeChecked();
  await page.locator("#saveGlyph").click();
  await page.reload();
  await expect(page.locator("#exportSvg")).toBeEnabled();
  const operations = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("kanji-maker.draft.v1")!).model
        .operations,
  );
  expect(operations.map((op: { kind: string }) => op.kind)).toEqual([
    "draw",
    "erase",
    "line",
  ]);
  expect(
    operations.every(
      (op: { brushShape: string }) => op.brushShape === "square",
    ),
  ).toBe(true);
  expect(await exportedAlpha(page, 155, 155)).toBe(255);
  expect(errors).toEqual([]);
});
