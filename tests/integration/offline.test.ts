import { describe, expect, it } from 'vitest';
import wikidata from '../fixtures/wikidata.json' with { type: 'json' };
describe('fixtures offline', () => {
  it('cobre resposta com P94 e P41', () => {
    const b = wikidata.results.bindings[0]!;
    expect(b.brasao.value).toContain('Brasao');
    expect(b.bandeira.value).toContain('Bandeira');
  });
  it('permite ausência independente de P94/P41', () => {
    const without = { ...wikidata.results.bindings[0] };
    delete (without as Partial<typeof without>).brasao;
    expect('brasao' in without).toBe(false);
    expect('bandeira' in without).toBe(true);
  });
});
