import { access } from 'node:fs/promises';
import { loadCatalog, syncCatalog } from '../catalogo/index.js';
import { enrichCommons } from '../commons/index.js';
import { paths } from '../config.js';
import { authenticateBotPassword } from '../http/auth.js';
import { updateIbge } from '../ibge/index.js';
import { downloadCandidates } from '../imagens/index.js';
import { log, writeJsonAtomic } from '../io.js';
import { generateReports } from '../relatorios/index.js';
import { discover } from '../wikidata/index.js';
import { discoverWikipediaFallback } from '../wikipedia/index.js';
import { notifyError } from '../notificacoes/index.js';
import { exponentialBackoffMs, retryAfterMs } from './retry.js';

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopping = true;
    log('worker.encerramento_solicitado', { signal });
  });
}

async function sleep(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopping && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, end - Date.now())));
  }
}

async function state(status: string, fields: Record<string, unknown> = {}): Promise<void> {
  await writeJsonAtomic(paths.worker, {
    schemaVersion: 1,
    status,
    atualizadoEm: new Date().toISOString(),
    ...fields,
  });
}

async function isMissing(file: string): Promise<boolean> {
  try {
    await access(file);
    return false;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

async function initializeRuntimeData(): Promise<void> {
  if (await isMissing(paths.catalog)) {
    await writeJsonAtomic(paths.catalog, {
      schemaVersion: 1,
      atualizadoEm: new Date().toISOString(),
      municipios: [],
    });
    log('worker.catalogo_inicializado');
  }
  if (await isMissing(paths.ibge)) {
    await updateIbge();
    log('worker.ibge_inicializado');
  }
}

export async function runWorker(): Promise<void> {
  await authenticateBotPassword();
  await initializeRuntimeData();
  const added = await syncCatalog();
  log('worker.catalogo_sincronizado', { adicionados: added });
  const requestDelay = Number(process.env.BRASOES_REQUEST_DELAY_MS ?? 5_000);
  const downloadDelay = Number(process.env.BRASOES_DOWNLOAD_DELAY_MS ?? 1_000);
  const failureDelay = Number(process.env.BRASOES_FAILURE_DELAY_MS ?? 60 * 60 * 1000);
  const transientBaseDelay = Number(process.env.BRASOES_TRANSIENT_DELAY_MS ?? 60_000);
  let processed = 0;
  let consecutiveFailures = 0;
  await state('executando', { processed });

  while (!stopping) {
    const catalog = await loadCatalog();
    const downloadable = catalog.municipios.find((municipality) =>
      [municipality.brasao, municipality.bandeira].some(
        (asset) =>
          asset.status === 'descoberto' &&
          asset.urlOriginal &&
          (!asset.proximaTentativaDownload ||
            Date.parse(asset.proximaTentativaDownload) <= Date.now()),
      ),
    );
    if (downloadable) {
      const result = await downloadCandidates({
        ibge: downloadable.codigoIbge,
        limit: 1,
        dryRun: false,
      });
      processed += result.completed + result.permanentlyRejected;
      if (result.rateLimited) {
        const waitMs = result.retryAfterMs ?? 15 * 60 * 1000;
        const resumeAt = new Date(Date.now() + waitMs).toISOString();
        await state('aguardando_rate_limit', { processed, resumeAt, waitMs });
        log('worker.rate_limit', { resumeAt, waitMs });
        await sleep(waitMs + Math.floor(Math.random() * 30_000));
      } else if (result.failed) {
        consecutiveFailures += 1;
        const waitMs = exponentialBackoffMs(consecutiveFailures, transientBaseDelay, failureDelay);
        await state('aguardando_apos_falha', { processed, waitMs, consecutiveFailures });
        await sleep(waitMs);
      } else {
        consecutiveFailures = 0;
        await state('executando', { processed });
        await sleep(downloadDelay);
      }
      continue;
    }

    const undiscovered = catalog.municipios.find((municipality) =>
      [municipality.brasao, municipality.bandeira].some(
        (asset) => asset.status === 'nao_consultado',
      ),
    );
    if (undiscovered) {
      const filters = { ibge: undiscovered.codigoIbge, limit: 1 };
      try {
        await discover(filters);
        await discoverWikipediaFallback(filters);
        await enrichCommons(filters);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const rateLimitWait = retryAfterMs(error);
        if (rateLimitWait !== undefined) {
          const jitter = Math.floor(Math.random() * 30_000);
          const waitMs = rateLimitWait + jitter;
          const resumeAt = new Date(Date.now() + waitMs).toISOString();
          await state('aguardando_rate_limit', {
            processed,
            ultimoIbge: undiscovered.codigoIbge,
            resumeAt,
            waitMs,
          });
          log('worker.rate_limit', {
            codigoIbge: undiscovered.codigoIbge,
            resumeAt,
            waitMs,
          });
          await notifyError({
            event: 'worker.rate_limit',
            codigoIbge: undiscovered.codigoIbge,
            message,
          });
          await sleep(waitMs);
          continue;
        }
        consecutiveFailures += 1;
        const waitMs = exponentialBackoffMs(consecutiveFailures, transientBaseDelay, failureDelay);
        const resumeAt = new Date(Date.now() + waitMs).toISOString();
        await state('aguardando_apos_falha', {
          processed,
          ultimoIbge: undiscovered.codigoIbge,
          resumeAt,
          waitMs,
          consecutiveFailures,
        });
        log('worker.falha_transitoria', {
          codigoIbge: undiscovered.codigoIbge,
          message,
          resumeAt,
          waitMs,
          consecutiveFailures,
        });
        await notifyError({
          event: 'worker.falha_transitoria',
          codigoIbge: undiscovered.codigoIbge,
          message,
        });
        await sleep(waitMs);
        continue;
      }
      consecutiveFailures = 0;
      processed += 1;
      await state('executando', { processed, ultimoIbge: undiscovered.codigoIbge });
      if (processed % 50 === 0) await generateReports();
      await sleep(requestDelay);
      continue;
    }

    await generateReports();
    await state('concluido', { processed });
    log('worker.concluido', { processed });
    return;
  }

  await state('interrompido', { processed });
}
