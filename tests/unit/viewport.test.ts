import { describe, expect, it } from "vitest";
import {
  canvasViewport,
  zoomCamera,
  anchoredCamera,
} from "../../src/lib/viewport";
import { dialFraction, dialPoint } from "../../src/lib/dial";
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
describe("arc dial", () => {
  it("maps the full sweep to minimum, middle and maximum", () => {
    expect(dialFraction(16, 62)).toBe(0);
    expect(dialFraction(60, 18)).toBe(0.5);
    expect(dialFraction(104, 62)).toBe(1);
    for (const value of [0, 0.1, 0.5, 0.9, 1]) {
      const p = dialPoint(value);
      expect(dialFraction(p.x, p.y)).toBeCloseTo(value);
    }
  });
  it("clamps movement below the arc to the closest end", () => {
    expect(dialFraction(15, 80)).toBe(0);
    expect(dialFraction(105, 80)).toBe(1);
  });
});
