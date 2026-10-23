import type { Composer } from "../../hooks/useComposition";
import { isCropped, partBounds, resizePart } from "../../lib/composition";
import { clamp, round } from "../../lib/geometry";

type Props = {
  composer: Composer;
};
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step=".1"
        value={round(value)}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => {
          if (Number.isFinite(event.currentTarget.valueAsNumber))
            onChange(clamp(event.currentTarget.valueAsNumber, min, max));
        }}
      />
    </label>
  );
}
export function ComponentInspector({ composer: c }: Props) {
  const part = c.part,
    bounds = part ? partBounds(part) : null;
  function field(axis: "x" | "y" | "width" | "height", value: number) {
    if (part && bounds)
      c.updatePart(resizePart(part, { ...bounds, [axis]: value * 10 }));
  }
  function trim(edge: "left" | "right" | "top" | "bottom", percent: number) {
    if (!part) return;
    const next = { ...part.crop },
      value = percent * 10;
    if (edge === "left") {
      const right = next.x + next.width;
      next.x = clamp(value, 0, right - 10);
      next.width = right - next.x;
    }
    if (edge === "right")
      next.width = clamp(1000 - value - next.x, 10, 1000 - next.x);
    if (edge === "top") {
      const bottom = next.y + next.height;
      next.y = clamp(value, 0, bottom - 10);
      next.height = bottom - next.y;
    }
    if (edge === "bottom")
      next.height = clamp(1000 - value - next.y, 10, 1000 - next.y);
    c.updatePart({ ...part, crop: next });
  }
  const selection = c.document.parts.findIndex((p) => p.id === c.selected);
  return (
    <section className="component-inspector" aria-label="Component settings">
      <label>
        Component
        <select
          aria-label="Selected component"
          value={part?.id ?? ""}
          disabled={!c.document.parts.length}
          onChange={(event) => c.select(event.currentTarget.value || null)}
        >
          <option value="" disabled>
            Select a component
          </option>
          {c.document.parts.map((p, i) => (
            <option key={p.id} value={p.id}>
              {i + 1}. {p.label}
            </option>
          ))}
        </select>
      </label>
      {part && bounds ? (
        <>
          <div className="component-fields">
            <NumberField
              label="X %"
              value={bounds.x / 10}
              min={-500}
              max={500}
              onChange={(value) => field("x", value)}
            />
            <NumberField
              label="Y %"
              value={bounds.y / 10}
              min={-500}
              max={500}
              onChange={(value) => field("y", value)}
            />
            <NumberField
              label="Width %"
              value={bounds.width / 10}
              min={1}
              max={500}
              onChange={(value) => field("width", value)}
            />
            <NumberField
              label="Height %"
              value={bounds.height / 10}
              min={1}
              max={500}
              onChange={(value) => field("height", value)}
            />
          </div>
          <fieldset className="component-crop-fields">
            <legend>Crop %</legend>
            <div className="component-fields">
              <NumberField
                label="Left"
                value={part.crop.x / 10}
                min={0}
                max={99}
                onChange={(value) => trim("left", value)}
              />
              <NumberField
                label="Right"
                value={(1000 - part.crop.x - part.crop.width) / 10}
                min={0}
                max={99}
                onChange={(value) => trim("right", value)}
              />
              <NumberField
                label="Top"
                value={part.crop.y / 10}
                min={0}
                max={99}
                onChange={(value) => trim("top", value)}
              />
              <NumberField
                label="Bottom"
                value={(1000 - part.crop.y - part.crop.height) / 10}
                min={0}
                max={99}
                onChange={(value) => trim("bottom", value)}
              />
            </div>
            <button
              className="quiet"
              disabled={!isCropped(part)}
              onClick={() =>
                c.updatePart({
                  ...part,
                  crop: { x: 0, y: 0, width: 1000, height: 1000 },
                })
              }
            >
              Reset crop
            </button>
          </fieldset>
          <div className="component-actions">
            <button
              onClick={c.duplicate}
              disabled={c.document.parts.length >= 100}
            >
              Duplicate
            </button>
            <button onClick={c.remove}>Remove</button>
            <button
              disabled={selection === c.document.parts.length - 1}
              onClick={() => c.reorder(1)}
            >
              Bring forward
            </button>
            <button disabled={selection === 0} onClick={() => c.reorder(-1)}>
              Send backward
            </button>
          </div>
        </>
      ) : (
        <p>Select a component to resize or crop it.</p>
      )}
    </section>
  );
}
