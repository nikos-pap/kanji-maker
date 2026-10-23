import { useRef } from "react";
import type { PointerEvent } from "react";
import { clamp } from "../../lib/geometry";
import type { IconName } from "../Icon";

type Props = {
  label: string;
  icon: IconName;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
  sensitivity: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
};

/** Tap to reset; drag right/up to increase, left/down to decrease. */
export function DragAdjustButton({
  label,
  icon,
  value,
  valueText,
  min,
  max,
  step,
  sensitivity,
  disabled,
  onChange,
  onReset,
}: Props) {
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    value: number;
    moved: boolean;
  } | null>(null);
  const update = (next: number) =>
    onChange(
      clamp(Number((Math.round(next / step) * step).toFixed(4)), min, max),
    );
  function end(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && !start.moved) onReset();
  }
  return (
    <button
      className="drag-adjust-button"
      aria-label={label}
      aria-description={`Tap to reset. Drag right or up to increase; left or down to decrease. Current value: ${valueText}.`}
      title={`${label}: ${valueText}. Tap to reset; drag to adjust.`}
      data-value={valueText}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          value,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        event.preventDefault();
        const dx = event.clientX - start.x,
          dy = start.y - event.clientY;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        start.moved = true;
        const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        update(start.value + distance * sensitivity);
      }}
      onPointerUp={(event) => end(event)}
      onPointerCancel={(event) => end(event, true)}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onClick={(event) => {
        if (event.detail === 0) onReset();
      }}
      onKeyDown={(event) => {
        const next: Record<string, number> = {
          ArrowUp: value + step,
          ArrowRight: value + step,
          ArrowDown: value - step,
          ArrowLeft: value - step,
          Home: min,
          End: max,
          PageUp: value + step * 10,
          PageDown: value - step * 10,
        };
        if (event.key in next) {
          event.preventDefault();
          event.stopPropagation();
          update(next[event.key]);
        }
      }}
    >
      <svg
        className="adjust-value"
        viewBox="0 0 44 44"
        aria-hidden="true"
        focusable="false"
        data-shape={icon}
      >
        {icon === "round" ? (
          <circle cx="22" cy="22" r="18" />
        ) : icon === "square" ? (
          <rect x="4" y="4" width="36" height="36" rx="1" />
        ) : (
          <path d="M13 3H3v10M31 3h10v10M3 31v10h10m28-10v10H31" />
        )}
        <text x="22" y="22" dominantBaseline="central" textAnchor="middle">
          {valueText}
        </text>
      </svg>
    </button>
  );
}
