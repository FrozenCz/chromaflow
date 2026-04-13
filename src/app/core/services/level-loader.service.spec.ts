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
});
