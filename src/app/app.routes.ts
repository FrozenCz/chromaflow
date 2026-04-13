import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/menu/menu.component').then((m) => m.MenuComponent),
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./features/game/game.component').then((m) => m.GameComponent),
  },
  {
    path: 'campaign',
    loadComponent: () =>
      import('./features/campaign/campaign.component').then(
        (m) => m.CampaignComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
