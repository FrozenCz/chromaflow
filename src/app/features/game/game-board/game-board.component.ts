import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { COLOR_PALETTE, FlowColor, PathSolution, Position } from '../../../core/models';
import { GameEngineService } from '../../../core/services/game-engine.service';
import {
  GridMetrics,
  computePathColorSegments,
  createGridMetrics,
  getCanvasSize,
  gridToPixel,
  portalColorFor,
} from '../../../core/utils';
import { PointerController } from './pointer-controller';

const GRID_LINE_COLOR = '#2a2a2a';
const GRID_BG_COLOR = '#121212';
const CELL_BG_COLOR = '#181818';
const WALL_CELL_COLOR = '#3a3a3a';
const ACTIVE_CELL_LINE_WIDTH = 3;

@Component({
  selector: 'app-game-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #canvas
    class="game-board-canvas"
    (pointerdown)="onPointerDown($event)"
    (pointermove)="onPointerMove($event)"
    (pointerup)="onPointerUp($event)"
    (pointercancel)="onPointerUp($event)"
  ></canvas>`,
  styleUrl: './game-board.component.scss',
})
export class GameBoardComponent implements AfterViewInit, OnDestroy {
  protected readonly engine = inject(GameEngineService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeCell = signal<Position | null>(null);
  private readonly pointerController = new PointerController(this.engine);

  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private rafHandle: number | null = null;

  private readonly viewportWidth = signal(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  private readonly viewportHeight = signal(
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  private readonly metrics = computed<GridMetrics | null>(() => {
    const level = this.engine.level();
    if (!level) return null;
    return createGridMetrics(
      this.viewportWidth(),
      level.width,
      level.height,
      this.viewportHeight(),
    );
  });

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');

    effect(
      () => {
        // track all reactive deps
        this.engine.level();
        this.engine.paths();
        this.engine.drawing();
        this.activeCell();
        this.metrics();
        this.scheduleDraw();
      },
      { injector: this.injector },
    );

    this.scheduleDraw();
  }

  ngOnDestroy(): void {
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window === 'undefined') return;
    this.viewportWidth.set(window.innerWidth);
    this.viewportHeight.set(window.innerHeight);
  }

  protected onPointerDown(event: PointerEvent): void {
    const metrics = this.metrics();
    if (!metrics) return;
    event.preventDefault();
    const target = event.target as Element | null;
    try {
      target?.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore capture failures */
    }
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const pos = this.pointerController.onDown(event.clientX, event.clientY, rect, metrics);
    this.activeCell.set(pos);
  }

  protected onPointerMove(event: PointerEvent): void {
    const metrics = this.metrics();
    if (!metrics) return;
    if (!this.engine.drawing().isDrawing) return;
    event.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const pos = this.pointerController.onMove(event.clientX, event.clientY, rect, metrics);
    this.activeCell.set(pos);
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointerController.onUp();
    this.activeCell.set(null);
    const target = event.target as Element | null;
    try {
      target?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore release failures */
    }
  }

  private scheduleDraw(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      this.draw();
      return;
    }
    if (this.rafHandle !== null) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.draw();
    });
  }

  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef?.nativeElement;
    const metrics = this.metrics();
    if (!ctx || !canvas || !metrics) return;

    const { width, height } = getCanvasSize(metrics);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = GRID_BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(ctx, metrics);
    this.drawWalls(ctx, metrics);
    this.drawPortals(ctx, metrics);
    this.drawColorChangers(ctx, metrics);
    this.drawPaths(ctx, metrics);
    this.drawEndpoints(ctx, metrics);
    this.drawActiveCell(ctx, metrics);
  }

  private drawColorChangers(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const level = this.engine.level();
    if (!level || !level.colorChangers || level.colorChangers.length === 0) return;
    const { cellSize } = metrics;
    const radius = cellSize * 0.36;
    const outlineWidth = Math.max(1, cellSize * 0.05);

    for (const changer of level.colorChangers) {
      const { x, y } = gridToPixel(changer.position, metrics);
      const fromColor = COLOR_PALETTE[changer.from].main;
      const toColor = COLOR_PALETTE[changer.to].main;

      // Upper-left half (from) — triangle above the anti-diagonal.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = fromColor;
      ctx.beginPath();
      ctx.moveTo(x - radius - 2, y - radius - 2);
      ctx.lineTo(x + radius + 2, y - radius - 2);
      ctx.lineTo(x - radius - 2, y + radius + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = toColor;
      ctx.beginPath();
      ctx.moveTo(x + radius + 2, y - radius - 2);
      ctx.lineTo(x + radius + 2, y + radius + 2);
      ctx.lineTo(x - radius - 2, y + radius + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Diagonal divider line.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.moveTo(x + radius, y - radius);
      ctx.lineTo(x - radius, y + radius);
      ctx.stroke();
      ctx.restore();

      // Outer ring.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPortals(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const level = this.engine.level();
    if (!level || !level.portals || level.portals.length === 0) return;
    const { cellSize } = metrics;
    const outerRadius = cellSize * 0.38;
    const innerRadius = cellSize * 0.22;
    const lineWidth = cellSize * 0.08;

    for (const pair of level.portals) {
      const color = portalColorFor(pair.id);
      for (const endpoint of [pair.a, pair.b]) {
        const { x, y } = gridToPixel(endpoint, metrics);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const { width, height, cellSize, padding } = metrics;

    ctx.fillStyle = CELL_BG_COLOR;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        ctx.fillRect(
          padding + col * cellSize + 1,
          padding + row * cellSize + 1,
          cellSize - 2,
          cellSize - 2,
        );
      }
    }

    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= width; c++) {
      const x = padding + c * cellSize + 0.5;
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + height * cellSize);
    }
    for (let r = 0; r <= height; r++) {
      const y = padding + r * cellSize + 0.5;
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width * cellSize, y);
    }
    ctx.stroke();
  }

  private drawWalls(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const level = this.engine.level();
    if (!level || !level.walls || level.walls.length === 0) return;
    const { cellSize, padding } = metrics;
    ctx.fillStyle = WALL_CELL_COLOR;
    for (const wall of level.walls) {
      ctx.fillRect(
        padding + wall.col * cellSize + 1,
        padding + wall.row * cellSize + 1,
        cellSize - 2,
        cellSize - 2,
      );
    }
  }

  private drawPaths(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const lineWidth = metrics.cellSize * 0.55;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;

    for (const solution of this.engine.paths()) {
      this.strokePath(ctx, solution, metrics);
    }

    const drawing = this.engine.drawing();
    if (drawing.isDrawing && drawing.currentColor && drawing.currentPath.length > 0) {
      this.strokePath(
        ctx,
        { color: drawing.currentColor, path: drawing.currentPath },
        metrics,
      );
    }
  }

  private strokePath(
    ctx: CanvasRenderingContext2D,
    solution: PathSolution,
    metrics: GridMetrics,
  ): void {
    if (solution.path.length === 0) return;
    const level = this.engine.level();
    const segments: FlowColor[] = level
      ? computePathColorSegments(solution.path, level, solution.color)
      : (solution.path.map(() => solution.color) as FlowColor[]);
    // `segments[i]` is the active color AFTER passing through cell i.
    // The color of the edge from path[i-1] to path[i] therefore matches
    // segments[i] (the post-transform color at the arriving cell).
    for (let i = 1; i < solution.path.length; i++) {
      const prev = solution.path[i - 1];
      const cur = solution.path[i];
      const gridAdjacent =
        Math.abs(prev.row - cur.row) + Math.abs(prev.col - cur.col) === 1;
      if (!gridAdjacent) {
        // Portal teleport hop — do not render a stroke between these cells.
        continue;
      }
      const edgeColor = COLOR_PALETTE[segments[i]].main;
      const prevPx = gridToPixel(prev, metrics);
      const curPx = gridToPixel(cur, metrics);
      ctx.strokeStyle = edgeColor;
      ctx.beginPath();
      ctx.moveTo(prevPx.x, prevPx.y);
      ctx.lineTo(curPx.x, curPx.y);
      ctx.stroke();
    }
  }

  private drawEndpoints(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const level = this.engine.level();
    if (!level) return;
    const radius = metrics.cellSize * 0.35;
    for (const endpoint of level.endpoints) {
      const { x, y } = gridToPixel(endpoint.position, metrics);
      ctx.fillStyle = COLOR_PALETTE[endpoint.color].main;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawActiveCell(ctx: CanvasRenderingContext2D, metrics: GridMetrics): void {
    const active = this.activeCell();
    if (!active) return;
    const drawing = this.engine.drawing();
    const previewColor = drawing.activeColor ?? drawing.currentColor;
    const color = previewColor ? COLOR_PALETTE[previewColor].main : '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = ACTIVE_CELL_LINE_WIDTH;
    ctx.strokeRect(
      metrics.padding + active.col * metrics.cellSize + 1.5,
      metrics.padding + active.row * metrics.cellSize + 1.5,
      metrics.cellSize - 3,
      metrics.cellSize - 3,
    );
  }
}
