import { describe, expect, it } from "vitest";
import {
  canvasViewport,
  zoomCamera,
  anchoredCamera,
  boundedCamera,
} from "../../src/lib/viewport";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Glyph } from "../../src/components/Glyph";

const fit = { x: 0, y: 0, zoom: 1 };
describe("expanded drawing viewport", () => {
  it("uses portrait space above and below the print square at 200% zoom", () => {
    const view = canvasViewport(zoomCamera(fit, 2), {
      width: 390,
      height: 790,
    });
    expect(view.width).toBeCloseTo(500);
    expect(view.y).toBeLessThan(0);
    expect(view.y + view.height).toBeGreaterThan(1000);
    expect(view.width / view.height).toBeCloseTo(390 / 790);
  });
  it("uses landscape space left and right of the print square at 200% zoom", () => {
    const view = canvasViewport(zoomCamera(fit, 2), {
      width: 790,
      height: 390,
    });
    expect(view.height).toBeCloseTo(500);
    expect(view.x).toBeLessThan(0);
    expect(view.x + view.width).toBeGreaterThan(1000);
  });
  it("keeps wheel zoom anchored to the same screen position", () => {
    const bounds = { width: 390, height: 790 },
      anchor: [number, number] = [100, 300];
    const before = canvasViewport(fit, bounds),
      after = canvasViewport(zoomCamera(fit, 3, anchor), bounds);
    expect((anchor[0] - after.x) / after.width).toBeCloseTo(
      (anchor[0] - before.x) / before.width,
    );
    expect((anchor[1] - after.y) / after.height).toBeCloseTo(
      (anchor[1] - before.y) / before.height,
    );
  });
  it("uses both viewport dimensions for two-finger navigation without a square clamp", () => {
    const bounds = { width: 390, height: 790 },
      anchor: [number, number] = [370, 420];
    const camera = anchoredCamera(2, bounds, anchor, [0.3, 0.7]),
      view = canvasViewport(camera, bounds);
    expect(view.x + 0.3 * view.width).toBeCloseTo(anchor[0]);
    expect(view.y + 0.7 * view.height).toBeCloseTo(anchor[1]);
    const moved = anchoredCamera(1, bounds, [0, 0], [0.5, 0.5]);
    expect(moved.x).toBe(-500);
    expect(moved.y).toBe(-500);
  });
  it("allows editor artwork outside the print guide while exports keep their crop", () => {
    const model = {
      version: 1 as const,
      character: "長",
      name: "Test",
      basePath: "M0 -100L500 500L1000 1100Z",
      operations: [],
    };
    expect(
      renderToStaticMarkup(
        createElement(Glyph, { model, prefix: "edit", unbounded: true }),
      ),
    ).toContain('overflow="visible"');
    expect(
      renderToStaticMarkup(createElement(Glyph, { model, prefix: "export" })),
    ).toContain('overflow="hidden"');
  });
  it("extends eraser masks to the viewport in the editor rather than re-clipping the artwork", () => {
    const model = {
      version: 1 as const,
      character: "長",
      name: "Test",
      basePath: "M0 -100L500 500L1000 1100Z",
      operations: [
        {
          kind: "erase" as const,
          width: 20,
          points: [[500, 500] as [number, number]],
        },
      ],
    };
    const markup = renderToStaticMarkup(
      createElement(Glyph, {
        model,
        prefix: "edit",
        unbounded: true,
        viewport: { x: -500, y: -500, width: 2000, height: 2000 },
      }),
    );
    expect(
      markup.match(/x="-500" y="-500" width="2000" height="2000"/g),
    ).toHaveLength(2);
  });
});
describe("bounded phone camera", () => {
  const portrait = { width: 366, height: 700 };
  it("supports zoom through 1600% and locks movement at 100% or below", () => {
    expect(boundedCamera({ x: -900, y: 700, zoom: 1 }, portrait)).toEqual(fit);
    expect(boundedCamera({ x: 900, y: -300, zoom: 0.5 }, portrait)).toEqual({
      x: -500,
      y: -500,
      zoom: 0.5,
    });
    expect(boundedCamera({ x: 0, y: 0, zoom: 8 }, portrait).zoom).toBe(8);
    expect(boundedCamera({ x: 0, y: 0, zoom: 99 }, portrait).zoom).toBe(16);
  });
  it("keeps the fitting axis centered while zooming the other axis", () => {
    const camera = boundedCamera({ x: 900, y: -300, zoom: 1.5 }, portrait);
    expect(camera.x).toBeCloseTo(1000 - 1000 / 1.5);
    expect(camera.y).toBeCloseTo(500 - 500 / 1.5);
    const view = canvasViewport(camera, portrait);
    expect(view.y + view.height / 2).toBeCloseTo(500);
    expect(view.y).toBeLessThan(0);
    expect(view.y + view.height).toBeGreaterThan(1000);
  });
  it("stops inward-moving edges at their original 100% positions, without cropping to that square", () => {
    for (const bounds of [portrait, { width: 820, height: 246 }]) {
      const original = canvasViewport(fit, bounds);
      const leftTop = canvasViewport(
        boundedCamera({ x: -10000, y: -10000, zoom: 4 }, bounds),
        bounds,
      );
      const rightBottom = canvasViewport(
        boundedCamera({ x: 10000, y: 10000, zoom: 4 }, bounds),
        bounds,
      );
      expect(-leftTop.x / leftTop.unit).toBeCloseTo(
        -original.x / original.unit,
      );
      expect(-leftTop.y / leftTop.unit).toBeCloseTo(
        -original.y / original.unit,
      );
      expect((1000 - rightBottom.x) / rightBottom.unit).toBeCloseTo(
        (1000 - original.x) / original.unit,
      );
      expect((1000 - rightBottom.y) / rightBottom.unit).toBeCloseTo(
        (1000 - original.y) / original.unit,
      );
      expect(leftTop.width / leftTop.height).toBeCloseTo(
        bounds.width / bounds.height,
      );
    }
  });
  it("zooms back below 100% while preserving the center", () => {
    const camera = boundedCamera(
      zoomCamera(fit, 0.5, undefined, 0.25),
      portrait,
    );
    const view = canvasViewport(camera, portrait);
    expect(camera.zoom).toBe(0.5);
    expect(view.x + view.width / 2).toBeCloseTo(500);
    expect(view.y + view.height / 2).toBeCloseTo(500);
  });
});
