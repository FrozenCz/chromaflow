import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { GameEngineService } from '../../core/services/game-engine.service';
import { LevelLoaderService } from '../../core/services/level-loader.service';
import { GameBoardComponent } from './game-board/game-board.component';

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
  imports: [CardModule, GameBoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="ChromaFlow" subheader="Propoj barevné koncové body">
      <app-game-board />
    </p-card>
  `,
})
export class GameComponent implements OnInit {
  private readonly engine = inject(GameEngineService);
  private readonly loader = inject(LevelLoaderService);

  ngOnInit(): void {
    if (this.engine.level()) {
      return;
    }
    // Use a time-based seed so each Quick Game session is different but
    // still reproducible if logged. The loader re-validates the generated
    // level (full coverage, adjacency, matching endpoints) before returning.
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
  }
}
