import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { GameEngineService } from '../../core/services/game-engine.service';
import { LevelLoaderService } from '../../core/services/level-loader.service';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameHudComponent } from './game-hud/game-hud.component';

/**
 * Quick Game screen. Always starts the engine on a freshly generated,
 * guaranteed-solvable level produced by {@link LevelLoaderService.generateLevel}
 * (which delegates to the solution-first {@link LevelGeneratorService} and
 * re-validates the output). Using the generator instead of a hand-written
 * demo level prevents shipping unsolvable layouts to the player.
 */
@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CardModule, GameBoardComponent, GameHudComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="ChromaFlow" subheader="Propoj barevné koncové body">
      <div class="game-layout">
        <app-game-hud />
        <app-game-board />
      </div>
    </p-card>
  `,
  styles: [
    `
      .game-layout {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
    `,
  ],
})
export class GameComponent implements OnInit {
  private readonly engine = inject(GameEngineService);
  private readonly loader = inject(LevelLoaderService);

  ngOnInit(): void {
    if (this.engine.level()) {
      return;
    }
    // Delegated to LevelLoaderService.generateQuickGame() which owns the
    // seed algorithm and Quick Game parameters. The loader re-validates the
    // generated level (full coverage, adjacency, matching endpoints).
    const level = this.loader.generateQuickGame();
    this.engine.initLevel(level);
  }
}
