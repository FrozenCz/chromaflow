# CLAUDE.md

Tento soubor poskytuje kontext pro Claude Code agenty pracujici s timto projektem.

## Tech Stack

- **Framework:** Angular 21 (standalone components, zoneless change detection)
- **Jazyk:** TypeScript 5.9 (strict mode)
- **UI knihovna:** PrimeNG 21 s Aura tematem (@primeuix/themes)
- **Styling:** SCSS (inline i externí soubory)
- **Runtime:** Node.js 20 (build), Nginx Alpine (runtime)
- **Package manager:** pnpm 9.15.9
- **Test runner:** Vitest 4

## Struktura projektu

```
chromaflow-3/
├── src/
│   ├── app/
│   │   ├── features/          # Feature komponenty (lazy-loaded routes)
│   │   │   ├── menu/          # Hlavní menu (/)
│   │   │   ├── game/          # Herní obrazovka (/game)
│   │   │   ├── campaign/      # Kampaň (/campaign)
│   │   │   └── settings/      # Nastavení (/settings)
│   │   ├── core/
│   │   │   ├── models/        # Datové modely (prázdné)
│   │   │   ├── services/      # Sdílené servisy (prázdné)
│   │   │   └── utils/         # Utility funkce (prázdné)
│   │   ├── data/levels/       # Herní data/levely (prázdné)
│   │   ├── app.ts             # Root komponenta
│   │   ├── app.routes.ts      # Routing konfigurace
│   │   └── app.config.ts      # App konfigurace (providers)
│   └── styles.scss            # Globální styly
├── public/                    # Statické assety
├── Dockerfile                 # Multi-stage build (Node → Nginx)
└── docker-compose.yml         # Port 4280:80
```

## Build & Run

- **Install:** `pnpm install`
- **Dev:** `pnpm start` (port 4200, `ng serve`)
- **Build:** `pnpm build` (výstup: `dist/chromaflow-scaffold/browser/`)
- **Test:** `pnpm test` (Vitest via `ng test`)
- **Lint:** `pnpm lint`
- **Docker:** `docker compose up -d` (port **4280**)

## Klicove soubory

- `src/app/app.config.ts` — globální providers: router, PrimeNG theme, zoneless CD, animace
- `src/app/app.routes.ts` — lazy-loaded routes pro menu, game, campaign, settings
- `src/app/features/` — všechny feature komponenty (standalone, OnPush)
- `src/app/core/` — připravená kostra pro modely, servisy, utility
- `src/app/data/levels/` — místo pro herní level data (zatím prázdné)
- `docker-compose.yml` — service `web`, port 4280→80

## Konvence

- Všechny komponenty jsou **standalone** (žádné NgModuly)
- **Zoneless** change detection (`provideZonelessChangeDetection()`) — vyžaduje `signal()` pro reaktivitu
- `ChangeDetectionStrategy.OnPush` povinně na každé komponentě
- Komponenty používají `signal()` místo class properties pro state
- Selektor komponent: `app-<kebab-case>`, direktiv: `app<camelCase>` (ESLint pravidlo)
- SCSS soubory pro komponenty (nastaveno v `angular.json` schematics)
- Prettier: `printWidth: 100`, `singleQuote: true`
- Commit konvence: `<branch-name>: <popis změny>` (např. `chromaflow-2: Scaffold Angular 21`)

## Gotchas

- **Zoneless bootstrap:** `provideBrowserGlobalErrorListeners()` musí být v providers, jinak NG0908 crash. Nepoužívat `provideZoneChangeDetection()`.
- **PrimeNG CSS vrstvení:** `cssLayer` je nakonfigurovaný v `app.config.ts` — pořadí `app-styles, primeng`. Vlastní styly musí být ve vrstvě `app-styles` aby přepsaly PrimeNG.
- `dist/chromaflow-scaffold/browser/` je výstupní adresář pro produkční build (Nginx to servuje ze `/usr/share/nginx/html`).
- Projekt je scaffold — `core/`, `data/` adresáře jsou prázdné a čekají na implementaci.
