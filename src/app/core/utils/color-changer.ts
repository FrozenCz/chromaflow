import { ColorChanger, FlowColor, Level, Position } from '../models';

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

/**
 * Return the color changer located at `pos` on the given level, or null when
 * no color changer occupies that cell. Pure — does not mutate its inputs.
 */
export function colorChangerAt(level: Level, pos: Position): ColorChanger | null {
  const changers = level.colorChangers ?? [];
  for (const cc of changers) {
    if (samePos(cc.position, pos)) return cc;
  }
  return null;
}

/**
 * Apply a color changer to an incoming flow color. If the changer exists and
 * its `from` matches the current color, return the `to` color; otherwise
 * return the input color unchanged.
 */
export function transformColor(color: FlowColor, cc: ColorChanger | null): FlowColor {
  if (!cc) return color;
  return cc.from === color ? cc.to : color;
}

/**
 * Walk a path step by step, applying color changers encountered along the way.
 * Returns an array of the same length as `path` where `segments[i]` is the
 * active flow color AFTER leaving cell `path[i]` — i.e. the color of the edge
 * between `path[i]` and `path[i+1]` (or, for the last index, the final color
 * at the tail of the path).
 *
 * The start cell is treated as an entry into the grid: if `path[0]` is itself
 * a color changer that matches `startColor`, the transformation takes effect
 * immediately for the first segment.
 */
export function computePathColorSegments(
  path: Position[],
  level: Level,
  startColor: FlowColor,
): FlowColor[] {
  const out: FlowColor[] = new Array<FlowColor>(path.length);
  let active = startColor;
  for (let i = 0; i < path.length; i++) {
    active = transformColor(active, colorChangerAt(level, path[i]));
    out[i] = active;
  }
  return out;
}

/**
 * Convenience: return the final (tail) active color of a path after applying
 * all color changers along the way. If the path is empty, returns `startColor`.
 */
export function pathEndColor(
  path: Position[],
  level: Level,
  startColor: FlowColor,
): FlowColor {
  if (path.length === 0) return startColor;
  const segments = computePathColorSegments(path, level, startColor);
  return segments[segments.length - 1];
}
