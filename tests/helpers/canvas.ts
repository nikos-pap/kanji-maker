import type { Page } from "@playwright/test";

export function canvasPoint(page: Page, x: number, y: number) {
  return page.locator("#canvas").evaluate(
    (element, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        (element as SVGSVGElement).getScreenCTM()!,
      );
      return { x: p.x, y: p.y };
    },
    { x, y },
  );
}
