import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-campaign',
  standalone: true,
  imports: [ButtonModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Campaign" subheader="Placeholder">
      <p>Campaign levels will appear here.</p>
      <p-button label="Coming soon" icon="pi pi-lock" [disabled]="true" />
    </p-card>
  `,
})
export class CampaignComponent {}
