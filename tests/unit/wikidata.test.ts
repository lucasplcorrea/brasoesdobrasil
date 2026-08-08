import { describe, expect, it } from 'vitest';
import { discoveryQuery } from '../../src/wikidata/index.js';
describe('Wikidata', () => {
  it('consulta P1585, P94 e P41', () => {
    const q = discoveryQuery(['3100203']);
    expect(q).toContain('wdt:P1585');
    expect(q).toContain('wdt:P94');
    expect(q).toContain('wdt:P41');
  });
  it('não associa apenas por nome', () =>
    expect(discoveryQuery(['3100203'])).not.toMatch(/rdfs:label/));
});
