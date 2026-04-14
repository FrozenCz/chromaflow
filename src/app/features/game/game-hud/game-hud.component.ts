import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { GameEngineService } from '../../../core/services/game-engine.service';
import { LevelLoaderService } from '../../../core/services/level-loader.service';

const HINT_COOLDOWN_MS = 3000;
const MOBILE_BREAKPOINT_PX = 768;

/**
 * Heads-up display for the game screen. Renders a top toolbar with
 * time/moves/fill stats and a bottom toolbar with Reset/Undo/Hint controls.
 * Shows a completion dialog with star rating when the engine signals a win.
 */
@Component({
  selector: 'app-game-hud',
  standalone: true,
  imports: [ToolbarModule, ButtonModule, DialogModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-hud.component.html',
  styleUrl: './game-hud.component.scss',
})
export class GameHudComponent {
  protected readonly engine = inject(GameEngineService);
  private readonly router = inject(Router);
  private readonly loader = inject(LevelLoaderService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly winDialogVisible = signal(false);
  protected readonly hintCooldown = signal(false);
  protected readonly isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT_PX : false,
  );

  private hintCooldownHandle: ReturnType<typeof setTimeout> | null = null;
  private resizeListener: (() => void) | null = null;

  protected readonly timeLabel = computed(() => {
    const total = this.engine.elapsedSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  protected readonly moves = computed(() => this.engine.moveCount());
  protected readonly fill = computed(() => this.engine.fillPercentage());
  protected readonly undoDisabled = computed(() => this.engine.historySize() === 0);
  protected readonly hasSolution = computed(() => {
    const level = this.engine.level();
    return !!(level?.solution && level.solution.length > 0);
  });

  protected readonly stars = computed(() => {
    const level = this.engine.level();
    const moves = this.engine.moveCount();
    const par = level?.par;
    if (par === undefined || par === null) return 3;
    if (moves <= par) return 3;
    if (moves <= Math.ceil(par * 1.5)) return 2;
    return 1;
  });

  protected readonly starArray = computed(() => {
    const filled = this.stars();
    return [1, 2, 3].map((i) => i <= filled);
  });

  protected readonly parLabel = computed(() => {
    const level = this.engine.level();
    return level?.par !== undefined ? String(level.par) : '-';
  });

  constructor() {
    // Open the win dialog exactly once per win.
    effect(() => {
      if (this.engine.isWon()) {
        this.winDialogVisible.set(true);
      }
    });

    if (typeof window !== 'undefined') {
      const handler = (): void => {
        this.isMobile.set(window.innerWidth < MOBILE_BREAKPOINT_PX);
      };
      window.addEventListener('resize', handler);
      this.resizeListener = handler;
    }

    this.destroyRef.onDestroy(() => {
      if (this.hintCooldownHandle !== null) {
        clearTimeout(this.hintCooldownHandle);
        this.hintCooldownHandle = null;
      }
      if (this.resizeListener && typeof window !== 'undefined') {
        window.removeEventListener('resize', this.resizeListener);
        this.resizeListener = null;
      }
    });
  }

  protected onReset(): void {
    this.engine.reset();
    this.winDialogVisible.set(false);
  }

  protected onUndo(): void {
    this.engine.undo();
  }

  protected onHint(): void {
    if (this.hintCooldown()) return;
    this.engine.hint();
    this.hintCooldown.set(true);
    this.hintCooldownHandle = setTimeout(() => {
      this.hintCooldown.set(false);
      this.hintCooldownHandle = null;
    }, HINT_COOLDOWN_MS);
  }

  protected onReplay(): void {
    this.engine.reset();
    this.winDialogVisible.set(false);
  }

  protected onMenu(): void {
    this.winDialogVisible.set(false);
    void this.router.navigate(['/']);
  }

  protected onNextLevel(): void {
    // Generate a fresh Quick Game level — campaign progression is handled
    // elsewhere. This keeps the HUD self-contained without coupling to world data.
    try {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const level = this.loader.generateLevel({
        id: `quick-${seed.toString(16)}`,
        name: 'Quick Game',
        width: 5,
        height: 5,
        numColors: 3,
        seed,
      });
      this.engine.initLevel(level);
    } catch {
      // Fallback: at least reset the current level so the dialog closes cleanly.
      this.engine.reset();
    }
    this.winDialogVisible.set(false);
  }
}
