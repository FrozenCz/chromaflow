import { ColorChanger } from './color-changer';
import { Endpoint } from './endpoint';
import { PathSolution } from './path-solution';
import { PortalPair } from './portal-pair';
import { Position } from './position';

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  endpoints: Endpoint[];
  portals: PortalPair[];
  colorChangers: ColorChanger[];
  walls?: Position[];
  solution?: PathSolution[];
  par?: number;
}
