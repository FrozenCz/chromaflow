import { CellState } from './cell-state';
import { Level } from './level';
import { PathSolution } from './path-solution';

export interface GameState {
  level: Level;
  cells: CellState[][];
  solutions: PathSolution[];
  moves: number;
  completed: boolean;
}
