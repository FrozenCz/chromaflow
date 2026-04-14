import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { COLOR_PALETTE } from '../../../core/models';
import { portalColorFor } from '../../../core/utils';

const WALL_CELL_COLOR = '#3a3a3a';
const PREVIEW_SIZE = 56;

/**
 * Read-only modal with a short visual legend for the three modifier types
 * (walls, portals, color changers). Each item is illustrated by a small inline
 * canvas using the same colors the game board uses so players can recognize
 * the tiles at a glance.
 */
@Component({
  selector: 'app-legend-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legend-dialog.component.html',
  styleUrl: './legend-dialog.component.scss',
})
export class LegendDialogComponent implements AfterViewInit {
  readonly visible = input<boolean>(false);
  readonly visibleChange = output<boolean>();

  @ViewChild('wallCanvas', { static: false })
  private wallCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('portalCanvas', { static: false })
  private portalCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('changerCanvas', { static: false })
  private changerCanvasRef?: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    this.drawAll();
  }

  protected onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  protected onShow(): void {
    // Re-draw when dialog is (re)shown — the canvases only become attached
    // once the PrimeNG dialog renders its content.
    queueMicrotask(() => this.drawAll());
  }

  protected onClose(): void {
    this.visibleChange.emit(false);
  }

  private drawAll(): void {
    this.drawWall(this.wallCanvasRef?.nativeElement);
    this.drawPortal(this.portalCanvasRef?.nativeElement);
    this.drawChanger(this.changerCanvasRef?.nativeElement);
  }

  private getContext(canvas: HTMLCanvasElement | undefined): CanvasRenderingContext2D | null {
    if (!canvas) return null;
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    return ctx;
  }

  private drawWall(canvas: HTMLCanvasElement | undefined): void {
    const ctx = this.getContext(canvas);
    if (!ctx) return;
    // Background grid hint
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    // Wall cell
    ctx.fillStyle = WALL_CELL_COLOR;
    ctx.fillRect(6, 6, PREVIEW_SIZE - 12, PREVIEW_SIZE - 12);
    // Subtle border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, PREVIEW_SIZE - 12, PREVIEW_SIZE - 12);
  }

  private drawPortal(canvas: HTMLCanvasElement | undefined): void {
    const ctx = this.getContext(canvas);
    if (!ctx) return;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const color = portalColorFor('p1');
    // Two portal discs
    const radius = 10;
    const drawDisc = (cx: number, cy: number): void => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    };
    drawDisc(16, 16);
    drawDisc(PREVIEW_SIZE - 16, PREVIEW_SIZE - 16);
    // Dashed link
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(16, 16);
    ctx.lineTo(PREVIEW_SIZE - 16, PREVIEW_SIZE - 16);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawChanger(canvas: HTMLCanvasElement | undefined): void {
    const ctx = this.getContext(canvas);
    if (!ctx) return;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const from = COLOR_PALETTE.R.main;
    const to = COLOR_PALETTE.B.main;
    // Left half (from color)
    ctx.fillStyle = from;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(PREVIEW_SIZE - 6, 6);
    ctx.lineTo(6, PREVIEW_SIZE - 6);
    ctx.closePath();
    ctx.fill();
    // Right half (to color)
    ctx.fillStyle = to;
    ctx.beginPath();
    ctx.moveTo(PREVIEW_SIZE - 6, 6);
    ctx.lineTo(PREVIEW_SIZE - 6, PREVIEW_SIZE - 6);
    ctx.lineTo(6, PREVIEW_SIZE - 6);
    ctx.closePath();
    ctx.fill();
    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, PREVIEW_SIZE - 12, PREVIEW_SIZE - 12);
  }
}
