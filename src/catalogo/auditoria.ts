import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { opendir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { ROOT, paths } from '../config.js';
import type { Asset, CatalogEntry } from '../model.js';
import { loadCatalog } from './index.js';
import { writeJsonAtomic, writeTextAtomic } from '../io.js';

type AssetKind = 'brasao' | 'bandeira';
type Severity = 'erro' | 'aviso';

export type AuditIssue = {
  severidade: Severity;
  codigo: string;
  mensagem: string;
  codigoIbge?: string;
  tipo?: AssetKind;
  arquivo?: string;
};

export type AuditReport = {
  schemaVersion: 1;
  geradoEm: string;
  hashesVerificados: boolean;
  resumo: {
    municipios: number;
    referenciasOriginais: number;
    referenciasNormalizados: number;
    arquivosOriginais: number;
    arquivosNormalizados: number;
    erros: number;
    avisos: number;
  };
  problemas: AuditIssue[];
};

const terminalWithAsset = new Set(['revisao_pendente', 'aprovado']);
const allowedMime = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/gif',
  'image/webp',
]);

async function hashFile(file: string, algorithm: 'sha1' | 'sha256'): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string) {
    let entries;
    try {
      entries = await opendir(current);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for await (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await visit(directory);
  return files.sort();
}

function safeLocalPath(root: string, relative: string): string | undefined {
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : undefined;
}

async function detectedMime(file: string): Promise<string | undefined> {
  const detected = await fileTypeFromFile(file);
  if (detected && detected.mime !== 'application/xml') return detected.mime;
  const handle = await readFile(file);
  const head = handle.subarray(0, 4096).toString('utf8');
  return /<svg[\s>]/i.test(head) ? 'image/svg+xml' : undefined;
}

function issue(
  problems: AuditIssue[],
  severidade: Severity,
  codigo: string,
  mensagem: string,
  municipality?: CatalogEntry,
  tipo?: AssetKind,
  arquivo?: string,
) {
  problems.push({
    severidade,
    codigo,
    mensagem,
    ...(municipality ? { codigoIbge: municipality.codigoIbge } : {}),
    ...(tipo ? { tipo } : {}),
    ...(arquivo ? { arquivo } : {}),
  });
}

async function auditAsset(
  root: string,
  municipality: CatalogEntry,
  tipo: AssetKind,
  asset: Asset,
  expected: Set<string>,
  problems: AuditIssue[],
  hashes: boolean,
) {
  const original = asset.arquivoOriginalLocal;
  const normalized = asset.arquivoNormalizadoLocal;
  if (terminalWithAsset.has(asset.status) && (!original || !normalized))
    issue(
      problems,
      'erro',
      'asset_terminal_sem_arquivo',
      `Status ${asset.status} exige original e normalizado`,
      municipality,
      tipo,
    );
  if ((original || normalized) && (!asset.paginaOrigem || !asset.urlOriginal))
    issue(
      problems,
      'erro',
      'asset_sem_procedencia',
      'Asset local sem página de origem ou URL original',
      municipality,
      tipo,
    );
  if ((original || normalized) && !asset.licenca)
    issue(
      problems,
      'erro',
      'asset_sem_licenca',
      'Asset local sem licença registrada',
      municipality,
      tipo,
    );

  if (original) {
    expected.add(original);
    const file = safeLocalPath(root, original);
    if (!file) {
      issue(
        problems,
        'erro',
        'caminho_inseguro',
        'Caminho sai da raiz do projeto',
        municipality,
        tipo,
        original,
      );
    } else {
      try {
        const info = await stat(file);
        if (!info.size)
          issue(problems, 'erro', 'arquivo_vazio', 'Original vazio', municipality, tipo, original);
        const mime = await detectedMime(file);
        if (!mime || !allowedMime.has(mime))
          issue(
            problems,
            'erro',
            'mime_invalido',
            `MIME real não permitido: ${mime ?? 'desconhecido'}`,
            municipality,
            tipo,
            original,
          );
        else if (
          asset.mime &&
          asset.mime !== mime &&
          !(asset.mime === 'image/svg' && mime === 'image/svg+xml')
        )
          issue(
            problems,
            'aviso',
            'mime_divergente',
            `Catálogo informa ${asset.mime}; bytes indicam ${mime}`,
            municipality,
            tipo,
            original,
          );
        if (hashes && asset.sha1Original) {
          const actual = await hashFile(file, 'sha1');
          if (actual !== asset.sha1Original)
            issue(
              problems,
              'erro',
              'sha1_divergente',
              `SHA-1 esperado ${asset.sha1Original}; obtido ${actual}`,
              municipality,
              tipo,
              original,
            );
        } else if (hashes && !asset.sha1Original) {
          issue(
            problems,
            'aviso',
            'sha1_ausente',
            'SHA-1 original não registrado',
            municipality,
            tipo,
            original,
          );
        }
      } catch (error: unknown) {
        issue(
          problems,
          'erro',
          'arquivo_ausente',
          error instanceof Error ? error.message : String(error),
          municipality,
          tipo,
          original,
        );
      }
    }
  }

  if (normalized) {
    expected.add(normalized);
    const file = safeLocalPath(root, normalized);
    if (!file) {
      issue(
        problems,
        'erro',
        'caminho_inseguro',
        'Caminho sai da raiz do projeto',
        municipality,
        tipo,
        normalized,
      );
    } else {
      try {
        const metadata = await sharp(file, { failOn: 'error' }).metadata();
        if (metadata.format !== 'jpeg' || metadata.width !== 192 || metadata.height !== 192)
          issue(
            problems,
            'erro',
            'normalizado_invalido',
            `Esperado JPEG 192×192; obtido ${metadata.format ?? '?'} ${metadata.width ?? '?'}×${metadata.height ?? '?'}`,
            municipality,
            tipo,
            normalized,
          );
        if (hashes && asset.sha256Derivado) {
          const actual = await hashFile(file, 'sha256');
          if (actual !== asset.sha256Derivado)
            issue(
              problems,
              'erro',
              'sha256_divergente',
              `SHA-256 esperado ${asset.sha256Derivado}; obtido ${actual}`,
              municipality,
              tipo,
              normalized,
            );
        } else if (hashes && !asset.sha256Derivado) {
          issue(
            problems,
            'aviso',
            'sha256_ausente',
            'SHA-256 derivado não registrado',
            municipality,
            tipo,
            normalized,
          );
        }
      } catch (error: unknown) {
        issue(
          problems,
          'erro',
          'normalizado_ausente_ou_corrompido',
          error instanceof Error ? error.message : String(error),
          municipality,
          tipo,
          normalized,
        );
      }
    }
  }
}

function markdown(report: AuditReport): string {
  const escape = (value: unknown) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll('\n', ' ');
  const rows = report.problemas
    .map(
      (item) =>
        `| ${escape(item.severidade)} | ${escape(item.codigo)} | ${escape(item.codigoIbge)} | ${escape(item.tipo)} | ${escape(item.arquivo)} | ${escape(item.mensagem)} |`,
    )
    .join('\n');
  return `# Auditoria do catálogo

Gerada em: ${report.geradoEm}

- Municípios: ${report.resumo.municipios}
- Referências a originais: ${report.resumo.referenciasOriginais}
- Referências a normalizados: ${report.resumo.referenciasNormalizados}
- Arquivos originais encontrados: ${report.resumo.arquivosOriginais}
- Arquivos normalizados encontrados: ${report.resumo.arquivosNormalizados}
- Erros: ${report.resumo.erros}
- Avisos: ${report.resumo.avisos}
- Hashes verificados: ${report.hashesVerificados ? 'sim' : 'não'}

## Problemas

| Severidade | Código | IBGE | Tipo | Arquivo | Mensagem |
|---|---|---|---|---|---|
${rows || '| — | — | — | — | — | Nenhum problema encontrado |'}
`;
}

export async function auditCatalog(
  options: { root?: string; hashes?: boolean } = {},
): Promise<AuditReport> {
  const root = options.root ?? ROOT;
  const hashes = options.hashes ?? true;
  const catalog = options.root
    ? (JSON.parse(await readFile(path.join(root, 'data/catalogo.json'), 'utf8')) as Awaited<
        ReturnType<typeof loadCatalog>
      >)
    : await loadCatalog();
  const problems: AuditIssue[] = [];
  const expected = new Set<string>();
  const seen = new Set<string>();
  const limit = pLimit(Number(process.env.BRASOES_AUDIT_CONCURRENCY ?? 4));
  const tasks: Promise<void>[] = [];
  for (const municipality of catalog.municipios) {
    if (seen.has(municipality.codigoIbge))
      issue(problems, 'erro', 'ibge_duplicado', 'Código IBGE duplicado', municipality);
    seen.add(municipality.codigoIbge);
    for (const tipo of ['brasao', 'bandeira'] as const)
      tasks.push(
        limit(() =>
          auditAsset(root, municipality, tipo, municipality[tipo], expected, problems, hashes),
        ),
      );
  }
  await Promise.all(tasks);

  const originals = await listFiles(path.join(root, 'assets/originais'));
  const normalized = await listFiles(path.join(root, 'assets/normalizados'));
  for (const file of [...originals, ...normalized]) {
    const relative = path.relative(root, file);
    if (path.basename(relative) === '.gitkeep') continue;
    if (!expected.has(relative))
      issue(
        problems,
        'aviso',
        'arquivo_orfao',
        'Arquivo não referenciado pelo catálogo',
        undefined,
        undefined,
        relative,
      );
  }
  problems.sort((a, b) =>
    [a.severidade, a.codigoIbge ?? '', a.tipo ?? '', a.codigo, a.arquivo ?? '']
      .join(':')
      .localeCompare(
        [b.severidade, b.codigoIbge ?? '', b.tipo ?? '', b.codigo, b.arquivo ?? ''].join(':'),
      ),
  );
  const report: AuditReport = {
    schemaVersion: 1,
    geradoEm: new Date().toISOString(),
    hashesVerificados: hashes,
    resumo: {
      municipios: catalog.municipios.length,
      referenciasOriginais: catalog.municipios.reduce(
        (sum, item) =>
          sum +
          Number(Boolean(item.brasao.arquivoOriginalLocal)) +
          Number(Boolean(item.bandeira.arquivoOriginalLocal)),
        0,
      ),
      referenciasNormalizados: catalog.municipios.reduce(
        (sum, item) =>
          sum +
          Number(Boolean(item.brasao.arquivoNormalizadoLocal)) +
          Number(Boolean(item.bandeira.arquivoNormalizadoLocal)),
        0,
      ),
      arquivosOriginais: originals.length,
      arquivosNormalizados: normalized.length,
      erros: problems.filter((item) => item.severidade === 'erro').length,
      avisos: problems.filter((item) => item.severidade === 'aviso').length,
    },
    problemas: problems,
  };
  await writeJsonAtomic(
    options.root ? path.join(root, 'data/auditoria.json') : paths.audit,
    report,
  );
  await writeTextAtomic(
    options.root ? path.join(root, 'docs/auditoria.md') : paths.auditReport,
    markdown(report),
  );
  return report;
}
