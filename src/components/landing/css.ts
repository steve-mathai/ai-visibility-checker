import type { CSSProperties } from "react";

/** Typed helper for setting custom properties in a style prop. */
export function vars(map: Record<string, string | number>): CSSProperties {
  return map as CSSProperties;
}
