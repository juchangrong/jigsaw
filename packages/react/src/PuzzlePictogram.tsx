import { generatePictogram, pieceOutline, vectorPlacement, type Seed } from "@jigsaw/core";
import { useMemo, type CSSProperties } from "react";

export interface PuzzlePictogramProps {
  seed: Seed;
  /** CSS pixel size (default 24) */
  size?: number;
  /** `filled`: the geometric pictogram. `outline`: the realistic piece drawn as a line. */
  variant?: "filled" | "outline";
  /** fill, or line colour of an outline (default currentColor) */
  color?: string;
  /** line width in px for `outline` (default 1.1) */
  strokeWidth?: number;
  /** fills a rounded tile behind the shape */
  background?: string;
  /** tile corner radius as a fraction of its side (default 0.25) */
  radius?: number;
  /** shape size relative to the tile (default 0.8 with a background, else 1) */
  scale?: number;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/**
 * `<PuzzlePictogram seed="alpha" size={24} color="#607D9B" />`
 *
 * A puzzle piece as inline SVG: no canvas and no GPU, so it is cheap in long
 * lists and stays sharp at any size.
 */
export function PuzzlePictogram({ seed, size = 24, variant = "filled", color = "currentColor", strokeWidth = 1.1, background, radius, scale, className, style, title }: PuzzlePictogramProps) {
  const shape = useMemo(() => (variant === "outline" ? pieceOutline({ seed }) : generatePictogram(seed)), [seed, variant]);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  const mark =
    variant === "outline" ? (
      <path d={shape.path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    ) : (
      <path d={shape.path} fill={color} />
    );
  if (!background) {
    return (
      <svg className={className} style={style} width={size} height={size} viewBox={shape.viewBox} {...a11y}>
        {mark}
      </svg>
    );
  }
  const place = vectorPlacement({ background, radius, scale });
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 1 1" {...a11y}>
      <rect width={1} height={1} rx={place.radius} fill={background} />
      <svg x={place.offset} y={place.offset} width={place.scale} height={place.scale} viewBox={shape.viewBox}>
        {mark}
      </svg>
    </svg>
  );
}
