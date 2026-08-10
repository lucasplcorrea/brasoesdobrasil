import { describe, expect, it } from 'vitest';
import { notificationSearchParams } from '../../src/notificacoes/index.js';

describe('notificações', () => {
  it('gera parâmetros úteis para diagnosticar o erro', () => {
    expect(
      notificationSearchParams({
        event: 'download.falha',
        codigoIbge: '1302603',
        tipo: 'brasao',
        message: 'Input image exceeds pixel limit',
      }),
    ).toMatchObject({
      projeto: 'brasoes-do-brasil',
      event: 'download.falha',
      codigoIbge: '1302603',
      tipo: 'brasao',
      message: 'Input image exceeds pixel limit',
    });
  });
});
