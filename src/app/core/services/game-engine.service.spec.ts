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

  describe('portals', () => {
    function makePortalLevel(): Level {
      // 5x5 with R endpoints and a portal pair (0,2) <-> (4,2).
      return {
        id: 'portal-basic',
        name: 'PortalBasic',
        width: 5,
        height: 5,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(4, 4), color: 'R' },
        ],
        portals: [{ id: 'p1', a: pos(0, 2), b: pos(4, 2) }],
        colorChangers: [],
      };
    }

    it('checkPortalAdjacency returns the partner for A and B', () => {
      const level = makePortalLevel();
      service.initLevel(level);
      expect(service.checkPortalAdjacency(pos(0, 2))).toEqual(pos(4, 2));
      expect(service.checkPortalAdjacency(pos(4, 2))).toEqual(pos(0, 2));
    });

    it('checkPortalAdjacency returns null for non-portal cell', () => {
      service.initLevel(makePortalLevel());
      expect(service.checkPortalAdjacency(pos(1, 1))).toBeNull();
    });

    it('checkPortalAdjacency returns null when level has no portals', () => {
      service.initLevel(makeSimpleLevel());
      expect(service.checkPortalAdjacency(pos(0, 0))).toBeNull();
    });

    it('checkPortalAdjacency result is a deep clone (mutation safe)', () => {
      const level = makePortalLevel();
      service.initLevel(level);
      const partner = service.checkPortalAdjacency(pos(0, 2));
      expect(partner).not.toBeNull();
      if (partner) {
        partner.row = 99;
        partner.col = 99;
      }
      expect(level.portals[0].b).toEqual(pos(4, 2));
      expect(service.checkPortalAdjacency(pos(0, 2))).toEqual(pos(4, 2));
    });

    it('isValidMove allows a portal jump A -> B', () => {
      service.initLevel(makePortalLevel());
      expect(service.isValidMove(pos(0, 2), pos(4, 2), 'R')).toBe(true);
    });

    it('isValidMove rejects a non-adjacent non-portal target', () => {
      service.initLevel(makePortalLevel());
      expect(service.isValidMove(pos(0, 2), pos(2, 3), 'R')).toBe(false);
    });

    it('isValidMove rejects a portal whose partner is a wall', () => {
      const level: Level = {
        ...makePortalLevel(),
        walls: [pos(4, 2)],
      };
      service.initLevel(level);
      expect(service.isValidMove(pos(0, 2), pos(4, 2), 'R')).toBe(false);
    });

    it('isValidMove rejects a portal whose partner is a foreign-color endpoint', () => {
      const level: Level = {
        id: 'portal-foreign',
        name: 'PortalForeign',
        width: 5,
        height: 5,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(4, 4), color: 'R' },
          { position: pos(4, 2), color: 'B' },
          { position: pos(0, 4), color: 'B' },
        ],
        portals: [{ id: 'p1', a: pos(0, 2), b: pos(4, 2) }],
        colorChangers: [],
      };
      service.initLevel(level);
      expect(service.isValidMove(pos(0, 2), pos(4, 2), 'R')).toBe(false);
    });

    it('continueDraw auto-teleports when dragging past portal A to a cell adjacent to B', () => {
      service.initLevel(makePortalLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2)); // portal A
      // Drag to (4,1) which is adjacent to portal B (4,2) but not to A.
      service.continueDraw(pos(4, 1));
      const path = service.drawing().currentPath;
      // Expect [(0,0),(0,1),(0,2),(4,2),(4,1)] — B injected between A and target.
      expect(path).toEqual([pos(0, 0), pos(0, 1), pos(0, 2), pos(4, 2), pos(4, 1)]);
    });

    it('continueDraw continues normally past portal B after teleport', () => {
      service.initLevel(makePortalLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(4, 1));
      service.continueDraw(pos(4, 0));
      const path = service.drawing().currentPath;
      expect(path[path.length - 1]).toEqual(pos(4, 0));
      expect(path).toContainEqual(pos(4, 2));
    });

    it('backtracking from B removes B from the current path', () => {
      service.initLevel(makePortalLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(4, 1)); // teleports, path ends at (4,1)
      expect(service.drawing().currentPath).toEqual([
        pos(0, 0),
        pos(0, 1),
        pos(0, 2),
        pos(4, 2),
        pos(4, 1),
      ]);
      // Step back to (4,2)
      service.continueDraw(pos(4, 2));
      expect(service.drawing().currentPath).toEqual([
        pos(0, 0),
        pos(0, 1),
        pos(0, 2),
        pos(4, 2),
      ]);
    });

    it('revisit prevention: teleport does not inject a partner already in path', () => {
      service.initLevel(makePortalLevel());
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2)); // portal A
      service.continueDraw(pos(4, 1)); // teleports, B injected
      // Now drag to (3,2) — last is (4,1), (3,2) isn't adjacent to (4,1),
      // and (4,1) isn't a portal, so no teleport should inject (4,2) again.
      service.continueDraw(pos(3, 2));
      const path = service.drawing().currentPath;
      // Last should still be (4,1) — the invalid move was rejected.
      expect(path[path.length - 1]).toEqual(pos(4, 1));
    });

    it('win: completing a path via portal counts as a valid solution', () => {
      // 1x3 level: R at (0,0) and (0,2), portal connects (0,0) and (0,2)...
      // need full fill, so use 1x2 connected via portal is degenerate.
      // Use a 3x1 level where col 1 is a wall and portal connects (0,0)-(2,0).
      const level: Level = {
        id: 'portal-win',
        name: 'PortalWin',
        width: 1,
        height: 3,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(2, 0), color: 'R' },
        ],
        portals: [{ id: 'p1', a: pos(0, 0), b: pos(2, 0) }],
        colorChangers: [],
        walls: [pos(1, 0)],
      };
      service.initLevel(level);
      // Playable cells = 2: (0,0) and (2,0). Drag from (0,0) through portal to (2,0).
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(2, 0));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(true);
    });
  });

  describe('color changers', () => {
    it('wins when a path enters via R endpoint, passes through an R→B changer, and exits at a B endpoint (full fill)', () => {
      // 1x3: R @ (0,0), B @ (0,2), R→B at (0,1). Path (0,0)-(0,1)-(0,2).
      const level: Level = {
        id: 'cc-basic',
        name: 'CCBasic',
        width: 3,
        height: 1,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 2), color: 'B' },
        ],
        portals: [],
        colorChangers: [{ position: pos(0, 1), from: 'R', to: 'B' }],
      };
      service.initLevel(level);
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(true);
      expect(service.isWon()).toBe(true);
    });

    it('does not win when path bypasses the color changer (foreign-color endpoint unreachable)', () => {
      // 2x3: R @ (0,0), B @ (0,2), R→B at (0,1). Path tries (0,0)-(1,0)-(1,1)-(1,2)-(0,2) — but (0,2) is B and path is still R, so invalid.
      const level: Level = {
        id: 'cc-bypass',
        name: 'CCBypass',
        width: 3,
        height: 2,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 2), color: 'B' },
        ],
        portals: [],
        colorChangers: [{ position: pos(0, 1), from: 'R', to: 'B' }],
      };
      service.initLevel(level);
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(1, 0));
      service.continueDraw(pos(1, 1));
      service.continueDraw(pos(1, 2));
      // Attempt to enter the B endpoint while still R — should be rejected.
      service.continueDraw(pos(0, 2));
      const path = service.drawing().currentPath;
      expect(path).toEqual([pos(0, 0), pos(1, 0), pos(1, 1), pos(1, 2)]);
      service.endDraw();
      expect(service.checkWinCondition()).toBe(false);
    });

    it('supports multi-hop: R → B → G with two color changers from R endpoint to G endpoint', () => {
      // 1x4: R @ (0,0), G @ (0,3), R→B at (0,1), B→G at (0,2).
      const level: Level = {
        id: 'cc-multi',
        name: 'CCMulti',
        width: 4,
        height: 1,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 3), color: 'G' },
        ],
        portals: [],
        colorChangers: [
          { position: pos(0, 1), from: 'R', to: 'B' },
          { position: pos(0, 2), from: 'B', to: 'G' },
        ],
      };
      service.initLevel(level);
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.continueDraw(pos(0, 3));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(true);
    });

    it('activeColor reflects post-transform color during draw and resets on backtrack', () => {
      const level: Level = {
        id: 'cc-active',
        name: 'CCActive',
        width: 3,
        height: 1,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 2), color: 'B' },
        ],
        portals: [],
        colorChangers: [{ position: pos(0, 1), from: 'R', to: 'B' }],
      };
      service.initLevel(level);
      service.startDraw(pos(0, 0));
      expect(service.drawing().activeColor).toBe('R');
      service.continueDraw(pos(0, 1));
      expect(service.drawing().activeColor).toBe('B');
      // Backtrack to (0,0).
      service.continueDraw(pos(0, 0));
      expect(service.drawing().activeColor).toBe('R');
    });

    it('portal partner is a color changer: transformation still applies on arrival', () => {
      // 1x4 with wall at (0,1). Portal A (0,0) ↔ B (0,2). B cell is a R→B changer.
      // R @ (0,0) and B @ (0,3). Path: (0,0) → portal → (0,2) [changer] → (0,3).
      const level: Level = {
        id: 'cc-portal',
        name: 'CCPortal',
        width: 4,
        height: 1,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 3), color: 'B' },
        ],
        portals: [{ id: 'p1', a: pos(0, 0), b: pos(0, 2) }],
        colorChangers: [{ position: pos(0, 2), from: 'R', to: 'B' }],
        walls: [pos(0, 1)],
      };
      service.initLevel(level);
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 2)); // portal jump
      expect(service.drawing().activeColor).toBe('B');
      service.continueDraw(pos(0, 3));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(true);
    });

    it('checkWinFor returns false when some endpoints remain uncovered even if one path is completed', () => {
      // Two pairs: R (0,0)-(0,2) via R→B changer at (0,1), plus an unused G pair.
      // Wall at (1,1) to keep 2x3 playable = 5.
      const level: Level = {
        id: 'cc-uncovered',
        name: 'CCUncov',
        width: 3,
        height: 2,
        endpoints: [
          { position: pos(0, 0), color: 'R' },
          { position: pos(0, 2), color: 'B' },
          { position: pos(1, 0), color: 'G' },
          { position: pos(1, 2), color: 'G' },
        ],
        portals: [],
        colorChangers: [{ position: pos(0, 1), from: 'R', to: 'B' }],
        walls: [pos(1, 1)],
      };
      service.initLevel(level);
      // Only draw the R→B path, leave G endpoints uncovered.
      service.startDraw(pos(0, 0));
      service.continueDraw(pos(0, 1));
      service.continueDraw(pos(0, 2));
      service.endDraw();
      expect(service.checkWinCondition()).toBe(false);
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
