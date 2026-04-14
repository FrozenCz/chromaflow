import { Endpoint } from './endpoint';
import { FlowColor } from './flow-color';
import { Position } from './position';

export interface DrawingState {
  isDrawing: boolean;
  currentColor: FlowColor | null;
  /**
   * Active flow color at the current tail of `currentPath`, accounting for any
   * color changers the path has already passed through. Null when no draw is
   * in progress. Used by the engine to validate endpoint entry against the
   * *current* color rather than the original start color.
   */
  activeColor: FlowColor | null;
  currentPath: Position[];
  startEndpoint: Endpoint | null;
}
