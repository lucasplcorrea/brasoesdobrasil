import { describe, expect, it } from 'vitest';
import { stateReviewSummary } from '../../src/relatorios/index.js';

describe('revisão por UF', () => {
  it('resume somente os municípios da UF solicitada', () => {
    const asset = (status: string) => ({ status, alteracoes: [], avisos: [] });
    const catalog = {
      schemaVersion: 1 as const,
      atualizadoEm: '2026-08-22T00:00:00.000Z',
      municipios: [
        {
          schemaVersion: 1 as const,
          codigoIbge: '1200013',
          municipio: 'Acrelândia',
          uf: 'AC',
          brasao: asset('revisao_pendente'),
          bandeira: asset('aprovado'),
        },
        {
          schemaVersion: 1 as const,
          codigoIbge: '1400100',
          municipio: 'Boa Vista',
          uf: 'RR',
          brasao: asset('nao_encontrado'),
          bandeira: asset('rejeitado'),
        },
      ],
    };
    expect(stateReviewSummary(catalog as never, 'AC')).toEqual({
      uf: 'AC',
      municipios: 1,
      pendentes: 1,
      aprovados: 1,
      faltantes: 0,
      excecoes: 0,
    });
  });
});
