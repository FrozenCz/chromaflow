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
  input,
  signal,
} from '@angular/core';
import { COLOR_PALETTE, PathSolution, Position } from '../../../core/models';
import { GameEngineService } from '../../../core/services/game-engine.service';
import {
  GridMetrics,
  createGridMetrics,
  getCanvasSize,
  gridToPixel,
} from '../../../core/utils';

const GRID_LINE_COLOR = '#2a2a2a';
const GRID_BG_COLOR = '#121212';
const CELL_BG_COLOR = '#181818';
const ACTIVE_CELL_LINE_WIDTH = 3;

@Component({
  selector: 'app-game-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="game-board-canvas"></canvas>`,
  styleUrl: './game-board.component.scss',
})
export class GameBoardComponent implements AfterViewInit, OnDestroy {
  protected readonly engine = inject(GameEngineService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeCell = input<Position | null>(null);

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
    this.drawPaths(ctx, metrics);
    this.drawEndpoints(ctx, metrics);
    this.drawActiveCell(ctx, metrics);
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
    const color = COLOR_PALETTE[solution.color].main;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < solution.path.length; i++) {
      const { x, y } = gridToPixel(solution.path[i], metrics);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
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
    const color = drawing.currentColor
      ? COLOR_PALETTE[drawing.currentColor].main
      : '#ffffff';
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
