import { describe, expect, it } from "vitest";
import {
  canvasViewport,
  zoomCamera,
  anchoredCamera,
  boundedCamera,
  advancePinch,
} from "../../src/lib/viewport";
import type { PinchState, ViewportSize } from "../../src/lib/viewport";
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

describe("pinch constraint transitions", () => {
  it("opens the pan range continuously rather than snapping to a latent offset", () => {
    for (const bounds of [
      { width: 390, height: 526.5 },
      { width: 526.5, height: 390 },
    ]) {
      for (const offset of [-10000, 10000]) {
        const before = canvasViewport(
          boundedCamera({ x: offset, y: offset, zoom: 1.3499 }, bounds),
          bounds,
        );
        const after = canvasViewport(
          boundedCamera({ x: offset, y: offset, zoom: 1.3501 }, bounds),
          bounds,
        );
        expect(
          Math.abs(-after.x / after.unit + before.x / before.unit),
        ).toBeLessThan(0.1);
        expect(
          Math.abs(-after.y / after.unit + before.y / before.unit),
        ).toBeLessThan(0.1);
      }
    }
  });
  it("crosses the 135% fit threshold smoothly in either orientation and direction", () => {
    for (const [width, height, axis] of [
      [390, 526.5, 1],
      [526.5, 390, 0],
    ]) {
      const bounds: ViewportSize = { width, height };
      const fraction: [number, number] = [0.25, 0.25];
      const initial = canvasViewport(fit, bounds);
      let state: PinchState = {
        zoom: 1,
        distance: 100,
        anchor: [
          initial.x + fraction[0] * initial.width,
          initial.y + fraction[1] * initial.height,
        ],
      };
      let previousEdge =
        axis === 0 ? -initial.x / initial.unit : -initial.y / initial.unit;
      const sequence = [
        ...Array.from({ length: 101 }, (_, i) => 1 + i * 0.005),
        ...Array.from({ length: 100 }, (_, i) => 1.495 - i * 0.005),
      ];
      for (const zoom of sequence) {
        const next = advancePinch(state, bounds, zoom * 100, fraction, true);
        const view = canvasViewport(next.camera, bounds);
        const edge = axis === 0 ? -view.x / view.unit : -view.y / view.unit;
        expect(Math.abs(edge - previousEdge)).toBeLessThan(2);
        expect(next.camera.zoom).toBeCloseTo(zoom);
        previousEdge = edge;
        state = next.pinch;
      }
    }
  });
  it("does not release blocked panning when a fitting axis becomes pannable", () => {
    const bounds = { width: 390, height: 526.5 };
    const initial = canvasViewport(fit, bounds);
    const state: PinchState = { zoom: 1, distance: 100, anchor: [500, 500] };
    const held = advancePinch(state, bounds, 134.99, [0.5, 0.8], true);
    const next = advancePinch(held.pinch, bounds, 135.01, [0.5, 0.8], true);
    const before = canvasViewport(held.camera, bounds);
    const after = canvasViewport(next.camera, bounds);
    expect(
      Math.abs(-after.y / after.unit + before.y / before.unit),
    ).toBeLessThan(1);
    expect(initial.height / initial.unit).toBeCloseTo(bounds.height);
  });
  it("responds immediately when reversing a pinch at the maximum zoom", () => {
    const bounds = { width: 390, height: 844 };
    const state: PinchState = { zoom: 16, distance: 100, anchor: [500, 500] };
    const held = advancePinch(state, bounds, 200, [0.5, 0.5], true);
    const reversed = advancePinch(held.pinch, bounds, 190, [0.5, 0.5], true);
    expect(held.camera.zoom).toBe(16);
    expect(reversed.camera.zoom).toBeCloseTo(15.2);
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
  it("keeps inward-moving edges outside the 100% limits without cropping to that square", () => {
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
      expect(-leftTop.x / leftTop.unit).toBeLessThanOrEqual(
        -original.x / original.unit + 1e-8,
      );
      expect(-leftTop.y / leftTop.unit).toBeLessThanOrEqual(
        -original.y / original.unit + 1e-8,
      );
      expect((1000 - rightBottom.x) / rightBottom.unit).toBeGreaterThanOrEqual(
        (1000 - original.x) / original.unit - 1e-8,
      );
      expect((1000 - rightBottom.y) / rightBottom.unit).toBeGreaterThanOrEqual(
        (1000 - original.y) / original.unit - 1e-8,
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

describe("full-screen phone rendering", () => {
  const screen = {
    width: 390,
    height: 844,
    fit: { x: 0, y: 55, width: 390, height: 717 },
  };
  it("makes 100% use the full phone width while centering above the buttons", () => {
    const view = canvasViewport(fit, screen);
    const left = -view.x / view.unit;
    const top = -view.y / view.unit;
    const size = 1000 / view.unit;
    expect(left).toBeCloseTo(0);
    expect(size).toBeCloseTo(390);
    expect(top).toBeGreaterThan(screen.fit.y);
    expect(top + size).toBeLessThan(screen.fit.y + screen.fit.height);
    expect(top + size / 2).toBeCloseTo(screen.fit.y + screen.fit.height / 2);
  });
  it("renders zoomed artwork beyond the fit area in all four screen directions", () => {
    const view = canvasViewport(
      boundedCamera(zoomCamera(fit, 4), screen),
      screen,
    );
    const pixel = (x: number, y: number) => [
      (x - view.x) / view.unit,
      (y - view.y) / view.unit,
    ];
    const [left, top] = pixel(0, 0);
    const [right, bottom] = pixel(1000, 1000);
    expect(left).toBeLessThan(0);
    expect(top).toBeLessThan(0);
    expect(right).toBeGreaterThan(screen.width);
    expect(bottom).toBeGreaterThan(screen.height);
    expect(view.width / view.unit).toBeCloseTo(screen.width);
    expect(view.height / view.unit).toBeCloseTo(screen.height);
  });
  it("limits inward movement independently of the larger render surface", () => {
    for (const offset of [-10000, 10000]) {
      const view = canvasViewport(
        boundedCamera({ x: offset, y: offset, zoom: 4 }, screen),
        screen,
      );
      const edge = offset < 0 ? 0 : 1000;
      if (edge === 0) {
        expect((edge - view.x) / view.unit).toBeCloseTo(screen.fit.x);
        expect((edge - view.y) / view.unit).toBeCloseTo(screen.fit.y);
      } else {
        expect((edge - view.x) / view.unit).toBeCloseTo(
          screen.fit.x + screen.fit.width,
        );
        expect((edge - view.y) / view.unit).toBeCloseTo(
          screen.fit.y + screen.fit.height,
        );
      }
      expect(view.height / view.unit).toBeCloseTo(844);
    }
  });
  it("keeps pinch anchors correct with an offset fit center", () => {
    const anchor: [number, number] = [350, 480];
    const fraction: [number, number] = [0.3, 0.65];
    const view = canvasViewport(
      anchoredCamera(3, screen, anchor, fraction),
      screen,
    );
    expect(view.x + fraction[0] * view.width).toBeCloseTo(anchor[0]);
    expect(view.y + fraction[1] * view.height).toBeCloseTo(anchor[1]);
  });
});
