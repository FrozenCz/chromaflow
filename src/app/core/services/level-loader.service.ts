import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Endpoint,
  FLOW_COLORS,
  FlowColor,
  Level,
  PathSolution,
  Position,
  World,
  WorldMetadata,
} from '../models';
import {
  LevelGeneratorOptions,
  LevelGeneratorService,
} from './level-generator.service';

/**
 * Service that loads JSON world definitions from `public/data/levels/<worldId>.json`,
 * validates their structure at runtime and caches successful fetches.
 */
@Injectable({ providedIn: 'root' })
export class LevelLoaderService {
  private readonly http = inject(HttpClient);
  private readonly generator = inject(LevelGeneratorService);
  private readonly worldCache = new Map<string, Observable<World>>();

  /**
   * Procedurally generate a guaranteed-solvable level using the
   * solution-first {@link LevelGeneratorService}. The result is re-validated
   * with {@link validateLevel} so that any future regression in the generator
   * surfaces immediately rather than producing an unsolvable level for the
   * player.
   */
  generateLevel(options: LevelGeneratorOptions): Level {
    const level = this.generator.generate(options);
    // Re-validate via the same path used for JSON-loaded worlds. This guards
    // against accidental drift between generator and loader contracts.
    return this.validateLevel(level, 0);
  }

  /**
   * Load a world by id (cache-first). Returns a shared observable so that
   * concurrent callers reuse the in-flight request and subsequent subscribers
   * receive the cached world without issuing another HTTP request.
   */
  loadWorld(worldId: string): Observable<World> {
    const cached = this.worldCache.get(worldId);
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<unknown>(`/data/levels/${worldId}.json`).pipe(
      map((raw) => this.validateWorld(raw)),
      shareReplay({ bufferSize: 1, refCount: false }),
      catchError((err: unknown) => {
        // Evict failed request so a retry can re-fetch.
        this.worldCache.delete(worldId);
        return throwError(() => err);
      }),
    );

    this.worldCache.set(worldId, request$);
    return request$;
  }

  /**
   * Load a single level by id (format `w<N>-l<M>`). Extracts the world id,
   * loads the world and returns the matching level.
   */
  loadLevel(levelId: string): Observable<Level> {
    const match = /^w(\d+)-l\d+$/.exec(levelId);
    if (!match) {
      return throwError(
        () => new Error(`Invalid levelId "${levelId}": expected format "w<N>-l<M>".`),
      );
    }
    const worldId = `world${match[1]}`;
    return this.loadWorld(worldId).pipe(
      map((world) => {
        const level = world.levels.find((l) => l.id === levelId);
        if (!level) {
          throw new Error(`Level "${levelId}" not found in world "${worldId}".`);
        }
        return level;
      }),
    );
  }

  /** Clear all cached worlds (useful for tests and hot-reload scenarios). */
  clearCache(): void {
    this.worldCache.clear();
  }

  /**
   * Runtime validation for raw world JSON. Throws a descriptive Error on any
   * shape, solution or adjacency violation.
   */
  validateWorld(raw: unknown): World {
    if (!isRecord(raw)) {
      throw new Error('World JSON must be an object.');
    }
    const metadata = this.validateMetadata(raw['metadata']);
    const levelsRaw = raw['levels'];
    if (!Array.isArray(levelsRaw)) {
      throw new Error('World JSON must contain a "levels" array.');
    }
    const levels = levelsRaw.map((lvl, idx) => this.validateLevel(lvl, idx));
    return { metadata, levels };
  }

  // ----- private helpers -----

  private validateMetadata(raw: unknown): WorldMetadata {
    if (!isRecord(raw)) {
      throw new Error('World metadata must be an object.');
    }
    const id = raw['id'];
    const name = raw['name'];
    const order = raw['order'];
    const description = raw['description'];
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('metadata.id must be a non-empty string.');
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('metadata.name must be a non-empty string.');
    }
    if (typeof order !== 'number' || !Number.isInteger(order)) {
      throw new Error('metadata.order must be an integer.');
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new Error('metadata.description must be a string when provided.');
    }
    return {
      id,
      name,
      order,
      ...(typeof description === 'string' ? { description } : {}),
    };
  }

  private validateLevel(raw: unknown, index: number): Level {
    if (!isRecord(raw)) {
      throw new Error(`Level[${index}] must be an object.`);
    }
    const id = raw['id'];
    const name = raw['name'];
    const width = raw['width'];
    const height = raw['height'];
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`Level[${index}].id must be a non-empty string.`);
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Level "${id}".name must be a non-empty string.`);
    }
    if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
      throw new Error(`Level "${id}".width must be a positive integer.`);
    }
    if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) {
      throw new Error(`Level "${id}".height must be a positive integer.`);
    }

    const walls = this.validateWalls(raw['walls'], id, width, height);
    const endpoints = this.validateEndpoints(raw['endpoints'], id, width, height, walls);
    const solution = this.validateSolution(raw['solution'], id, width, height, walls, endpoints);

    const par = raw['par'];
    const expectedPar = solution.length;
    if (typeof par !== 'number' || !Number.isInteger(par) || par !== expectedPar) {
      throw new Error(
        `Level "${id}".par must equal the number of colors (${expectedPar}), got ${String(par)}.`,
      );
    }

    return {
      id,
      name,
      width,
      height,
      endpoints,
      portals: [],
      colorChangers: [],
      walls,
      solution,
      par,
    };
  }

  private validateWalls(
    raw: unknown,
    levelId: string,
    width: number,
    height: number,
  ): Position[] {
    if (raw === undefined) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new Error(`Level "${levelId}".walls must be an array when provided.`);
    }
    return raw.map((w, i) => {
      const pos = toPosition(w, `Level "${levelId}".walls[${i}]`);
      if (!inBounds(pos, width, height)) {
        throw new Error(
          `Level "${levelId}".walls[${i}] out of bounds (${pos.row},${pos.col}).`,
        );
      }
      return pos;
    });
  }

  private validateEndpoints(
    raw: unknown,
    levelId: string,
    width: number,
    height: number,
    walls: Position[],
  ): Endpoint[] {
    if (!Array.isArray(raw)) {
      throw new Error(`Level "${levelId}".endpoints must be an array.`);
    }
    const endpoints: Endpoint[] = raw.map((e, i) => {
      if (!isRecord(e)) {
        throw new Error(`Level "${levelId}".endpoints[${i}] must be an object.`);
      }
      const color = e['color'];
      if (!isFlowColor(color)) {
        throw new Error(
          `Level "${levelId}".endpoints[${i}].color must be one of ${FLOW_COLORS.join(',')}.`,
        );
      }
      const position = toPosition(e['position'], `Level "${levelId}".endpoints[${i}].position`);
      if (!inBounds(position, width, height)) {
        throw new Error(
          `Level "${levelId}".endpoints[${i}] out of bounds (${position.row},${position.col}).`,
        );
      }
      if (walls.some((w) => samePos(w, position))) {
        throw new Error(
          `Level "${levelId}".endpoints[${i}] overlaps wall at (${position.row},${position.col}).`,
        );
      }
      return { color, position };
    });

    // Each color must have exactly 2 endpoints.
    const counts = new Map<FlowColor, number>();
    for (const ep of endpoints) {
      counts.set(ep.color, (counts.get(ep.color) ?? 0) + 1);
    }
    for (const [color, count] of counts) {
      if (count !== 2) {
        throw new Error(
          `Level "${levelId}" color "${color}" must have exactly 2 endpoints, found ${count}.`,
        );
      }
    }

    // No two endpoints on the same cell.
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        if (samePos(endpoints[i].position, endpoints[j].position)) {
          throw new Error(
            `Level "${levelId}" endpoints overlap at (${endpoints[i].position.row},${endpoints[i].position.col}).`,
          );
        }
      }
    }

    return endpoints;
  }

  private validateSolution(
    raw: unknown,
    levelId: string,
    width: number,
    height: number,
    walls: Position[],
    endpoints: Endpoint[],
  ): PathSolution[] {
    if (!Array.isArray(raw)) {
      throw new Error(`Level "${levelId}".solution must be an array.`);
    }
    const solution: PathSolution[] = raw.map((s, i) => {
      if (!isRecord(s)) {
        throw new Error(`Level "${levelId}".solution[${i}] must be an object.`);
      }
      const color = s['color'];
      if (!isFlowColor(color)) {
        throw new Error(`Level "${levelId}".solution[${i}].color invalid.`);
      }
      const pathRaw = s['path'];
      if (!Array.isArray(pathRaw) || pathRaw.length < 2) {
        throw new Error(
          `Level "${levelId}".solution[${i}].path must contain at least 2 positions.`,
        );
      }
      const path: Position[] = pathRaw.map((p, j) => {
        const pos = toPosition(p, `Level "${levelId}".solution[${i}].path[${j}]`);
        if (!inBounds(pos, width, height)) {
          throw new Error(
            `Level "${levelId}".solution[${i}].path[${j}] out of bounds (${pos.row},${pos.col}).`,
          );
        }
        if (walls.some((w) => samePos(w, pos))) {
          throw new Error(
            `Level "${levelId}".solution[${i}].path[${j}] overlaps wall at (${pos.row},${pos.col}).`,
          );
        }
        return pos;
      });

      // Adjacent path steps must be 4-connected (|dx|+|dy|=1, no diagonals).
      for (let k = 1; k < path.length; k++) {
        const dr = Math.abs(path[k].row - path[k - 1].row);
        const dc = Math.abs(path[k].col - path[k - 1].col);
        if (dr + dc !== 1) {
          throw new Error(
            `Level "${levelId}".solution[${i}] non-adjacent step between (${path[k - 1].row},${path[k - 1].col}) and (${path[k].row},${path[k].col}).`,
          );
        }
      }
      return { color, path };
    });

    // Each solution color must match an endpoint-pair; first/last must be that pair.
    const solutionColors = new Set<FlowColor>();
    for (const seg of solution) {
      if (solutionColors.has(seg.color)) {
        throw new Error(`Level "${levelId}".solution has duplicate color "${seg.color}".`);
      }
      solutionColors.add(seg.color);
      const colorEndpoints = endpoints.filter((e) => e.color === seg.color);
      if (colorEndpoints.length !== 2) {
        throw new Error(
          `Level "${levelId}".solution color "${seg.color}" has no matching endpoint pair.`,
        );
      }
      const first = seg.path[0];
      const last = seg.path[seg.path.length - 1];
      const [a, b] = colorEndpoints;
      const matches =
        (samePos(first, a.position) && samePos(last, b.position)) ||
        (samePos(first, b.position) && samePos(last, a.position));
      if (!matches) {
        throw new Error(
          `Level "${levelId}".solution color "${seg.color}" endpoints do not match path ends.`,
        );
      }
    }

    // All endpoint colors must appear in solution.
    const endpointColors = new Set<FlowColor>(endpoints.map((e) => e.color));
    for (const c of endpointColors) {
      if (!solutionColors.has(c)) {
        throw new Error(`Level "${levelId}".solution missing color "${c}".`);
      }
    }

    // No overlap between path cells; cover all non-wall cells exactly once.
    const seen = new Set<string>();
    for (const seg of solution) {
      for (const cell of seg.path) {
        const key = `${cell.row},${cell.col}`;
        if (seen.has(key)) {
          throw new Error(
            `Level "${levelId}".solution paths overlap at (${cell.row},${cell.col}).`,
          );
        }
        seen.add(key);
      }
    }

    const totalPlayable = width * height - walls.length;
    if (seen.size !== totalPlayable) {
      throw new Error(
        `Level "${levelId}".solution covers ${seen.size}/${totalPlayable} playable cells.`,
      );
    }

    return solution;
  }
}

// ----- module-private helpers -----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlowColor(value: unknown): value is FlowColor {
  return typeof value === 'string' && (FLOW_COLORS as readonly string[]).includes(value);
}

function toPosition(value: unknown, label: string): Position {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object with row and col.`);
  }
  const row = value['row'];
  const col = value['col'];
  if (typeof row !== 'number' || !Number.isInteger(row)) {
    throw new Error(`${label}.row must be an integer.`);
  }
  if (typeof col !== 'number' || !Number.isInteger(col)) {
    throw new Error(`${label}.col must be an integer.`);
  }
  return { row, col };
}

function inBounds(pos: Position, width: number, height: number): boolean {
  return pos.row >= 0 && pos.row < height && pos.col >= 0 && pos.col < width;
}

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

