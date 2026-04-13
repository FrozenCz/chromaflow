import { FlowColor } from './flow-color';
import { Position } from './position';

export interface PathSolution {
  color: FlowColor;
  path: Position[];
}
