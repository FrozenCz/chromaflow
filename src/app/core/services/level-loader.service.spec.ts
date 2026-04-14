import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import world1Fixture from '../../../../public/data/levels/world1.json';
import { LevelLoaderService } from './level-loader.service';

interface RawPos {
  row: number;
  col: number;
}
interface RawEndpoint {
  color: string;
  position: RawPos;
}
interface RawSolution {
  color: string;
  path: RawPos[];
}
interface RawLevel {
  id: string;
  name: string;
  width: number;
  height: number;
  endpoints: RawEndpoint[];
  par: number;
  solution: RawSolution[];
}
interface RawWorld {
  metadata: { id: string; name: string; order: number };
  levels: RawLevel[];
}

function buildValidWorld(): RawWorld {
  return {
    metadata: { id: 'world1', name: 'W1', order: 1 },
    levels: [
      {
        id: 'w1-l1',
        name: 'Tiny',
        width: 2,
        height: 2,
        endpoints: [
          { color: 'R', position: { row: 0, col: 0 } },
          { color: 'R', position: { row: 1, col: 0 } },
          { color: 'B', position: { row: 0, col: 1 } },
          { color: 'B', position: { row: 1, col: 1 } },
        ],
        par: 2,
        solution: [
          {
            color: 'R',
            path: [
              { row: 0, col: 0 },
              { row: 1, col: 0 },
            ],
          },
          {
            color: 'B',
            path: [
              { row: 0, col: 1 },
              { row: 1, col: 1 },
            ],
          },
        ],
      },
    ],
  };
}

describe('LevelLoaderService', () => {
  let service: LevelLoaderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LevelLoaderService,
      ],
    });
    service = TestBed.inject(LevelLoaderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads a world via HTTP and returns parsed data', async () => {
    const promise = new Promise<unknown>((resolve, reject) => {
      service.loadWorld('world1').subscribe({ next: resolve, error: reject });
    });
    const req = httpMock.expectOne('/data/levels/world1.json');
    expect(req.request.method).toBe('GET');
    req.flush(buildValidWorld());
    const world = (await promise) as { levels: { id: string }[] };
    expect(world.levels).toHaveLength(1);
    expect(world.levels[0].id).toBe('w1-l1');
  });

  it('caches the world so subsequent calls do not issue a new HTTP request', async () => {
    const first = new Promise<unknown>((resolve) => {
      service.loadWorld('world1').subscribe({ next: resolve });
    });
    httpMock.expectOne('/data/levels/world1.json').flush(buildValidWorld());
    await first;

    const second = new Promise<unknown>((resolve) => {
      service.loadWorld('world1').subscribe({ next: resolve });
    });
    httpMock.expectNone('/data/levels/world1.json');
    await second;
  });

  it('loadLevel returns the matching level from a loaded world', async () => {
    const promise = new Promise<{ id: string }>((resolve, reject) => {
      service
        .loadLevel('w1-l1')
        .subscribe({ next: (l) => resolve(l as { id: string }), error: reject });
    });
    httpMock.expectOne('/data/levels/world1.json').flush(buildValidWorld());
    const level = await promise;
    expect(level.id).toBe('w1-l1');
  });

  it('rejects a solution with a non-adjacent step', () => {
    const bad = buildValidWorld();
    bad.levels[0].solution[0].path = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ];
    expect(() => service.validateWorld(bad)).toThrow(/non-adjacent/);
  });

  it('rejects a solution that does not cover every playable cell', () => {
    const bad = buildValidWorld();
    bad.levels[0].solution = [
      {
        color: 'R',
        path: [
          { row: 0, col: 0 },
          { row: 1, col: 0 },
        ],
      },
    ];
    expect(() => service.validateWorld(bad)).toThrow(/missing color|covers/);
  });

  it('rejects a level with three endpoints of the same color', () => {
    const bad = buildValidWorld();
    bad.levels[0].endpoints.push({
      color: 'R',
      position: { row: 0, col: 1 },
    });
    expect(() => service.validateWorld(bad)).toThrow(/exactly 2 endpoints/);
  });

  it('parses and validates the real world1.json fixture with 10 levels', () => {
    const parsed = service.validateWorld(world1Fixture);
    expect(parsed.levels).toHaveLength(10);
    for (const level of parsed.levels) {
      expect(level.width).toBe(5);
      expect(level.height).toBe(5);
      expect(level.solution).toBeDefined();
      const covered = new Set<string>();
      for (const seg of level.solution ?? []) {
        for (const cell of seg.path) {
          covered.add(`${cell.row},${cell.col}`);
        }
      }
      expect(covered.size).toBe(25);
    }
  });

  describe('colorChangers validation', () => {
    interface RawChanger {
      position: RawPos;
      from: string;
      to: string;
    }
    function worldWithChanger(cc: RawChanger): RawWorld & {
      levels: (RawLevel & { colorChangers?: RawChanger[] })[];
    } {
      const w = buildValidWorld() as RawWorld & {
        levels: (RawLevel & { colorChangers?: RawChanger[] })[];
      };
      // Enlarge level to 3x3 with R/B endpoints so color changer has room.
      w.levels[0] = {
        ...w.levels[0],
        width: 3,
        height: 3,
        endpoints: [
          { color: 'R', position: { row: 0, col: 0 } },
          { color: 'R', position: { row: 0, col: 2 } },
          { color: 'B', position: { row: 2, col: 0 } },
          { color: 'B', position: { row: 2, col: 2 } },
        ],
        par: 2,
        solution: [
          {
            color: 'R',
            path: [
              { row: 0, col: 0 },
              { row: 0, col: 1 },
              { row: 0, col: 2 },
              { row: 1, col: 2 },
              { row: 1, col: 1 },
            ],
          },
          {
            color: 'B',
            path: [
              { row: 2, col: 0 },
              { row: 1, col: 0 },
              { row: 2, col: 1 },
              { row: 2, col: 2 },
            ],
          },
        ],
        colorChangers: [cc],
      };
      // Fix: solution must be a valid cover; rebuild simpler level instead.
      w.levels[0] = {
        id: 'w1-l1',
        name: 'CC',
        width: 2,
        height: 2,
        endpoints: [
          { color: 'R', position: { row: 0, col: 0 } },
          { color: 'R', position: { row: 1, col: 0 } },
          { color: 'B', position: { row: 0, col: 1 } },
          { color: 'B', position: { row: 1, col: 1 } },
        ],
        par: 2,
        solution: [
          {
            color: 'R',
            path: [
              { row: 0, col: 0 },
              { row: 1, col: 0 },
            ],
          },
          {
            color: 'B',
            path: [
              { row: 0, col: 1 },
              { row: 1, col: 1 },
            ],
          },
        ],
        colorChangers: [cc],
      };
      return w;
    }

    it('loads a valid color changer', () => {
      // 1x3: R @ (0,0), B @ (0,2), changer at (0,1). Solution covers all 3
      // cells as a single R color segment (path endpoints are R's pair —
      // wait, R only has one endpoint here). Use two R endpoints with a
      // single-color R solution that incidentally steps through the changer
      // cell.
      const w: RawWorld & {
        levels: (RawLevel & { colorChangers?: RawChanger[] })[];
      } = {
        metadata: { id: 'world1', name: 'W1', order: 1 },
        levels: [
          {
            id: 'w1-l1',
            name: 'CC',
            width: 3,
            height: 1,
            endpoints: [
              { color: 'R', position: { row: 0, col: 0 } },
              { color: 'R', position: { row: 0, col: 2 } },
            ],
            par: 1,
            solution: [
              {
                color: 'R',
                path: [
                  { row: 0, col: 0 },
                  { row: 0, col: 1 },
                  { row: 0, col: 2 },
                ],
              },
            ],
            colorChangers: [{ position: { row: 0, col: 1 }, from: 'R', to: 'B' }],
          },
        ],
      };
      const parsed = service.validateWorld(w);
      expect(parsed.levels[0].colorChangers).toHaveLength(1);
      expect(parsed.levels[0].colorChangers[0].from).toBe('R');
      expect(parsed.levels[0].colorChangers[0].to).toBe('B');
    });

    it('rejects a color changer where from === to', () => {
      const w = worldWithChanger({
        position: { row: 0, col: 0 },
        from: 'R',
        to: 'R',
      });
      expect(() => service.validateWorld(w)).toThrow(/from and to must differ/);
    });

    it('rejects a color changer out of bounds', () => {
      const w = worldWithChanger({
        position: { row: 9, col: 9 },
        from: 'R',
        to: 'B',
      });
      expect(() => service.validateWorld(w)).toThrow(/out of bounds/);
    });

    it('rejects a color changer overlapping an endpoint', () => {
      const w = worldWithChanger({
        position: { row: 0, col: 0 },
        from: 'R',
        to: 'B',
      });
      expect(() => service.validateWorld(w)).toThrow(/overlaps endpoint/);
    });

    it('rejects a color changer overlapping a wall', () => {
      const w = worldWithChanger({
        position: { row: 0, col: 0 },
        from: 'R',
        to: 'B',
      });
      // Remove conflicting endpoint first, add wall at that position.
      w.levels[0] = {
        id: 'w1-l1',
        name: 'CC-wall',
        width: 3,
        height: 1,
        endpoints: [
          { color: 'R', position: { row: 0, col: 0 } },
          { color: 'R', position: { row: 0, col: 2 } },
        ],
        par: 1,
        solution: [
          {
            color: 'R',
            path: [
              { row: 0, col: 0 },
              { row: 0, col: 2 },
            ],
          },
        ],
        walls: [{ row: 0, col: 1 }],
        colorChangers: [{ position: { row: 0, col: 1 }, from: 'R', to: 'B' }],
      } as RawLevel & { colorChangers?: RawChanger[] };
      // Note: solution has a non-adjacent step but we expect wall overlap error
      // to fire before solution validation (walls validated first, then
      // endpoints, then solution, then portals, then colorChangers). Actually
      // solution runs before colorChangers, so this would throw non-adjacent
      // first. Re-shape: make solution adjacent by not using wall position.
      w.levels[0] = {
        id: 'w1-l1',
        name: 'CC-wall',
        width: 2,
        height: 2,
        endpoints: [
          { color: 'R', position: { row: 0, col: 0 } },
          { color: 'R', position: { row: 1, col: 1 } },
        ],
        par: 1,
        solution: [
          {
            color: 'R',
            path: [
              { row: 0, col: 0 },
              { row: 1, col: 0 },
              { row: 1, col: 1 },
            ],
          },
        ],
        walls: [{ row: 0, col: 1 }],
        colorChangers: [{ position: { row: 0, col: 1 }, from: 'R', to: 'B' }],
      } as RawLevel & { colorChangers?: RawChanger[] };
      expect(() => service.validateWorld(w)).toThrow(/overlaps wall/);
    });

    it('rejects a color changer overlapping a portal', () => {
      const w: RawWorld & {
        levels: (RawLevel & {
          colorChangers?: RawChanger[];
          portals?: { id: string; a: RawPos; b: RawPos }[];
        })[];
      } = {
        metadata: { id: 'world1', name: 'W1', order: 1 },
        levels: [
          {
            id: 'w1-l1',
            name: 'CC-portal',
            width: 4,
            height: 1,
            endpoints: [
              { color: 'R', position: { row: 0, col: 0 } },
              { color: 'R', position: { row: 0, col: 3 } },
            ],
            par: 1,
            solution: [
              {
                color: 'R',
                path: [
                  { row: 0, col: 0 },
                  { row: 0, col: 1 },
                  { row: 0, col: 2 },
                  { row: 0, col: 3 },
                ],
              },
            ],
            portals: [
              { id: 'p1', a: { row: 0, col: 1 }, b: { row: 0, col: 2 } },
            ],
            colorChangers: [{ position: { row: 0, col: 1 }, from: 'R', to: 'B' }],
          },
        ],
      };
      expect(() => service.validateWorld(w)).toThrow(/overlaps portal/);
    });
  });

  it('generateQuickGame produces a 5x5 / 3-color level with quick- id prefix', () => {
    const level = service.generateQuickGame();
    expect(level.width).toBe(5);
    expect(level.height).toBe(5);
    expect(level.name).toBe('Quick Game');
    expect(level.id.startsWith('quick-')).toBe(true);
    // 3 colors -> 6 endpoints, par equals number of color paths.
    expect(level.endpoints).toHaveLength(6);
    expect(level.par).toBe(3);
    expect(level.solution).toHaveLength(3);
  });
});
