import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

interface MenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly severity:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'info'
    | 'warn'
    | 'help'
    | 'danger'
    | 'contrast';
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly disabled: boolean;
  readonly tooltip?: string;
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="menu-screen">
      <header class="branding">
        <h1 class="logo">Chromaflow</h1>
        <p class="tagline">Barevná logická hra plná odstínů</p>
      </header>

      <nav class="modes" aria-label="Hlavní menu">
        @for (item of menuItems; track item.key) {
          @if (item.disabled) {
            <p-button
              [label]="item.label"
              [icon]="item.icon"
              [severity]="item.severity"
              [disabled]="true"
              [pTooltip]="item.tooltip ?? ''"
              tooltipPosition="top"
              styleClass="mode-button"
            />
          } @else {
            <p-button
              [label]="item.label"
              [icon]="item.icon"
              [severity]="item.severity"
              [routerLink]="item.route"
              [queryParams]="item.queryParams ?? null"
              styleClass="mode-button"
            />
          }
        }
      </nav>
    </div>
  `,
  styles: [
    `
      @layer app-styles {
        :host {
          display: block;
          width: 100%;
          min-height: 100%;
          padding: 2rem 1rem;
          box-sizing: border-box;
        }

        .menu-screen {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .branding {
          text-align: center;
        }

        .logo {
          margin: 0;
          font-size: clamp(2.25rem, 6vw, 3.5rem);
          font-weight: 800;
          letter-spacing: 0.04em;
          background: linear-gradient(
            90deg,
            #ef4444 0%,
            #f59e0b 25%,
            #10b981 50%,
            #3b82f6 75%,
            #a855f7 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .tagline {
          margin: 0.5rem 0 0;
          font-size: 1rem;
          color: var(--p-text-muted-color, #6b7280);
        }

        .modes {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .modes :global(.mode-button),
        .modes ::ng-deep .mode-button {
          width: 100%;
          min-height: 3.5rem;
          font-size: 1.05rem;
          font-weight: 600;
          justify-content: center;
        }

        @media (min-width: 640px) {
          .modes {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 960px) {
          .modes {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      }
    `,
  ],
})
export class MenuComponent {
  protected readonly menuItems: readonly MenuItem[] = [
    {
      key: 'campaign',
      label: 'Kampaň',
      icon: 'pi pi-map',
      severity: 'primary',
      route: '/campaign',
      disabled: false,
    },
    {
      key: 'daily',
      label: 'Denní výzva',
      icon: 'pi pi-calendar',
      severity: 'help',
      route: '/game',
      queryParams: { mode: 'daily' },
      disabled: true,
      tooltip: 'Brzy dostupné',
    },
    {
      key: 'zen',
      label: 'Zen režim',
      icon: 'pi pi-moon',
      severity: 'info',
      route: '/game',
      queryParams: { mode: 'zen' },
      disabled: true,
      tooltip: 'Brzy dostupné',
    },
    {
      key: 'quick',
      label: 'Rychlý režim',
      icon: 'pi pi-bolt',
      severity: 'success',
      route: '/game',
      disabled: false,
    },
    {
      key: 'settings',
      label: 'Nastavení',
      icon: 'pi pi-cog',
      severity: 'secondary',
      route: '/settings',
      disabled: false,
    },
  ];
}
