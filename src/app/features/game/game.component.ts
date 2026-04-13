import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [ButtonModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Game" subheader="Placeholder">
      <p>Moves: {{ moves() }}</p>
      <p-button label="Move" icon="pi pi-refresh" (onClick)="inc()" />
    </p-card>
  `,
})
export class GameComponent {
  protected readonly moves = signal(0);
  protected inc(): void {
    this.moves.update((v) => v + 1);
  }
}
