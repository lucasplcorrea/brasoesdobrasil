import { describe, expect, it } from 'vitest';
import valid from '../fixtures/ibge-valid.json' with { type: 'json' };
import invalid from '../fixtures/ibge-invalid.json' with { type: 'json' };
import { normalizeIbge } from '../../src/ibge/index.js';

describe('IBGE', () => {
  it('valida, preserva acentos e normaliza código/UF', () =>
    expect(normalizeIbge(valid)).toEqual([
      { codigoIbge: '3100203', municipio: 'Abaeté', uf: 'MG' },
      { codigoIbge: '3500600', municipio: 'Águas de São Pedro', uf: 'SP' },
    ]));
  it('rejeita código fora de sete dígitos', () =>
    expect(() => normalizeIbge(invalid)).toThrow(/inválido/i));
  it('rejeita código duplicado mesmo com homônimos', () =>
    expect(() => normalizeIbge([valid[0], { ...valid[0], nome: 'Abaeté homônima' }])).toThrow(
      /duplicado/i,
    ));
  it('aceita municípios homônimos em UFs distintas quando os códigos diferem', () =>
    expect(normalizeIbge([valid[0], { ...valid[1], nome: 'Abaeté' }])).toHaveLength(2));
  it('obtém a UF pela região imediata quando a microrregião é nula', () =>
    expect(
      normalizeIbge([
        {
          id: 5101837,
          nome: 'Boa Esperança do Norte',
          microrregiao: null,
          'regiao-imediata': { 'regiao-intermediaria': { UF: { sigla: 'MT' } } },
        },
      ]),
    ).toEqual([{ codigoIbge: '5101837', municipio: 'Boa Esperança do Norte', uf: 'MT' }]));
});
