import { Level } from '../../core/models';

export const DEMO_LEVEL: Level = {
  id: 'demo-5x5',
  name: 'Demo 5×5',
  width: 5,
  height: 5,
  endpoints: [
    { position: { row: 0, col: 0 }, color: 'R' },
    { position: { row: 4, col: 4 }, color: 'R' },
    { position: { row: 0, col: 4 }, color: 'B' },
    { position: { row: 4, col: 0 }, color: 'B' },
    { position: { row: 2, col: 2 }, color: 'G' },
    { position: { row: 2, col: 0 }, color: 'G' },
  ],
  portals: [],
  colorChangers: [],
};
