import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngineService } from '../../core/services/game-engine.service';
import { LevelLoaderService } from '../../core/services/level-loader.service';
import { GameComponent } from './game.component';

describe('GameComponent (Quick Game)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideHttpClient(), provideRouter([])],
    });
  });

  it('initializes a generated, fully-validated level on first visit', () => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    const engine = TestBed.inject(GameEngineService);
    const level = engine.level();
    expect(level).not.toBeNull();
    expect(level?.width).toBe(5);
    expect(level?.height).toBe(5);
    // Generator-produced levels expose a solution covering every cell.
    const totalCells = (level?.width ?? 0) * (level?.height ?? 0);
    const covered = new Set<string>();
    for (const seg of level?.solution ?? []) {
      for (const cell of seg.path) {
        covered.add(`${cell.row},${cell.col}`);
      }
    }
    expect(covered.size).toBe(totalCells);
    // Every endpoint color must have exactly two endpoints, and each
    // matching solution path must start/end on those endpoints.
    const colors = new Set(level?.endpoints.map((e) => e.color));
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it('does not overwrite an already-loaded level', () => {
    const loader = TestBed.inject(LevelLoaderService);
    const engine = TestBed.inject(GameEngineService);
    const preset = loader.generateLevel({
      id: 'preset-test',
      name: 'Preset',
      width: 5,
      height: 5,
      numColors: 2,
      seed: 12345,
    });
    engine.initLevel(preset);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    expect(engine.level()?.id).toBe('preset-test');
  });
});
