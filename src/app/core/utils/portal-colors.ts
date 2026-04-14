/**
 * Deterministic color palette for portal pairs. Each pair is rendered in a
 * stable color derived from its `id` so the two endpoints of a single pair
 * always match visually.
 */
export const PORTAL_COLORS: readonly string[] = [
  '#b46bff',
  '#00d4ff',
  '#ffb400',
  '#ff4fa8',
  '#7cff6b',
  '#ff6b6b',
];

/** Simple deterministic string hash (FNV-1a-ish, 32-bit). */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Return a stable color for the given portal pair id. Same id always yields
 * the same color; different ids are spread across the palette.
 */
export function portalColorFor(id: string): string {
  const idx = hashString(id) % PORTAL_COLORS.length;
  return PORTAL_COLORS[idx];
}
