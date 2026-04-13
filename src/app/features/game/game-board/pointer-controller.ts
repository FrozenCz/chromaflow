import { Position } from '../../../core/models';
import { GameEngineService } from '../../../core/services/game-engine.service';
import { GridMetrics, pixelToGrid } from '../../../core/utils';

export interface PointerRect {
  left: number;
  top: number;
}

/**
 * Pure controller translating pointer coordinates into engine calls.
 * Intentionally DOM-free so it can be unit-tested without a browser.
 */
export class PointerController {
  constructor(private readonly engine: GameEngineService) {}

  onDown(
    clientX: number,
    clientY: number,
    rect: PointerRect,
    metrics: GridMetrics,
  ): Position | null {
    const pos = pixelToGrid(clientX - rect.left, clientY - rect.top, metrics);
    if (!pos) return null;
    this.engine.startDraw(pos);
    return this.engine.drawing().isDrawing ? pos : null;
  }

  onMove(
    clientX: number,
    clientY: number,
    rect: PointerRect,
    metrics: GridMetrics,
  ): Position | null {
    const drawing = this.engine.drawing();
    if (!drawing.isDrawing) return null;
    const pos = pixelToGrid(clientX - rect.left, clientY - rect.top, metrics);
    if (!pos) {
      const path = drawing.currentPath;
      return path.length > 0 ? path[path.length - 1] : null;
    }
    this.engine.continueDraw(pos);
    return pos;
  }

  onUp(): void {
    if (this.engine.drawing().isDrawing) {
      this.engine.endDraw();
    }
  }
}
