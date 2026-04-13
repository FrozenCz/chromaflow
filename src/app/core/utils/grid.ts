import { Position } from '../models';

export interface GridMetrics {
  cellSize: number;
  padding: number;
  width: number;
  height: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export const GRID_PADDING = 8;
const MOBILE_CELL_MIN = 28;
const MOBILE_CELL_MAX = 56;
const TABLET_CELL_SIZE = 52;
const DESKTOP_CELL_SIZE = 64;
const TABLET_BREAKPOINT = 640;
const DESKTOP_BREAKPOINT = 1024;

export function getCellSize(
  viewportWidth: number,
  gridWidth: number,
  gridHeight: number,
  viewportHeight: number = viewportWidth,
  padding: number = GRID_PADDING,
): number {
  if (viewportWidth >= DESKTOP_BREAKPOINT) {
    return DESKTOP_CELL_SIZE;
  }
  if (viewportWidth >= TABLET_BREAKPOINT) {
    return TABLET_CELL_SIZE;
  }
  const maxDim = Math.max(gridWidth, gridHeight);
  if (maxDim <= 0) {
    return MOBILE_CELL_MIN;
  }
  const available = Math.min(viewportWidth, viewportHeight) - 2 * padding;
  const raw = Math.floor(available / maxDim);
  return Math.max(MOBILE_CELL_MIN, Math.min(MOBILE_CELL_MAX, raw));
}

export function createGridMetrics(
  viewportWidth: number,
  gridWidth: number,
  gridHeight: number,
  viewportHeight: number = viewportWidth,
  padding: number = GRID_PADDING,
): GridMetrics {
  const cellSize = getCellSize(viewportWidth, gridWidth, gridHeight, viewportHeight, padding);
  return { cellSize, padding, width: gridWidth, height: gridHeight };
}

export function gridToPixel(pos: Position, metrics: GridMetrics): PixelCoord {
  return {
    x: metrics.padding + pos.col * metrics.cellSize + metrics.cellSize / 2,
    y: metrics.padding + pos.row * metrics.cellSize + metrics.cellSize / 2,
  };
}

export function pixelToGrid(x: number, y: number, metrics: GridMetrics): Position | null {
  const col = Math.floor((x - metrics.padding) / metrics.cellSize);
  const row = Math.floor((y - metrics.padding) / metrics.cellSize);
  if (row < 0 || col < 0 || row >= metrics.height || col >= metrics.width) {
    return null;
  }
  return { row, col };
}

export function getCanvasSize(metrics: GridMetrics): { width: number; height: number } {
  return {
    width: metrics.width * metrics.cellSize + 2 * metrics.padding,
    height: metrics.height * metrics.cellSize + 2 * metrics.padding,
  };
}
