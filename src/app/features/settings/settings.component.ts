import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ButtonModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Settings" subheader="Placeholder">
      <p>Sound: {{ sound() ? 'On' : 'Off' }}</p>
      <p-button
        [label]="sound() ? 'Mute' : 'Unmute'"
        icon="pi pi-volume-up"
        (onClick)="toggle()"
      />
    </p-card>
  `,
})
export class SettingsComponent {
  protected readonly sound = signal(true);
  protected toggle(): void {
    this.sound.update((v) => !v);
  }
}
