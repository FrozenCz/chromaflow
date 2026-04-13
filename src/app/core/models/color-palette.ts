import { FlowColor } from './flow-color';

export interface ColorPaletteEntry {
  main: string;
  light: string;
}

export const COLOR_PALETTE: Record<FlowColor, ColorPaletteEntry> = {
  R: { main: '#e53935', light: '#ef9a9a' },
  B: { main: '#1e88e5', light: '#90caf9' },
  G: { main: '#43a047', light: '#a5d6a7' },
  A: { main: '#fdd835', light: '#fff59d' },
  P: { main: '#8e24aa', light: '#ce93d8' },
  T: { main: '#00897b', light: '#80cbc4' },
  K: { main: '#ec407a', light: '#f8bbd0' },
};
