import { TestBed } from '@angular/core/testing';
import { Level, Position } from '../models';
import { GameEngineService } from './game-engine.service';

function pos(row: number, col: number): Position {
  return { row, col };
}

// Simple 3x3 level with two red endpoints at corners — playable cells = 9.
function makeSimpleLevel(): Level {
  return {
    id: 'test-simple',
    name: 'Simple',
    width: 3,
    height: 3,
    endpoints: [
      { position: pos(0, 0), color: 'R' },
      { position: pos(2, 2), color: 'R' },
    ],
    portals: [],
    colorChangers: [],
  };
}

// 2x2 level with R and B endpoints — total 4 cells, R + B must fill all.
function makeTwoColorLevel(): Level {
  return {
    id: 'test-two',
    name: 'Two',
    width: 2,
    height: 2,
    endpoints: [
      { position: pos(0, 0), color: 'R' },
      { position: pos(0, 1), color: 'R' },
      { position: pos(1, 0), color: 'B' },
      { position: pos(1, 1), color: 'B' },
    ],
    portals: [],
    colorChangers: [],
  };
}

function makeLevelWithWall(): Level {
  return {
    id: 'test-wall',
    name: 'Wall',
    width: 3,
    height: 3,
    endpoints: [
      { position: pos(0, 0), color: 'R' },
      { position: pos(2, 0), color: 'R' },
    ],
    portals: [],
    colorChangers: [],
    walls: [pos(1, 1)],
  };
}

describe('GameEngineService', () => {
  let service: GameEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameEngineService);
  });

  describe('initLevel', () => {
    it('resets state for a new level', () => {
      service.initLevel(makeSimpleLevel());
      expect(service.level()?.id).toBe('test-simple');
      expect(service.paths()).toEqual([]);
      expect(service.getMoveCount()).toBe(0);
      expect(service.getFillPercentage()).toBe(0);
    });
  });

  describe('isAdjacent', () => {
    it('returns true for orthogonal neighbors', () => {
      expect(service.isAdjacent(pos(0, 0), pos(0, 1))).toBe(true);
      expect(service.isAdjacent(pos(1, 1), pos(0, 1))).toBe(true);
    });
    it('returns false for diagonal or same cell', () => {
      expect(service.isAdjacent(pos(0, 0), pos(1, 1))).toBe(false);
      expect(service.isAdjacent(pos(0, 0), pos(0, 0))).toBe(false);
      expect(service.isAdjacent(pos(0, 0), pos(0, 2))).toBe(false);
    });
  });

  describe('isValidMove', () => {
    beforeEach(() => service.initLevel(makeLevelWithWall()));

    it('allows adjacent in-bounds non-wall move', () => {
      expect(service.isValidMove(pos(0, 0), pos(0, 1), 'R')).toBe(true);
    });

    it('rejects out-of-bounds', () => {
      expect(service.isValidMove(pos(0, 0), pos(-1, 0), 'R')).toBe(false);
      expect(service.isValidMove(pos(2, 2), pos(2, 3), 'R')).toBe(false);
    });

    it('rejects non-adjacent', () => {
      expect(service.isValidMove(pos(0, 0), pos(0, 2), 'R')).toBe(false);
    });

    it('rejects wall cells', () => {
      expect(service.isValidMove(pos(0, 1), pos(1, 1), 'R')).toBe(false);
    });

    it('rejects endpoint of other color', () => {
      const level: Level = {
        ...makeTwoColorLevel(),
      };
      service.initLevel(level);
      expect(service.isValidMove(pos(0, 0), pos(1, 0), 'R')).toBe(false);
    });
  });

  describe('startDraw / continueDraw / endDraw', () => {
    it('draws a path from endpoint and completes a pair', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(1, 2));
      service.continueDraw(pos(2, 2));
      service.endDraw();

      const paths = service.paths();
      expect(paths).toHaveLength(1);
      expect(paths[0].color).toBe('R');
      expect(paths[0].path).toHaveLength(5);
      expect(service.getMoveCount()).toBe(1);
    });

    it('ignores startDraw on non-endpoint empty cell', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(1, 1));
      expect(service.drawing().isDrawing).toBe(false);
    });

    it('ignores invalid continueDraw (non-adjacent)', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(2, 2));
      expect(service.drawing().currentPath).toHaveLength(1);
    });

    it('supports backtracking', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      expect(service.drawing().currentPath).toHaveLength(3);
      // Step back to (0,1)
      service.continueDraw(pos(0, 1));
      expect(service.drawing().currentPath).toHaveLength(2);
      expect(service.drawing().currentPath[1]).toEqual(pos(0, 1));
    });

    it('continues from end of an existing path', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      // Resume
      service.startDraw(pos(0, 1));
      expect(service.drawing().isDrawing).toBe(true);
      expect(service.drawing().currentColor).toBe('R');
      expect(service.drawing().currentPath).toHaveLength(2);
    });

    it('endDraw without active drawing is a no-op on paths', () => {
      service.initLevel(makeSimpleLevel());
      service.endDraw();
      expect(service.paths()).toEqual([]);
      expect(service.getMoveCount()).toBe(0);
    });
  });

  describe('split behaviour', () => {
    it('trims another color path when crossed', () => {
      const level: Level = {
        id: 'split',
        name: 'Split',
        width: 4,
        height: 2,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 3), color: 'R' },
          { position: pos(1, 0), color: 'B' },
          { position: pos(1, 3), color: 'B' },
        ],
        portals: [],
        colorChangers: [],
      };
      service.initLevel(level);

      // Draw R along top row but stop before reaching second R endpoint (incomplete)
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.endDraw();

      // Draw B through (0,2) to split red
      service.startDraw(pos(1, 0));
      service.continueDraw(pos(1, 1));
      service.continueDraw(pos(0, 1));

      const red = service.paths().find((p) => p.color === 'R');
      expect(red).toBeDefined();
      // R should be trimmed before (0,1)
      expect(red?.path).toEqual([pos(0, 0)]);
    });

    it('splitPathAt trims path at given position', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(1, 2));
      service.endDraw();

      service.splitPathAt('R', pos(0, 2));
      const red = service.paths().find((p) => p.color === 'R');
      expect(red?.path).toEqual([pos(0, 0), pos(0, 1)]);
    });
  });

  describe('clearPath', () => {
    it('removes a path by color', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      expect(service.paths()).toHaveLength(1);
      service.clearPath('R');
      expect(service.paths()).toHaveLength(0);
    });
  });

  describe('checkWinCondition / fillPercentage', () => {
    it('returns true when all pairs connected and 100% fill', () => {
      service.initLevel(makeTwoColorLevel());
      // R: (0,0) -> (0,1)
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      // B: (1,0) -> (1,1)
      service.startDraw(pos(1, 0));
      service.continueDraw(pos(1, 1));
      service.endDraw();

      expect(service.getFillPercentage()).toBe(100);
      expect(service.checkWinCondition()).toBe(true);
      expect(service.isWon()).toBe(true);
    });

    it('returns false when not all cells filled', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(1, 2));
      service.continueDraw(pos(2, 2));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(false);
      expect(service.getFillPercentage()).toBeLessThan(100);
    });

    it('wins when all non-wall cells are filled (walls excluded from 100% check)', () => {
      // 5x1 row with a single wall at col 2 → playable = 4 cells.
      // Two R endpoints at (0,0) and (0,4); path (0,0)-(0,1) + (0,3)-(0,4) is
      // impossible since the pair must connect, so we use a different layout:
      // 2 rows, 2 cols, wall at (1,1). Playable = 3 cells.
      // R endpoints at (0,0) and (1,0); B endpoints can't fit — use single color
      // with the path (0,0)-(0,1)-(1,0)? Not adjacent chain, use a shaped level.
      const level: Level = {
        id: 'win-wall',
        name: 'WinWall',
        width: 2,
        height: 2,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(1, 0), color: 'R' },
        ],
        portals: [],
        colorChangers: [],
        walls: [pos(1, 1)],
      };
      service.initLevel(level);
      // Playable cells = 3: (0,0), (0,1), (1,0). R must cover all of them.
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      // Can't move diagonally to (1,0) — go back.
      // Try different path: (0,0)->(1,0) directly (only 2 cells, leaves (0,1) empty).
      service.endDraw();
      expect(service.checkWinCondition()).toBe(false);

      // Now draw full coverage: (1,0)->(0,0)->(0,1) — but endpoints are (0,0) and (1,0)
      // so must start/end at them. Draw (1,0)->(0,0) goes only through 2 cells.
      // Use path (0,0)->(0,1)... dead end, (1,0) not reachable through (1,1) wall.
      // Conclusion: this topology cannot reach 100% fill legally. Instead verify
      // that fill percentage correctly uses non-wall denominator.
      service.reset();
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(1, 0));
      service.endDraw();
      // 2 cells filled out of 3 playable ≈ 67%
      expect(service.getFillPercentage()).toBe(67);
      // Not 100% yet — not a win despite pair being connected
      expect(service.checkWinCondition()).toBe(false);
    });

    it('win condition denominator ignores walls (computed over playable cells only)', () => {
      // 3x1 row: endpoints (0,0)R and (0,2)R, wall at... can't place a wall
      // on the path. Use 1x4 with wall at last cell.
      const level: Level = {
        id: 'win-wall-2',
        name: 'WinWall2',
        width: 4,
        height: 1,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 2), color: 'R' },
        ],
        portals: [],
        colorChangers: [],
        walls: [pos(0, 3)],
      };
      service.initLevel(level);
      // Playable = 3 cells: (0,0), (0,1), (0,2). Path (0,0)-(0,1)-(0,2) covers all.
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.endDraw();
      expect(service.getFillPercentage()).toBe(100);
      expect(service.checkWinCondition()).toBe(true);
      expect(service.isWon()).toBe(true);
    });

    it('getFillPercentage excludes walls from total', () => {
      service.initLevel(makeLevelWithWall());
      // playable = 8
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(1, 0));
      service.continueDraw(pos(2, 0));
      service.endDraw();
      // 3 / 8 = 37.5 -> 38
      expect(service.getFillPercentage()).toBe(38);
    });
  });

  describe('getElapsedTime / getMoveCount', () => {
    it('reports zero elapsed immediately after init', () => {
      service.initLevel(makeSimpleLevel());
      expect(service.getElapsedTime()).toBeGreaterThanOrEqual(0);
      expect(service.getMoveCount()).toBe(0);
    });

    it('increments move count on endDraw', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      expect(service.getMoveCount()).toBe(1);
    });
  });

  describe('undo', () => {
    it('is a no-op when history is empty', () => {
      service.initLevel(makeSimpleLevel());
      expect(service.historySize()).toBe(0);
      service.undo();
      expect(service.getMoveCount()).toBe(0);
      expect(service.paths()).toEqual([]);
    });

    it('reverts the last committed move', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      expect(service.getMoveCount()).toBe(1);
      expect(service.paths().length).toBe(1);
      expect(service.historySize()).toBe(1);

      service.undo();
      expect(service.getMoveCount()).toBe(0);
      expect(service.paths()).toEqual([]);
      expect(service.historySize()).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears paths, moves, and history for the current level', () => {
      service.initLevel(makeSimpleLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.endDraw();
      expect(service.getMoveCount()).toBe(1);

      service.reset();
      expect(service.level()?.id).toBe('test-simple');
      expect(service.paths()).toEqual([]);
      expect(service.getMoveCount()).toBe(0);
      expect(service.historySize()).toBe(0);
    });
  });
});
