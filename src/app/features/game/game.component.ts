import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { GameEngineService } from '../../core/services/game-engine.service';
import { DEMO_LEVEL } from '../../data/levels/demo';
import { GameBoardComponent } from './game-board/game-board.component';

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

  ngOnInit(): void {
    if (!this.engine.level()) {
      this.engine.initLevel(DEMO_LEVEL);
    }
  }
}
