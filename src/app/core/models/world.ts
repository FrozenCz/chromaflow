import { Level } from './level';

export interface WorldMetadata {
  id: string;
  name: string;
  description?: string;
  order: number;
}

export interface World {
  metadata: WorldMetadata;
  levels: Level[];
}
