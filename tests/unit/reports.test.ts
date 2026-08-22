import { describe, expect, it } from 'vitest';
import { plainCommonsText } from '../../src/commons/index.js';
import { cleanReportText, pendingMunicipalities } from '../../src/relatorios/index.js';
import type { Catalog } from '../../src/model.js';

describe('texto dos relatórios', () => {
  it('remove style e HTML dos metadados do Commons', () => {
    expect(
      plainCommonsText(
        '<b>Own work</b><style>.mw-parser-output{x:y}</style> Autor &amp; Município',
      ),
    ).toBe('Own work Autor & Município');
  });

  it('usa fallback para valor vazio e remove CSS legado', () => {
    expect(cleanReportText('  ', 'não informado')).toBe('não informado');
    expect(cleanReportText('Own work .mw-parser-output{x:y} texto', 'não informado')).toBe(
      'Own work texto',
    );
  });

  it('lista somente municípios pendentes e exclui o Acre', () => {
    const asset = (status: 'aprovado' | 'revisao_pendente') => ({
      status,
      alteracoes: [],
      avisos: [],
    });
    const catalog = {
      schemaVersion: 1,
      atualizadoEm: '2026-08-22T00:00:00.000Z',
      municipios: [
        {
          schemaVersion: 1,
          codigoIbge: '1200013',
          municipio: 'Acrelândia',
          uf: 'AC',
          brasao: asset('revisao_pendente'),
          bandeira: asset('revisao_pendente'),
        },
        {
          schemaVersion: 1,
          codigoIbge: '2700102',
          municipio: 'Água Branca',
          uf: 'AL',
          brasao: asset('aprovado'),
          bandeira: asset('revisao_pendente'),
        },
        {
          schemaVersion: 1,
          codigoIbge: '2700201',
          municipio: 'Anadia',
          uf: 'AL',
          brasao: asset('aprovado'),
          bandeira: asset('aprovado'),
        },
      ],
    } satisfies Catalog;

    expect(pendingMunicipalities(catalog)).toEqual([
      {
        codigoIbge: '2700102',
        municipio: 'Água Branca',
        uf: 'AL',
        pendencias: [{ tipo: 'bandeira', status: 'revisao_pendente' }],
      },
    ]);
  });
});
