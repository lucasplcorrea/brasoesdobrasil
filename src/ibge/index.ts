import { z } from 'zod';
import { paths } from '../config.js';
import { http } from '../http/client.js';
import { IbgeSnapshotSchema } from '../model.js';
import { readJson, writeJsonAtomic } from '../io.js';

export const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const RawSchema = z.array(
  z.object({
    id: z.number().int(),
    nome: z.string().min(1),
    microrregiao: z
      .object({ mesorregiao: z.object({ UF: z.object({ sigla: z.string() }) }) })
      .nullable(),
    'regiao-imediata': z
      .object({ 'regiao-intermediaria': z.object({ UF: z.object({ sigla: z.string() }) }) })
      .nullable()
      .optional(),
  }),
);

export function normalizeIbge(raw: unknown) {
  const parsed = RawSchema.parse(raw);
  const municipios = parsed
    .map((item) => ({
      codigoIbge: String(item.id),
      municipio: item.nome,
      uf:
        item.microrregiao?.mesorregiao.UF.sigla ??
        item['regiao-imediata']?.['regiao-intermediaria'].UF.sigla ??
        '',
    }))
    .sort((a, b) => a.codigoIbge.localeCompare(b.codigoIbge));
  const seen = new Set<string>();
  for (const item of municipios) {
    if (!/^\d{7}$/.test(item.codigoIbge))
      throw new Error(`Código IBGE inválido: ${item.codigoIbge}`);
    if (!/^[A-Z]{2}$/.test(item.uf)) throw new Error(`UF inválida para ${item.codigoIbge}`);
    if (seen.has(item.codigoIbge)) throw new Error(`Código IBGE duplicado: ${item.codigoIbge}`);
    seen.add(item.codigoIbge);
  }
  return municipios;
}

export async function updateIbge(): Promise<void> {
  const raw = await http.get(IBGE_URL).json<unknown>();
  const snapshot = IbgeSnapshotSchema.parse({
    schemaVersion: 1,
    fonte: IBGE_URL,
    atualizadoEm: new Date().toISOString(),
    municipios: normalizeIbge(raw),
  });
  await writeJsonAtomic(paths.ibge, snapshot);
}
export async function validateIbge(): Promise<number> {
  const snapshot = IbgeSnapshotSchema.parse(await readJson(paths.ibge));
  const ids = new Set<string>();
  for (const m of snapshot.municipios) {
    if (ids.has(m.codigoIbge)) throw new Error(`Código IBGE duplicado: ${m.codigoIbge}`);
    ids.add(m.codigoIbge);
  }
  return ids.size;
}
