import { FlowColor } from './flow-color';
import { Position } from './position';

export interface ColorChanger {
  position: Position;
  from: FlowColor;
  to: FlowColor;
}
