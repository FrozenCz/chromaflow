import { PORTAL_COLORS, portalColorFor } from './portal-colors';

describe('portalColorFor', () => {
  it('is deterministic for the same id', () => {
    expect(portalColorFor('p1')).toBe(portalColorFor('p1'));
    expect(portalColorFor('abc')).toBe(portalColorFor('abc'));
  });

  it('always returns a color from the palette', () => {
    for (const id of ['a', 'b', 'c', 'portal-1', 'portal-42', 'xyz']) {
      expect(PORTAL_COLORS).toContain(portalColorFor(id));
    }
  });

  it('spreads different ids across the palette', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(portalColorFor(`portal-${i}`));
    }
    // With 6 palette entries and 50 distinct inputs we should cover >1 bucket.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('exposes a non-empty palette', () => {
    expect(PORTAL_COLORS.length).toBeGreaterThan(0);
  });
});
