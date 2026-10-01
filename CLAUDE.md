# CLAUDE.md

Tento soubor poskytuje kontext pro Claude Code agenty pracujici s timto projektem.

## Tech Stack

- **Framework:** Angular 21 (standalone components, zoneless change detection)
- **Jazyk:** TypeScript 5.9 (strict mode)
- **UI knihovna:** PrimeNG 21 s Aura tematem (@primeuix/themes)
- **Styling:** SCSS
- **Runtime:** Node.js 20 (build), Nginx Alpine (runtime)
- **Package manager:** pnpm 9.15.9
- **Test runner:** Vitest 4 (přes `ng test`, jsdom)
- **Aplikace:** logická hra typu Flow Free (spojování barevných endpointů, portály, color changery, zdi)

## Struktura projektu

```
src/app/
├── features/            # Lazy-loaded routes (standalone komponenty)
│   ├── menu/            # /
│   ├── game/            # /game (game-board, game-hud, legend-dialog, pointer-controller)
│   ├── campaign/        # /campaign
│   └── settings/        # /settings
├── core/
│   ├── models/          # Typy: Level, World, GameState, PortalPair, ColorChanger, StorageKey...
│   ├── services/        # game-engine, level-generator, level-loader, storage
│   └── utils/           # grid, color-changer, portal-colors
├── data/levels/demo.ts  # Demo level
├── app.config.ts / app.routes.ts / app.ts
public/data/levels/      # world1.json, world2.json (načítá LevelLoaderService přes HTTP)
scripts/validate-levels.mjs  # validátor levelů a řešení
Dockerfile, nginx.conf, docker-compose.yml
```

## Build & Run

- **Install:** `pnpm install`
- **Dev:** `pnpm start` (port 4200)
- **Build:** `pnpm build` (výstup `dist/chromaflow-scaffold/browser/`)
- **Test:** `pnpm test` (Vitest přes `ng test`; spec soubory vedle zdrojů `*.spec.ts`)
- **Lint:** `pnpm lint` (ESLint nad `src/**/*.ts`)
- **Validace levelů:** `node scripts/validate-levels.mjs` (kontroluje `public/data/levels/*.json`)
- **Docker:** `docker compose up -d` (port **4280**→80, service `web`)

## Klicove soubory

- `src/app/app.config.ts` — providers: zoneless CD, router, HttpClient (fetch), animace, PrimeNG theme
- `src/app/app.routes.ts` — lazy routes menu/game/campaign/settings
- `src/app/core/services/game-engine.service.ts` — herní logika (kreslení cest, portály, win detekce)
- `src/app/core/services/level-loader.service.ts` — načtení a runtime validace světů z JSON
- `src/app/core/services/level-generator.service.ts` — generování levelů pro rychlou hru
- `src/app/core/services/storage.service.ts` — typované API nad LocalStorage
- `src/app/features/game/game-board/` — canvas vykreslení desky + `pointer-controller.ts`
- `public/data/levels/world*.json` — definice levelů (endpoints, walls, portals, colorChangers, solution)

## Konvence

- Všechny komponenty **standalone**, `ChangeDetectionStrategy.OnPush`, stav přes `signal()`
- Zoneless — reaktivita jen přes signály
- Selektor komponent `app-<kebab-case>`, direktiv `app<camelCase>` (ESLint)
- TS: `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `strictTemplates`
- Prettier: `printWidth: 100`, `singleQuote: true`; HTML parser `angular`
- Modely/služby/utils se exportují přes barrel `index.ts`
- Commit: `<branch-name>: <popis změny>` (např. `chromaflow-14: add world2 ...`)

## Gotchas

- `provideBrowserGlobalErrorListeners()` musí být v providers (jinak NG0908); nepoužívat `provideZoneChangeDetection()`.
- PrimeNG `cssLayer` pořadí `app-styles, primeng` — vlastní styly patří do vrstvy `app-styles`.
- Level JSON se načítá z `/data/levels/<worldId>.json`; po změně levelů vždy spustit `validate-levels.mjs` (solution musí pokrýt 100 % hratelných buněk).
- `package.json` name je `chromaflow-scaffold` — určuje cestu build výstupu v Dockerfile.
- `.pipeline_state` je v `.gitignore`, necommitovat.
