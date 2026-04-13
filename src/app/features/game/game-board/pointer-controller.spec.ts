import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Level } from '../../../core/models';
import { GameEngineService } from '../../../core/services/game-engine.service';
import { GridMetrics } from '../../../core/utils';
import { PointerController, PointerRect } from './pointer-controller';

const RECT: PointerRect = { left: 0, top: 0 };

// GridMetrics for a 3x3 grid, cellSize 40, padding 0 -> grid occupies 120x120.
const METRICS: GridMetrics = { cellSize: 40, padding: 0, width: 3, height: 3 };

// Pixel center of (row, col).
function center(row: number, col: number): { x: number; y: number } {
  return {
    x: METRICS.padding + col * METRICS.cellSize + METRICS.cellSize / 2,
    y: METRICS.padding + row * METRICS.cellSize + METRICS.cellSize / 2,
  };
}

// 3x3 level with a Red pair at (0,0)-(0,2) and a Blue pair at (2,0)-(2,2).
function makeLevel(): Level {
  return {
    id: 'test-3x3',
    name: '3x3',
    width: 3,
    height: 3,
    endpoints: [
      { position: { row: 0, col: 0 }, color: 'R' },
      { position: { row: 0, col: 2 }, color: 'R' },
      { position: { row: 2, col: 0 }, color: 'B' },
      { position: { row: 2, col: 2 }, color: 'B' },
    ],
    portals: [],
    colorChangers: [],
  };
}

describe('PointerController', () => {
  let engine: GameEngineService;
  let controller: PointerController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(GameEngineService);
    engine.initLevel(makeLevel());
    controller = new PointerController(engine);
  });

  it('onDown outside grid returns null and does not start drawing', () => {
    const result = controller.onDown(-50, -50, RECT, METRICS);
    expect(result).toBeNull();
    expect(engine.drawing().isDrawing).toBe(false);
  });

  it('onDown on an endpoint starts drawing with a single-cell path', () => {
    const p = center(0, 0);
    const result = controller.onDown(p.x, p.y, RECT, METRICS);
    expect(result).toEqual({ row: 0, col: 0 });
    expect(engine.drawing().isDrawing).toBe(true);
    expect(engine.drawing().currentPath).toHaveLength(1);
    expect(engine.drawing().currentColor).toBe('R');
  });

  it('onMove to an adjacent free cell extends the path', () => {
    const start = center(0, 0);
    controller.onDown(start.x, start.y, RECT, METRICS);
    const next = center(0, 1);
    const result = controller.onMove(next.x, next.y, RECT, METRICS);
    expect(result).toEqual({ row: 0, col: 1 });
    expect(engine.drawing().currentPath).toHaveLength(2);
  });

  it('onMove back to the second-to-last cell backtracks the path', () => {
    const start = center(0, 0);
    controller.onDown(start.x, start.y, RECT, METRICS);
    const next = center(0, 1);
    controller.onMove(next.x, next.y, RECT, METRICS);
    expect(engine.drawing().currentPath).toHaveLength(2);

    const back = center(0, 0);
    controller.onMove(back.x, back.y, RECT, METRICS);
    expect(engine.drawing().currentPath).toHaveLength(1);
    expect(engine.drawing().currentPath[0]).toEqual({ row: 0, col: 0 });
  });

  it('onUp finalizes the drawing and stores the path on the engine', () => {
    const start = center(0, 0);
    controller.onDown(start.x, start.y, RECT, METRICS);
    const mid = center(0, 1);
    controller.onMove(mid.x, mid.y, RECT, METRICS);
    controller.onUp();

    expect(engine.drawing().isDrawing).toBe(false);
    const red = engine.paths().find((p) => p.color === 'R');
    expect(red).toBeDefined();
    expect(red?.path).toHaveLength(2);
  });

  it('onUp without active drawing is a no-op', () => {
    expect(() => controller.onUp()).not.toThrow();
    expect(engine.drawing().isDrawing).toBe(false);
  });

  it('drawing over another color path trims (splits) the crossed path', () => {
    // First, draw a Blue path from (2,0) through (1,0) to (1,1).
    controller.onDown(center(2, 0).x, center(2, 0).y, RECT, METRICS);
    controller.onMove(center(1, 0).x, center(1, 0).y, RECT, METRICS);
    controller.onMove(center(1, 1).x, center(1, 1).y, RECT, METRICS);
    controller.onUp();
    const blueBefore = engine.paths().find((p) => p.color === 'B');
    expect(blueBefore?.path).toHaveLength(3);

    // Now start Red from (0,0) and cross through (1,0) — a Blue cell.
    controller.onDown(center(0, 0).x, center(0, 0).y, RECT, METRICS);
    controller.onMove(center(1, 0).x, center(1, 0).y, RECT, METRICS);

    const blueAfter = engine.paths().find((p) => p.color === 'B');
    // Blue trimmed before (1,0) -> only (2,0) remains (index 0..idx excluded).
    expect(blueAfter?.path).toHaveLength(1);
    expect(blueAfter?.path[0]).toEqual({ row: 2, col: 0 });
    expect(engine.drawing().currentPath).toHaveLength(2);
  });

  it('onMove outside grid while drawing keeps the last cell as fallback', () => {
    const start = center(0, 0);
    controller.onDown(start.x, start.y, RECT, METRICS);
    const result = controller.onMove(-100, -100, RECT, METRICS);
    expect(result).toEqual({ row: 0, col: 0 });
    expect(engine.drawing().isDrawing).toBe(true);
  });
});
