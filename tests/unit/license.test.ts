import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/commons-license.json' with { type: 'json' };
import { normalizeLicense } from '../../src/licenciamento/index.js';

describe('licenças', () => {
  it.each([
    ['CC BY', fixture.ccBy],
    ['CC BY-SA', fixture.ccBySa],
  ])('%s exige atribuição', (_, x) => expect(normalizeLicense(x).attribution).toBe(true));
  it('reconhece domínio público e preserva o motivo/template', () =>
    expect(normalizeLicense(fixture.publicDomain)).toMatchObject({
      status: 'ok',
      publicDomain: true,
      attribution: false,
      reason: 'PD-BrazilGov',
    }));
  it('mantém licença desconhecida pendente', () =>
    expect(normalizeLicense(fixture.unknown).status).toBe('pendente'));
  it('aceita URL absoluta de licença', () =>
    expect(normalizeLicense(fixture.ccBy).url).toMatch(/^https:/));
});
