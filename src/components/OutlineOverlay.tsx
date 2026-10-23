import type { Outline, Selection } from "../types";
import { outlineText, round } from "../lib/geometry";

export function OutlineOverlay({
  data,
  selection,
  unit,
}: {
  data: Outline;
  selection: Selection | null;
  unit: number;
}) {
  const handles = data.flatMap((contour, ci) =>
    contour.flatMap((p, pi) => {
      if (!p.values.length) return [];
      const pair = p.values.length / 2 - 1,
        [x, y] = p.values.slice(-2);
      const active =
        selection?.contour === ci &&
        selection.command === pi &&
        selection.pair === pair;
      return [
        <rect
          key={`${ci}-${pi}`}
          x={x - 3.5 * unit}
          y={y - 3.5 * unit}
          width={7 * unit}
          height={7 * unit}
          className={`anchor${active ? " active-point" : ""}`}
          data-contour={ci}
          data-command={pi}
          data-pair={pair}
        >
          <title>
            Outline point: {round(x)}, {round(y)}
          </title>
        </rect>,
      ];
    }),
  );
  return (
    <g id="outlineOverlay">
      {data.map((c, ci) => (
        <path
          key={ci}
          d={outlineText([c])}
          className={`outline-hit${selection?.contour === ci ? " selected" : ""}`}
          data-contour={ci}
        />
      ))}
      {selection &&
        data[selection.contour]?.flatMap((p, pi, contour) => {
          const previous = contour[pi - 1]?.values.slice(-2),
            end = p.values.slice(-2);
          if (
            !["Q", "C"].includes(p.cmd) ||
            !previous ||
            (selection.command !== pi && selection.command !== pi - 1)
          )
            return [];
          return Array.from({ length: p.values.length / 2 - 1 }, (_, pair) => {
            const [x, y] = p.values.slice(pair * 2, pair * 2 + 2),
              root = p.cmd === "C" && pair === 1 ? end : previous;
            return (
              <g key={`${pi}-${pair}`}>
                <path
                  d={`M${root[0]} ${root[1]}L${x} ${y}`}
                  className="handle-line"
                />
                {p.cmd === "Q" && (
                  <path
                    d={`M${end[0]} ${end[1]}L${x} ${y}`}
                    className="handle-line"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={4 * unit}
                  className={`control-point${selection.command === pi && selection.pair === pair ? " active-point" : ""}`}
                  data-contour={selection.contour}
                  data-command={pi}
                  data-pair={pair}
                />
              </g>
            );
          });
        })}
      {handles}
    </g>
  );
}
