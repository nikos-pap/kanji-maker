import { useRef } from "react";
import type { PointerEvent } from "react";
import { dialFraction, dialPoint } from "../../lib/dial";
import { clamp } from "../../lib/geometry";
import { Icon } from "../Icon";
import type { IconName } from "../Icon";

type Props = {
  label: string;
  icon: IconName;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};
export function ArcDial({
  label,
  icon,
  value,
  min,
  max,
  step,
  valueText,
  disabled,
  onChange,
}: Props) {
  const dragging = useRef<number | null>(null),
    fraction = (value - min) / (max - min),
    knob = dialPoint(fraction);
  const update = (next: number) =>
    onChange(
      clamp(
        Number((Math.round((next - min) / step) * step + min).toFixed(4)),
        min,
        max,
      ),
    );
  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 120,
      y: ((event.clientY - bounds.top) / bounds.height) * 88,
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const p = point(event);
    if (Math.hypot(p.x - 60, p.y - 62) >= 16)
      update(min + dialFraction(p.x, p.y) * (max - min));
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <div
      className="arc-dial"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(4))}
      aria-valuetext={valueText}
      aria-disabled={!!disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        dragging.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (!disabled && dragging.current === event.pointerId) move(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={() => {
        dragging.current = null;
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        const values: Record<string, number> = {
          ArrowLeft: value - step,
          ArrowDown: value - step,
          ArrowRight: value + step,
          ArrowUp: value + step,
          PageDown: value - 10 * step,
          PageUp: value + 10 * step,
          Home: min,
          End: max,
        };
        if (event.key in values) {
          event.preventDefault();
          event.stopPropagation();
          update(values[event.key]);
        }
      }}
    >
      <svg viewBox="0 0 120 88" aria-hidden="true" focusable="false">
        <path
          className="arc-track"
          d="M16 62a44 44 0 0 1 88 0"
          pathLength="100"
        />
        <path
          className="arc-progress"
          d="M16 62a44 44 0 0 1 88 0"
          pathLength="100"
          strokeDasharray={`${fraction * 100} 100`}
        />
        <circle className="arc-knob" cx={knob.x} cy={knob.y} r="5" />
        <Icon name={icon} x="53" y="31" width="14" height="14" />
        <text className="arc-value" x="60" y="61" textAnchor="middle">
          {valueText}
        </text>
        <text className="arc-label" x="60" y="79" textAnchor="middle">
          {label}
        </text>
      </svg>
    </div>
  );
}
