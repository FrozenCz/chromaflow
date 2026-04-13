import { describe, expect, it } from 'vitest';
import {
  GRID_PADDING,
  GridMetrics,
  createGridMetrics,
  getCanvasSize,
  getCellSize,
  gridToPixel,
  pixelToGrid,
} from './grid';

function metrics(cellSize: number, width: number, height: number, padding = 0): GridMetrics {
  return { cellSize, padding, width, height };
}

describe('getCellSize', () => {
  it('returns desktop cell size for >=1024 viewport', () => {
    expect(getCellSize(1280, 5, 5)).toBe(64);
    expect(getCellSize(1024, 9, 9)).toBe(64);
  });

  it('returns tablet cell size for >=640 viewport', () => {
    expect(getCellSize(768, 7, 7)).toBe(52);
    expect(getCellSize(640, 5, 5)).toBe(52);
  });

  it('adapts mobile cell size to viewport and grid size', () => {
    const size = getCellSize(400, 5, 5, 400, GRID_PADDING);
    expect(size).toBeGreaterThanOrEqual(28);
    expect(size).toBeLessThanOrEqual(56);
  });

  it('clamps mobile cell size to the minimum when viewport is tiny', () => {
    expect(getCellSize(200, 9, 9, 200)).toBe(28);
  });

  it('clamps mobile cell size to the maximum when viewport is generous', () => {
    expect(getCellSize(639, 5, 5, 639)).toBe(56);
  });
});

describe('gridToPixel', () => {
  it('returns the center of the addressed cell', () => {
    const m = metrics(64, 5, 5, 8);
    expect(gridToPixel({ row: 0, col: 0 }, m)).toEqual({ x: 40, y: 40 });
    expect(gridToPixel({ row: 2, col: 3 }, m)).toEqual({ x: 8 + 3 * 64 + 32, y: 8 + 2 * 64 + 32 });
  });
});

describe('pixelToGrid', () => {
  const m = metrics(40, 5, 5, 10);

  it('round-trips with gridToPixel for in-bounds cells', () => {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const { x, y } = gridToPixel({ row, col }, m);
        expect(pixelToGrid(x, y, m)).toEqual({ row, col });
      }
    }
  });

  it('returns null for out-of-bounds coordinates', () => {
    expect(pixelToGrid(0, 0, m)).toBeNull();
    expect(pixelToGrid(9999, 9999, m)).toBeNull();
    expect(pixelToGrid(-50, 50, m)).toBeNull();
  });
});

describe('createGridMetrics + getCanvasSize', () => {
  it('computes canvas size including padding', () => {
    const m = createGridMetrics(1280, 5, 5);
    const { width, height } = getCanvasSize(m);
    expect(width).toBe(5 * 64 + 2 * m.padding);
    expect(height).toBe(5 * 64 + 2 * m.padding);
  });
});
