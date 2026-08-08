import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { ROOT, paths } from '../config.js';
import { http } from '../http/client.js';
import { loadCatalog, saveCatalog } from '../catalogo/index.js';
import { readJson, writeJsonAtomic, log } from '../io.js';

const allowed = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/svg+xml', 'svg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);
export async function validateImage(buffer: Buffer, declaredMime?: string) {
  if (!buffer.length) throw new Error('Arquivo vazio');
  const head = buffer.subarray(0, 4096).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html'))
    throw new Error('HTML servido como imagem');
  if (head.startsWith('mz') || head.startsWith('\u007felf')) throw new Error('Conteúdo executável');
  let detected = await fileTypeFromBuffer(buffer);
  if ((!detected || !allowed.has(detected.mime)) && /<svg[\s>]/i.test(head))
    detected = { ext: 'svg', mime: 'image/svg+xml' };
  if (!detected || !allowed.has(detected.mime)) throw new Error('Formato de imagem não permitido');
  if (
    declaredMime &&
    declaredMime !== detected.mime &&
    !(declaredMime === 'image/svg' && detected.mime === 'image/svg+xml')
  )
    throw new Error(`MIME divergente: ${declaredMime} vs ${detected.mime}`);
  if (
    detected.mime === 'image/svg+xml' &&
    /<script|(?:\s|<)on\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(
      buffer.toString('utf8'),
    )
  )
    throw new Error('SVG contém conteúdo ativo ou recurso externo');
  const metadata = await sharp(buffer, {
    density: 300,
    limitInputPixels: 100_000_000,
    failOn: 'error',
  }).metadata();
  if (!metadata.width || !metadata.height || metadata.width > 20_000 || metadata.height > 20_000)
    throw new Error('Dimensões ausentes ou excessivas');
  return {
    ext: allowed.get(detected.mime)!,
    mime: detected.mime,
    width: metadata.width,
    height: metadata.height,
  };
}
export async function normalize(buffer: Buffer) {
  const image = sharp(buffer, { density: 300, limitInputPixels: 100_000_000, failOn: 'error' });
  return image
    .resize(192, 192, {
      fit: 'contain',
      background: '#ffffff',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
type Checkpoint = { completed: string[] };
async function checkpoint(): Promise<Checkpoint> {
  try {
    return await readJson(paths.checkpoint);
  } catch {
    return { completed: [] };
  }
}

export type DownloadResult = {
  jobs: number;
  completed: number;
  failed: number;
  rateLimited: boolean;
  retryAfterMs?: number;
};

export async function downloadCandidates(filters: {
  uf?: string;
  ibge?: string;
  limit: number;
  dryRun: boolean;
}): Promise<DownloadResult> {
  const catalog = await loadCatalog();
  const cp = await checkpoint();
  const done = new Set(cp.completed);
  const selected = catalog.municipios
    .filter(
      (m) =>
        (!filters.uf || m.uf === filters.uf) && (!filters.ibge || m.codigoIbge === filters.ibge),
    )
    .slice(0, filters.limit);
  const jobs = selected
    .flatMap((m) => (['brasao', 'bandeira'] as const).map((kind) => ({ m, kind, asset: m[kind] })))
    .filter(
      ({ asset }) =>
        asset.urlOriginal && asset.status !== 'aprovado' && asset.status !== 'licenca_pendente',
    );
  if (filters.dryRun) {
    for (const j of jobs)
      log('download.dry_run', {
        codigoIbge: j.m.codigoIbge,
        tipo: j.kind,
        url: j.asset.urlOriginal,
      });
    return { jobs: jobs.length, completed: 0, failed: 0, rateLimited: false };
  }
  let rateLimited = false;
  let retryAfterMs: number | undefined;
  const limit = pLimit(Number(process.env.BRASOES_CONCURRENCY ?? 1));
  const results = await Promise.allSettled(
    jobs.map((job) =>
      limit(async () => {
        if (rateLimited) throw new Error('Circuit breaker aberto após HTTP 429');
        const key = `${job.m.codigoIbge}:${job.kind}:${job.asset.sha1Original ?? job.asset.urlOriginal}`;
        if (done.has(key) && job.asset.arquivoNormalizadoLocal) {
          try {
            await stat(path.join(ROOT, job.asset.arquivoNormalizadoLocal));
            return;
          } catch {
            /* checkpoint stale */
          }
        }
        const expectedExt =
          job.asset.mime === 'image/svg+xml'
            ? 'svg'
            : job.asset.mime === 'image/jpeg'
              ? 'jpg'
              : job.asset.mime === 'image/png'
                ? 'png'
                : undefined;
        const baseRel = `assets/originais/${job.kind === 'brasao' ? 'brasoes' : 'bandeiras'}/${job.m.uf}/${job.m.codigoIbge}`;
        let body: Buffer;
        let contentType = job.asset.mime;
        try {
          if (!expectedExt) throw new Error('extensão desconhecida');
          body = await readFile(path.join(ROOT, `${baseRel}.${expectedExt}`));
        } catch {
          let response;
          try {
            response = await http.get(job.asset.urlOriginal!, {
              responseType: 'buffer',
              resolveBodyOnly: false,
            });
          } catch (error: unknown) {
            const responseError = error as {
              response?: {
                statusCode?: number;
                headers?: Record<string, string | string[] | undefined>;
              };
            };
            if (responseError.response?.statusCode === 429) {
              rateLimited = true;
              const header = responseError.response.headers?.['retry-after'];
              const value = Array.isArray(header) ? header[0] : header;
              retryAfterMs = value && /^\d+$/.test(value) ? Number(value) * 1000 : 15 * 60 * 1000;
            }
            throw error;
          }
          body = response.rawBody;
          contentType = response.headers['content-type']?.split(';')[0];
          await new Promise((resolve) =>
            setTimeout(resolve, Number(process.env.BRASOES_DOWNLOAD_DELAY_MS ?? 1000)),
          );
        }
        const max = Number(process.env.BRASOES_MAX_DOWNLOAD_BYTES ?? 25_000_000);
        if (body.length > max) throw new Error(`Arquivo excede ${max} bytes`);
        const valid = await validateImage(body, contentType);
        if (
          job.asset.sha1Original &&
          createHash('sha1').update(body).digest('hex') !== job.asset.sha1Original
        )
          throw new Error('SHA-1 difere do Commons');
        const originalRel = `assets/originais/${job.kind === 'brasao' ? 'brasoes' : 'bandeiras'}/${job.m.uf}/${job.m.codigoIbge}.${valid.ext}`;
        const normalizedRel = `assets/normalizados/${job.kind === 'brasao' ? 'brasoes' : 'bandeiras'}/${job.m.uf}/${job.m.codigoIbge}.jpg`;
        const original = path.join(ROOT, originalRel);
        const normalizedFile = path.join(ROOT, normalizedRel);
        await mkdir(path.dirname(original), { recursive: true });
        await mkdir(path.dirname(normalizedFile), { recursive: true });
        const derivative = await normalize(body);
        await writeFile(`${original}.tmp`, body);
        await rename(`${original}.tmp`, original);
        await writeFile(`${normalizedFile}.tmp`, derivative);
        await rename(`${normalizedFile}.tmp`, normalizedFile);
        Object.assign(job.asset, {
          status: 'revisao_pendente',
          arquivoOriginalLocal: originalRel,
          arquivoNormalizadoLocal: normalizedRel,
          sha256Derivado: createHash('sha256').update(derivative).digest('hex'),
          alteracoes: [
            'Rasterização do arquivo original quando necessária',
            'Redimensionamento proporcional sem recorte',
            'Centralização em tela branca de 192 × 192 px',
            'Conversão para JPEG',
          ],
          avisos:
            valid.width < 192 || valid.height < 192
              ? ['Original pequeno; não foi ampliado para evitar perda adicional de qualidade']
              : [],
        });
        done.add(key);
        await writeJsonAtomic(paths.checkpoint, { completed: [...done].sort() });
      }),
    ),
  );
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      const job = jobs[index]!;
      job.asset.avisos = [
        ...job.asset.avisos.filter((warning) => !warning.startsWith('Download pendente:')),
        `Download pendente: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      ];
      log('download.falha', {
        codigoIbge: job.m.codigoIbge,
        tipo: job.kind,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }
  await saveCatalog(catalog);
  const failed = results.filter((result) => result.status === 'rejected').length;
  return {
    jobs: jobs.length,
    completed: jobs.length - failed,
    failed,
    rateLimited,
    ...(retryAfterMs ? { retryAfterMs } : {}),
  };
}
