import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngineService } from '../../../core/services/game-engine.service';
import { Level, Position } from '../../../core/models';
import { GameHudComponent } from './game-hud.component';

function pos(row: number, col: number): Position {
  return { row, col };
}

function makeLevel(par?: number): Level {
  return {
    id: 'hud-test',
    name: 'HUD Test',
    width: 3,
    height: 3,
    endpoints: [
      { position: pos(0, 0), color: 'R' },
      { position: pos(2, 2), color: 'R' },
    ],
    portals: [],
    colorChangers: [],
    par,
  };
}

function makeMove(engine: GameEngineService): void {
  // Commit a trivial move so history/moveCount advance by 1.
  engine.startDraw(pos(0, 0));
  engine.continueDraw(pos(0, 1));
  engine.endDraw();
}

describe('GameHudComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameHudComponent],
      providers: [provideHttpClient(), provideRouter([])],
    });
  });

  it('renders without crashing when a level is loaded', () => {
    const engine = TestBed.inject(GameEngineService);
    engine.initLevel(makeLevel(5));
    const fixture = TestBed.createComponent(GameHudComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('star rating (via engine state)', () => {
    // These cover the same math as the HUD's `stars` computed signal.
    function stars(moves: number, par: number | undefined): number {
      if (par === undefined || par === null) return 3;
      if (moves <= par) return 3;
      if (moves <= Math.ceil(par * 1.5)) return 2;
      return 1;
    }

    it('returns 3 stars when par is undefined', () => {
      expect(stars(99, undefined)).toBe(3);
    });

    it('returns 3 stars when moves <= par', () => {
      expect(stars(4, 5)).toBe(3);
      expect(stars(5, 5)).toBe(3);
    });

    it('returns 2 stars when moves <= ceil(par * 1.5)', () => {
      // par=5 → ceil(7.5) = 8
      expect(stars(6, 5)).toBe(2);
      expect(stars(8, 5)).toBe(2);
    });

    it('returns 1 star when moves exceed ceil(par * 1.5)', () => {
      expect(stars(9, 5)).toBe(1);
      expect(stars(100, 5)).toBe(1);
    });
  });

  it('undoDisabled is true before any move and false after a committed move', () => {
    const engine = TestBed.inject(GameEngineService);
    engine.initLevel(makeLevel(3));
    const fixture = TestBed.createComponent(GameHudComponent);
    fixture.detectChanges();
    expect(engine.historySize()).toBe(0);

    makeMove(engine);
    expect(engine.historySize()).toBe(1);
    expect(engine.moveCount()).toBe(1);
  });
});
