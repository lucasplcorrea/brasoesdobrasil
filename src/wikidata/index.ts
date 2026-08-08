import { cachedJson } from '../http/client.js';
import { loadCatalog, saveCatalog } from '../catalogo/index.js';

const SPARQL = 'https://query.wikidata.org/sparql';
export function discoveryQuery(codes: string[]): string {
  return `SELECT ?item ?codigo ?brasao ?bandeira ?article WHERE {
  VALUES ?codigo { ${codes.map((c) => `"${c}"`).join(' ')} }
  ?item wdt:P1585 ?codigo.
  OPTIONAL { ?item wdt:P94 ?brasao. }
  OPTIONAL { ?item wdt:P41 ?bandeira. }
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://pt.wikipedia.org/>. }
}`;
}
type Results = { results: { bindings: Array<Record<string, { value: string }>> } };
const commonsTitle = (url: string) =>
  `File:${decodeURIComponent(url.split('/').pop() ?? '').replaceAll('_', ' ')}`;

export async function discover(filters: {
  uf?: string;
  limit: number;
  ibge?: string;
}): Promise<void> {
  const catalog = await loadCatalog();
  const selected = catalog.municipios
    .filter(
      (m) =>
        (!filters.uf || m.uf === filters.uf) && (!filters.ibge || m.codigoIbge === filters.ibge),
    )
    .slice(0, filters.limit);
  const data = await cachedJson<Results>(SPARQL, {
    searchParams: { query: discoveryQuery(selected.map((m) => m.codigoIbge)), format: 'json' },
  });
  const rows = new Map(data.results.bindings.map((b) => [b.codigo?.value, b]));
  for (const municipality of selected) {
    const row = rows.get(municipality.codigoIbge);
    if (!row) {
      municipality.brasao.status = 'nao_encontrado';
      municipality.bandeira.status = 'nao_encontrado';
      continue;
    }
    municipality.wikidataId = row.item!.value.split('/').pop();
    if (row.article) municipality.wikipediaPt = row.article.value;
    for (const [kind, property] of [
      ['brasao', 'brasao'],
      ['bandeira', 'bandeira'],
    ] as const) {
      const value = row[property]?.value;
      if (value)
        Object.assign(municipality[kind], {
          status: 'descoberto',
          arquivoCommons: commonsTitle(value),
          fonteDescoberta: 'wikidata',
          pontuacaoConfianca: 100,
        });
      else municipality[kind].status = 'nao_encontrado';
    }
  }
  await saveCatalog(catalog);
}
