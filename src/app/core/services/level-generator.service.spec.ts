import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FLOW_COLORS, Level, Position } from '../models';
import { LevelGeneratorService } from './level-generator.service';
import { LevelLoaderService } from './level-loader.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

function key(p: Position): string {
  return `${p.row},${p.col}`;
}

function assertValidLevel(level: Level): void {
  // Coverage: every solution cell unique, total = width*height.
  const seen = new Set<string>();
  for (const seg of level.solution ?? []) {
    // Adjacency
    for (let i = 1; i < seg.path.length; i++) {
      const dr = Math.abs(seg.path[i].row - seg.path[i - 1].row);
      const dc = Math.abs(seg.path[i].col - seg.path[i - 1].col);
      expect(dr + dc).toBe(1);
    }
    for (const cell of seg.path) {
      const k = key(cell);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    // Endpoints match first/last
    const ep = level.endpoints.filter((e) => e.color === seg.color);
    expect(ep.length).toBe(2);
    const first = seg.path[0];
    const last = seg.path[seg.path.length - 1];
    const matches =
      (key(ep[0].position) === key(first) && key(ep[1].position) === key(last)) ||
      (key(ep[1].position) === key(first) && key(ep[0].position) === key(last));
    expect(matches).toBe(true);
  }
  expect(seen.size).toBe(level.width * level.height);
}

describe('LevelGeneratorService', () => {
  let generator: LevelGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    generator = TestBed.inject(LevelGeneratorService);
  });

  it('produces a valid level (5x5, 2 colors)', () => {
    const level = generator.generate({
      id: 'test-l1',
      width: 5,
      height: 5,
      numColors: 2,
      seed: 42,
    });
    assertValidLevel(level);
    expect(level.par).toBe(2);
    expect(level.endpoints.length).toBe(4);
  });

  it('is deterministic for the same seed', () => {
    const a = generator.generate({ id: 'a', width: 6, height: 6, numColors: 4, seed: 12345 });
    const b = generator.generate({ id: 'a', width: 6, height: 6, numColors: 4, seed: 12345 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different layouts for different seeds', () => {
    const a = generator.generate({ id: 'a', width: 5, height: 5, numColors: 3, seed: 1 });
    const b = generator.generate({ id: 'a', width: 5, height: 5, numColors: 3, seed: 999 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('handles a variety of dimensions and color counts', () => {
    const cases: [number, number, number, number][] = [
      [4, 4, 2, 7],
      [5, 5, 3, 11],
      [6, 5, 4, 21],
      [7, 7, 5, 314],
      [8, 6, 6, 1001],
    ];
    for (const [w, h, n, seed] of cases) {
      const lvl = generator.generate({ id: `c-${w}x${h}-${n}`, width: w, height: h, numColors: n, seed });
      assertValidLevel(lvl);
      expect(lvl.par).toBe(n);
      // Each color used exactly once.
      const used = new Set(lvl.solution?.map((s) => s.color));
      expect(used.size).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(used.has(FLOW_COLORS[i])).toBe(true);
      }
    }
  });

  it('rejects invalid inputs', () => {
    expect(() => generator.generate({ id: 'x', width: 0, height: 5, numColors: 2, seed: 1 })).toThrow();
    expect(() => generator.generate({ id: 'x', width: 5, height: 5, numColors: 0, seed: 1 })).toThrow();
    // 13 colors > palette size
    expect(() =>
      generator.generate({ id: 'x', width: 8, height: 8, numColors: 13, seed: 1 }),
    ).toThrow();
    // 4 colors need >= 8 cells but 3x2 has only 6
    expect(() =>
      generator.generate({ id: 'x', width: 3, height: 2, numColors: 4, seed: 1 }),
    ).toThrow();
  });
});

describe('LevelLoaderService.generateLevel', () => {
  let loader: LevelLoaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    loader = TestBed.inject(LevelLoaderService);
  });

  it('delegates to the generator and re-validates the result', () => {
    const lvl = loader.generateLevel({
      id: 'gen-1',
      name: 'Generated 1',
      width: 5,
      height: 5,
      numColors: 3,
      seed: 7,
    });
    assertValidLevel(lvl);
    expect(lvl.id).toBe('gen-1');
    expect(lvl.name).toBe('Generated 1');
  });
});
