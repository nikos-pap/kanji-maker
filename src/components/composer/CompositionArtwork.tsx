import type { ComponentPart } from "../../lib/composition";

export const partTransform = (part: ComponentPart) =>
  `translate(${part.x} ${part.y}) scale(${part.width / 1000} ${part.height / 1000})`;
export function ComponentArtwork({
  part,
  prefix,
}: {
  part: ComponentPart;
  prefix: string;
}) {
  const id = `${prefix}-${part.id}`;
  return (
    <g transform={partTransform(part)}>
      <defs>
        <clipPath id={id} clipPathUnits="userSpaceOnUse">
          <rect {...part.crop} />
        </clipPath>
      </defs>
      <path d={part.path} fill="#000" clipPath={`url(#${id})`} />
    </g>
  );
}
export function CompositionArtwork({
  parts,
  prefix,
}: {
  parts: ComponentPart[];
  prefix: string;
}) {
  return (
    <>
      {parts.map((part) => (
        <ComponentArtwork key={part.id} part={part} prefix={prefix} />
      ))}
    </>
  );
}
