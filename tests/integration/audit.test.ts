import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditCatalog } from '../../src/catalogo/auditoria.js';
import sharp from 'sharp';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brasoes-audit-'));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'assets/originais/brasoes/MG'), { recursive: true });
  await writeFile(
    path.join(root, 'data/catalogo.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      atualizadoEm: '2026-08-22T00:00:00.000Z',
      municipios: [
        {
          schemaVersion: 1,
          codigoIbge: '3100203',
          municipio: 'Abaeté',
          uf: 'MG',
          brasao: { status: 'revisao_pendente', alteracoes: [], avisos: [] },
          bandeira: { status: 'nao_encontrado', alteracoes: [], avisos: [] },
        },
      ],
    })}\n`,
  );
  return root;
}

describe('auditoria do catálogo', () => {
  it('detecta status terminal sem arquivos e arquivo órfão', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'assets/originais/brasoes/MG/orfao.txt'), 'órfão');
    const report = await auditCatalog({ root, hashes: false });
    expect(report.problemas.map((problem) => problem.codigo)).toEqual(
      expect.arrayContaining(['asset_terminal_sem_arquivo', 'arquivo_orfao']),
    );
    expect(report.resumo).toMatchObject({ municipios: 1, erros: 1, avisos: 1 });
  });

  it('reconhece SVG com declaração XML', async () => {
    const root = await fixture();
    const original = 'assets/originais/brasoes/MG/3100203.svg';
    const normalized = 'assets/normalizados/brasoes/MG/3100203.jpg';
    await mkdir(path.join(root, 'assets/normalizados/brasoes/MG'), { recursive: true });
    await writeFile(
      path.join(root, original),
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    );
    await sharp({ create: { width: 192, height: 192, channels: 3, background: 'white' } })
      .jpeg()
      .toFile(path.join(root, normalized));
    const catalogFile = path.join(root, 'data/catalogo.json');
    const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
    Object.assign(catalog.municipios[0].brasao, {
      arquivoOriginalLocal: original,
      arquivoNormalizadoLocal: normalized,
      paginaOrigem: 'https://commons.wikimedia.org/wiki/File:Teste.svg',
      urlOriginal: 'https://upload.wikimedia.org/teste.svg',
      licenca: 'Public domain',
      mime: 'image/svg+xml',
    });
    await writeFile(catalogFile, `${JSON.stringify(catalog)}\n`);
    const report = await auditCatalog({ root, hashes: false });
    expect(report.resumo.erros).toBe(0);
  });
});
