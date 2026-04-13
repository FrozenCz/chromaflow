import { Injectable, computed, signal } from '@angular/core';
import {
  DrawingState,
  Endpoint,
  FlowColor,
  Level,
  PathSolution,
  Position,
} from '../models';

interface EngineState {
  level: Level | null;
  paths: PathSolution[];
  drawing: DrawingState;
  moves: number;
  startedAt: number;
}

const EMPTY_DRAWING: DrawingState = {
  isDrawing: false,
  currentColor: null,
  currentPath: [],
  startEndpoint: null,
};

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function clonePos(p: Position): Position {
  return { row: p.row, col: p.col };
}

@Injectable({ providedIn: 'root' })
export class GameEngineService {
  private readonly state = signal<EngineState>({
    level: null,
    paths: [],
    drawing: { ...EMPTY_DRAWING, currentPath: [] },
    moves: 0,
    startedAt: Date.now(),
  });

  readonly level = computed(() => this.state().level);
  readonly paths = computed(() => this.state().paths);
  readonly drawing = computed(() => this.state().drawing);
  readonly moveCount = computed(() => this.state().moves);

  readonly fillPercentage = computed(() => {
    const s = this.state();
    const level = s.level;
    if (!level) return 0;
    const total = this.totalPlayableCells(level);
    if (total === 0) return 0;
    const occupied = new Set<string>();
    for (const p of s.paths) {
      for (const pos of p.path) {
        occupied.add(this.key(pos));
      }
    }
    for (const pos of s.drawing.currentPath) {
      occupied.add(this.key(pos));
    }
    return Math.round((occupied.size / total) * 100);
  });

  readonly isWon = computed(() => {
    const s = this.state();
    const level = s.level;
    if (!level) return false;
    return this.checkWinFor(level, s.paths);
  });

  initLevel(level: Level): void {
    this.state.set({
      level,
      paths: [],
      drawing: { ...EMPTY_DRAWING, currentPath: [] },
      moves: 0,
      startedAt: Date.now(),
    });
  }

  startDraw(pos: Position): void {
    const s = this.state();
    const level = s.level;
    if (!level) return;
    if (!this.inBounds(level, pos)) return;
    if (this.isWall(level, pos)) return;

    // Start from endpoint
    const endpoint = level.endpoints.find((e) => samePos(e.position, pos));
    if (endpoint) {
      // Remove any existing path of that color (restart)
      const paths = s.paths.filter((p) => p.color !== endpoint.color);
      this.state.set({
        ...s,
        paths,
        drawing: {
          isDrawing: true,
          currentColor: endpoint.color,
          currentPath: [clonePos(pos)],
          startEndpoint: endpoint,
        },
      });
      return;
    }

    // Start from end of an existing (non-completed) path
    const existing = s.paths.find(
      (p) => p.path.length > 0 && samePos(p.path[p.path.length - 1], pos),
    );
    if (existing) {
      const startEndpoint =
        level.endpoints.find(
          (e) => e.color === existing.color && samePos(e.position, existing.path[0]),
        ) ?? null;
      const paths = s.paths.filter((p) => p.color !== existing.color);
      this.state.set({
        ...s,
        paths,
        drawing: {
          isDrawing: true,
          currentColor: existing.color,
          currentPath: existing.path.map(clonePos),
          startEndpoint,
        },
      });
    }
  }

  continueDraw(pos: Position): void {
    const s = this.state();
    const level = s.level;
    if (!level) return;
    const drawing = s.drawing;
    if (!drawing.isDrawing || drawing.currentColor === null) return;
    if (drawing.currentPath.length === 0) return;

    const path = drawing.currentPath;
    const last = path[path.length - 1];
    if (samePos(last, pos)) return;

    // Backtracking: if pos is the second-to-last in current path
    if (path.length >= 2 && samePos(path[path.length - 2], pos)) {
      const newPath = path.slice(0, -1);
      this.state.set({
        ...s,
        drawing: { ...drawing, currentPath: newPath },
      });
      return;
    }

    // Can't revisit own path
    if (path.some((p) => samePos(p, pos))) return;

    if (!this.isValidMove(last, pos, drawing.currentColor)) return;

    // Split: if pos belongs to another color's path, trim that path
    let newPaths = s.paths;
    const crossing = s.paths.find((p) => p.path.some((pp) => samePos(pp, pos)));
    if (crossing) {
      if (crossing.color === drawing.currentColor) {
        // shouldn't happen since we removed it at startDraw, but guard
        return;
      }
      // Can't split a completed pair path
      if (this.isPathCompleted(level, crossing)) return;
      newPaths = s.paths.map((p) =>
        p.color === crossing.color ? this.trimPathBefore(p, pos) : p,
      );
    }

    const newPath = [...path, clonePos(pos)];
    this.state.set({
      ...s,
      paths: newPaths,
      drawing: { ...drawing, currentPath: newPath },
    });
  }

  endDraw(): void {
    const s = this.state();
    const level = s.level;
    if (!level) return;
    const drawing = s.drawing;
    if (!drawing.isDrawing || drawing.currentColor === null) {
      this.state.set({ ...s, drawing: { ...EMPTY_DRAWING, currentPath: [] } });
      return;
    }
    const color = drawing.currentColor;
    const newSolution: PathSolution = {
      color,
      path: drawing.currentPath.map(clonePos),
    };
    const paths = [...s.paths.filter((p) => p.color !== color), newSolution];
    this.state.set({
      ...s,
      paths,
      drawing: { ...EMPTY_DRAWING, currentPath: [] },
      moves: s.moves + 1,
    });
  }

  isAdjacent(a: Position, b: Position): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  isValidMove(from: Position, to: Position, color: FlowColor): boolean {
    const level = this.state().level;
    if (!level) return false;
    if (!this.inBounds(level, to)) return false;
    if (!this.isAdjacent(from, to)) return false;
    if (this.isWall(level, to)) return false;

    // Endpoint of another color is not allowed
    const endpoint = level.endpoints.find((e) => samePos(e.position, to));
    if (endpoint && endpoint.color !== color) return false;

    return true;
  }

  checkWinCondition(): boolean {
    const s = this.state();
    const level = s.level;
    if (!level) return false;
    return this.checkWinFor(level, s.paths);
  }

  clearPath(color: FlowColor): void {
    const s = this.state();
    const paths = s.paths.filter((p) => p.color !== color);
    this.state.set({ ...s, paths });
  }

  splitPathAt(color: FlowColor, pos: Position): void {
    const s = this.state();
    const target = s.paths.find((p) => p.color === color);
    if (!target) return;
    const trimmed = this.trimPathBefore(target, pos);
    const paths = s.paths.map((p) => (p.color === color ? trimmed : p));
    this.state.set({ ...s, paths });
  }

  getFillPercentage(): number {
    return this.fillPercentage();
  }

  getMoveCount(): number {
    return this.moveCount();
  }

  getElapsedTime(): number {
    return Math.floor((Date.now() - this.state().startedAt) / 1000);
  }

  // ---------- helpers ----------

  private key(p: Position): string {
    return `${p.row},${p.col}`;
  }

  private inBounds(level: Level, p: Position): boolean {
    return p.row >= 0 && p.col >= 0 && p.row < level.height && p.col < level.width;
  }

  private isWall(level: Level, p: Position): boolean {
    return (level.walls ?? []).some((w) => samePos(w, p));
  }

  private totalPlayableCells(level: Level): number {
    const walls = (level.walls ?? []).length;
    return level.width * level.height - walls;
  }

  private trimPathBefore(path: PathSolution, pos: Position): PathSolution {
    const idx = path.path.findIndex((p) => samePos(p, pos));
    if (idx < 0) return path;
    // Keep prefix up to (but excluding) pos — path no longer passes through pos
    return { color: path.color, path: path.path.slice(0, idx).map(clonePos) };
  }

  private isPathCompleted(level: Level, solution: PathSolution): boolean {
    if (solution.path.length < 2) return false;
    const first = solution.path[0];
    const last = solution.path[solution.path.length - 1];
    const endpoints = level.endpoints.filter((e) => e.color === solution.color);
    if (endpoints.length < 2) return false;
    const matchFirst = endpoints.some((e) => samePos(e.position, first));
    const matchLast = endpoints.some((e) => samePos(e.position, last));
    return matchFirst && matchLast;
  }

  private checkWinFor(level: Level, paths: PathSolution[]): boolean {
    // Group endpoints by color
    const colors = new Set<FlowColor>(level.endpoints.map((e) => e.color));
    for (const color of colors) {
      const endpoints = level.endpoints.filter((e) => e.color === color);
      if (endpoints.length < 2) return false;
      const solution = paths.find((p) => p.color === color);
      if (!solution) return false;
      if (!this.isPathCompleted(level, solution)) return false;
    }
    // 100% fill
    const total = this.totalPlayableCells(level);
    if (total === 0) return false;
    const occupied = new Set<string>();
    for (const p of paths) {
      for (const pos of p.path) {
        occupied.add(this.key(pos));
      }
    }
    return occupied.size === total;
  }

  // Exposed for testing / advanced callers
  getStartEndpoint(): Endpoint | null {
    return this.state().drawing.startEndpoint;
  }
}
