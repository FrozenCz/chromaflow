import { FlowColor } from './flow-color';
import { Position } from './position';

export interface CellState {
  position: Position;
  color: FlowColor | null;
  isEndpoint: boolean;
  isPortal: boolean;
  isColorChanger: boolean;
}
