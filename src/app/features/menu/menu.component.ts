import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="ChromaFlow" subheader="Color puzzle game">
      <p>Welcome to ChromaFlow. Pick a mode to start playing.</p>
      <div class="actions">
        <p-button label="Quick Game" icon="pi pi-play" routerLink="/game" />
        <p-button
          label="Campaign"
          icon="pi pi-map"
          severity="secondary"
          routerLink="/campaign"
        />
        <p-button
          label="Settings"
          icon="pi pi-cog"
          [text]="true"
          routerLink="/settings"
        />
      </div>
    </p-card>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 640px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1rem;
      }
    `,
  ],
})
export class MenuComponent {}
