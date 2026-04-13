import { Endpoint } from './endpoint';
import { FlowColor } from './flow-color';
import { Position } from './position';

export interface DrawingState {
  isDrawing: boolean;
  currentColor: FlowColor | null;
  currentPath: Position[];
  startEndpoint: Endpoint | null;
}
