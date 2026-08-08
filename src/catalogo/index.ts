import { paths } from '../config.js';
import { CatalogSchema, IbgeSnapshotSchema, type Catalog } from '../model.js';
import { readJson, writeJsonAtomic } from '../io.js';

export async function loadCatalog(): Promise<Catalog> {
  return CatalogSchema.parse(await readJson(paths.catalog));
}
export async function saveCatalog(catalog: Catalog): Promise<void> {
  catalog.atualizadoEm = new Date().toISOString();
  catalog.municipios.sort((a, b) => a.codigoIbge.localeCompare(b.codigoIbge));
  await writeJsonAtomic(paths.catalog, CatalogSchema.parse(catalog));
}

export async function syncCatalog(uf?: string): Promise<number> {
  const catalog = await loadCatalog();
  const snapshot = IbgeSnapshotSchema.parse(await readJson(paths.ibge));
  const existing = new Set(catalog.municipios.map((m) => m.codigoIbge));
  let added = 0;
  for (const municipality of snapshot.municipios) {
    if (uf && municipality.uf !== uf) continue;
    if (existing.has(municipality.codigoIbge)) continue;
    catalog.municipios.push({
      schemaVersion: 1,
      ...municipality,
      brasao: { status: 'nao_consultado', alteracoes: [], avisos: [] },
      bandeira: { status: 'nao_consultado', alteracoes: [], avisos: [] },
    });
    existing.add(municipality.codigoIbge);
    added += 1;
  }
  await saveCatalog(catalog);
  return added;
}
