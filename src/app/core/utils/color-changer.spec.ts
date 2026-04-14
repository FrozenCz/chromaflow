import { ColorChanger, Level, Position } from '../models';
import {
  colorChangerAt,
  computePathColorSegments,
  pathEndColor,
  transformColor,
} from './color-changer';

function pos(row: number, col: number): Position {
  return { row, col };
}

function makeLevel(colorChangers: ColorChanger[] = []): Level {
  return {
    id: 'cc-test',
    name: 'cc-test',
    width: 5,
    height: 1,
    endpoints: [
      { position: pos(0, 0), color: 'R' },
      { position: pos(0, 4), color: 'B' },
    ],
    portals: [],
    colorChangers,
  };
}

describe('color-changer helpers', () => {
  describe('transformColor', () => {
    it('returns the input color when no changer is provided', () => {
      expect(transformColor('R', null)).toBe('R');
    });

    it('maps matching from → to', () => {
      const cc: ColorChanger = { position: pos(0, 2), from: 'R', to: 'B' };
      expect(transformColor('R', cc)).toBe('B');
    });

    it('leaves non-matching color untouched', () => {
      const cc: ColorChanger = { position: pos(0, 2), from: 'R', to: 'B' };
      expect(transformColor('G', cc)).toBe('G');
    });
  });

  describe('colorChangerAt', () => {
    it('returns the changer at the given position', () => {
      const cc: ColorChanger = { position: pos(0, 2), from: 'R', to: 'B' };
      const level = makeLevel([cc]);
      expect(colorChangerAt(level, pos(0, 2))).toBe(cc);
    });

    it('returns null when no changer exists at that cell', () => {
      const level = makeLevel([{ position: pos(0, 2), from: 'R', to: 'B' }]);
      expect(colorChangerAt(level, pos(0, 1))).toBeNull();
    });
  });

  describe('computePathColorSegments', () => {
    it('returns constant color when no changers are present', () => {
      const level = makeLevel();
      const path = [pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3), pos(0, 4)];
      const segments = computePathColorSegments(path, level, 'R');
      expect(segments).toEqual(['R', 'R', 'R', 'R', 'R']);
    });

    it('flips color at a single changer in the middle of the path', () => {
      const level = makeLevel([{ position: pos(0, 2), from: 'R', to: 'B' }]);
      const path = [pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3), pos(0, 4)];
      const segments = computePathColorSegments(path, level, 'R');
      expect(segments).toEqual(['R', 'R', 'B', 'B', 'B']);
    });

    it('chains two changers (multi-hop R → B → G)', () => {
      const level = makeLevel([
        { position: pos(0, 1), from: 'R', to: 'B' },
        { position: pos(0, 3), from: 'B', to: 'G' },
      ]);
      const path = [pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3), pos(0, 4)];
      const segments = computePathColorSegments(path, level, 'R');
      expect(segments).toEqual(['R', 'B', 'B', 'G', 'G']);
    });

    it('ignores a changer whose `from` does not match the active color', () => {
      const level = makeLevel([{ position: pos(0, 2), from: 'G', to: 'B' }]);
      const path = [pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3), pos(0, 4)];
      const segments = computePathColorSegments(path, level, 'R');
      expect(segments).toEqual(['R', 'R', 'R', 'R', 'R']);
    });
  });

  describe('pathEndColor', () => {
    it('returns startColor for empty paths', () => {
      const level = makeLevel();
      expect(pathEndColor([], level, 'R')).toBe('R');
    });

    it('returns the final transformed color', () => {
      const level = makeLevel([{ position: pos(0, 2), from: 'R', to: 'B' }]);
      const path = [pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3)];
      expect(pathEndColor(path, level, 'R')).toBe('B');
    });
  });
});
