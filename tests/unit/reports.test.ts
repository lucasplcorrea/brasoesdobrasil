import { describe, expect, it } from 'vitest';
import { plainCommonsText } from '../../src/commons/index.js';
import { cleanReportText } from '../../src/relatorios/index.js';

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
});
