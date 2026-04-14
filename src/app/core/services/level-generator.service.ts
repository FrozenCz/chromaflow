import { Injectable } from '@angular/core';
import {
  Endpoint,
  FLOW_COLORS,
  Level,
  PathSolution,
  PortalPair,
  Position,
} from '../models';

/**
 * Minimum grid dimension (width AND height) required for the generator to
 * place a portal pair. Smaller boards are typically fully covered by short
 * solution segments and would not benefit from optional portal shortcuts.
 */
const PORTAL_MIN_DIMENSION = 5;

/** Options accepted by {@link LevelGeneratorService.generate}. */
export interface LevelGeneratorOptions {
  id: string;
  name?: string;
  width: number;
  height: number;
  numColors: number;
  seed: number;
}

/**
 * Generates a guaranteed-solvable Flow level using a "solution-first" approach:
 *
 * 1. Build a Hamiltonian path that visits every cell of the grid exactly once
 *    (a randomly oriented boustrophedon / snake fill). Because the grid is a
 *    simple rectangle without walls this is always possible.
 * 2. Split the Hamiltonian path into `numColors` contiguous segments. Splitting
 *    a single Hamiltonian path into contiguous pieces guarantees each segment
 *    is internally 4-connected, segments are disjoint and together they cover
 *    every cell.
 * 3. Derive endpoints from the first and last cell of every segment.
 *
 * The output therefore always satisfies the runtime validation enforced by
 * {@link LevelLoaderService}: adjacency, full coverage, no overlap and
 * matching endpoints.
 */
@Injectable({ providedIn: 'root' })
export class LevelGeneratorService {
  /** Generate a level. The same options always produce the same level. */
  generate(options: LevelGeneratorOptions): Level {
    const { id, width, height, numColors, seed } = options;

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error(`generate: width must be a positive integer, got ${width}.`);
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error(`generate: height must be a positive integer, got ${height}.`);
    }
    if (!Number.isInteger(numColors) || numColors < 1) {
      throw new Error(`generate: numColors must be >= 1, got ${numColors}.`);
    }
    const totalCells = width * height;
    if (numColors > FLOW_COLORS.length) {
      throw new Error(
        `generate: numColors ${numColors} exceeds palette size ${FLOW_COLORS.length}.`,
      );
    }
    // Each color needs at least 2 cells (two endpoints) → minimum length 2.
    if (numColors * 2 > totalCells) {
      throw new Error(
        `generate: cannot place ${numColors} colors on a ${width}x${height} grid (need >= ${
          numColors * 2
        } cells).`,
      );
    }

    const rng = mulberry32(seed >>> 0);

    // Step 1: build a Hamiltonian path (snake fill) with a random orientation
    // so that different seeds produce visibly different layouts.
    const orientation = Math.floor(rng() * 4);
    const hamiltonian = buildSnakePath(width, height, orientation);

    // Step 2: pick `numColors - 1` random split points to cut the path into
    // contiguous segments. Each segment must contain at least 2 cells.
    const splitPoints = pickSplitPoints(totalCells, numColors, rng);

    // Step 3: materialize segments and derive endpoints.
    const solution: PathSolution[] = [];
    const endpoints: Endpoint[] = [];
    let cursor = 0;
    for (let i = 0; i < numColors; i++) {
      const end = splitPoints[i];
      const segment = hamiltonian.slice(cursor, end).map(clonePos);
      cursor = end;
      const color = FLOW_COLORS[i];
      solution.push({ color, path: segment });
      endpoints.push({ color, position: clonePos(segment[0]) });
      endpoints.push({ color, position: clonePos(segment[segment.length - 1]) });
    }

    // Step 4: optionally place a portal pair on two non-endpoint cells so the
    // "Quick Game" player can actually encounter portals in the generated
    // levels. Portals are deliberately placed on cells that are already part
    // of a solution path — the reference solution walks those cells with
    // plain adjacency (the engine only auto-teleports on non-adjacent moves),
    // so the level remains solvable without ever using the portal. Using the
    // portal is therefore purely optional.
    const portals = pickPortalPair(width, height, endpoints, rng, id);

    return {
      id,
      name: options.name ?? id,
      width,
      height,
      endpoints,
      portals,
      colorChangers: [],
      walls: [],
      solution,
      par: numColors,
    };
  }
}

// -------------------- helpers --------------------

/**
 * Mulberry32: tiny deterministic 32-bit PRNG. Public domain.
 * Returns a function that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a boustrophedon (snake) Hamiltonian path covering every cell of a
 * rectangular grid. `orientation` (0..3) chooses one of four equivalent
 * starting corners / scan directions so that different seeds produce visibly
 * different layouts.
 */
function buildSnakePath(width: number, height: number, orientation: number): Position[] {
  const cells: Position[] = [];
  const rowMajor = (orientation & 1) === 0;
  const flipPrimary = (orientation & 2) !== 0;

  if (rowMajor) {
    for (let r = 0; r < height; r++) {
      const row = flipPrimary ? height - 1 - r : r;
      const reverse = r % 2 === 1;
      for (let c = 0; c < width; c++) {
        const col = reverse ? width - 1 - c : c;
        cells.push({ row, col });
      }
    }
  } else {
    for (let c = 0; c < width; c++) {
      const col = flipPrimary ? width - 1 - c : c;
      const reverse = c % 2 === 1;
      for (let r = 0; r < height; r++) {
        const row = reverse ? height - 1 - r : r;
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

/**
 * Pick `numColors - 1` cut indices (each >= 2 cells from previous, leaving at
 * least 2 cells for the remainder) that split a path of `total` cells into
 * `numColors` contiguous non-empty segments.
 *
 * Returned array contains the **end-exclusive** index of each segment, so
 * `segment_i = path.slice(prevEnd, splitPoints[i])`. The final entry is
 * always `total`.
 */
function pickSplitPoints(total: number, numColors: number, rng: () => number): number[] {
  if (numColors === 1) return [total];

  const minSegment = 2;
  // Allocate the mandatory `minSegment` cells per color first; distribute the
  // remaining "slack" cells randomly across the segments.
  const slack = total - numColors * minSegment;
  if (slack < 0) {
    throw new Error('pickSplitPoints: not enough cells to satisfy minimum segment length.');
  }

  const extras = new Array<number>(numColors).fill(0);
  for (let i = 0; i < slack; i++) {
    const bucket = Math.floor(rng() * numColors);
    extras[bucket] += 1;
  }

  const ends: number[] = [];
  let acc = 0;
  for (let i = 0; i < numColors; i++) {
    acc += minSegment + extras[i];
    ends.push(acc);
  }
  // Numerical safety: guarantee the last index exactly equals `total`.
  ends[ends.length - 1] = total;
  return ends;
}

function clonePos(p: Position): Position {
  return { row: p.row, col: p.col };
}

/**
 * Deterministically pick a single portal pair on a generated level.
 *
 * Rules:
 * - Both grid dimensions must be >= {@link PORTAL_MIN_DIMENSION}; smaller
 *   boards skip portals entirely and return an empty array.
 * - Neither portal cell may coincide with a level endpoint.
 * - The two portal cells must be at different positions AND must not be
 *   4-adjacent to each other, otherwise the portal would be indistinguishable
 *   from a plain step.
 *
 * The picker iterates the RNG up to a small cap; if no valid pair is found
 * it falls back to an empty array so that generation never fails due to
 * optional portal placement.
 */
function pickPortalPair(
  width: number,
  height: number,
  endpoints: Endpoint[],
  rng: () => number,
  levelId: string,
): PortalPair[] {
  if (width < PORTAL_MIN_DIMENSION || height < PORTAL_MIN_DIMENSION) {
    return [];
  }
  const endpointKeys = new Set(endpoints.map((e) => `${e.position.row},${e.position.col}`));
  const candidates: Position[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!endpointKeys.has(`${r},${c}`)) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  if (candidates.length < 2) {
    return [];
  }

  // Deterministic Fisher-Yates on a copy; take the first valid pair whose
  // cells are not 4-adjacent. Bounded scan guarantees termination.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const a = shuffled[i];
      const b = shuffled[j];
      const manhattan = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
      if (manhattan >= 2) {
        return [
          {
            id: `${levelId}-portal-1`,
            a: clonePos(a),
            b: clonePos(b),
          },
        ];
      }
    }
  }
  return [];
}
