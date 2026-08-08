import { loadCatalog, saveCatalog } from '../catalogo/index.js';
import { cachedJson } from '../http/client.js';

export type Candidate = {
  title: string;
  caption?: string;
  alt?: string;
  commons: boolean;
  wikidataMatch?: boolean;
};
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function scoreCandidate(
  candidate: Candidate,
  municipality: string,
  uf: string,
  kind: 'brasao' | 'bandeira',
): number {
  const title = normalize(candidate.title),
    context = normalize(`${candidate.caption ?? ''} ${candidate.alt ?? ''}`);
  let score = 0;
  if (title.includes(normalize(municipality))) score += 35;
  if (new RegExp(`(?:^|[^a-z])${uf.toLowerCase()}(?:[^a-z]|$)`).test(title)) score += 10;
  if (kind === 'brasao' && /brasao|coat/.test(title)) score += 25;
  if (kind === 'bandeira' && /bandeira/.test(title)) score += 25;
  if (context.includes(kind === 'brasao' ? 'brasao' : 'bandeira')) score += 10;
  if (candidate.wikidataMatch) score += 15;
  if (candidate.commons) score += 5;
  return score;
}

type ImagesApi = {
  query?: { pages?: Array<{ title: string; images?: Array<{ title: string }> }> };
};

export async function discoverWikipediaFallback(filters: {
  uf?: string;
  limit: number;
  ibge?: string;
}): Promise<void> {
  const catalog = await loadCatalog();
  const selected = catalog.municipios
    .filter(
      (m) =>
        (!filters.uf || m.uf === filters.uf) &&
        (!filters.ibge || m.codigoIbge === filters.ibge) &&
        m.wikipediaPt &&
        (m.brasao.status === 'nao_encontrado' || m.bandeira.status === 'nao_encontrado'),
    )
    .slice(0, filters.limit);
  if (!selected.length) return;
  const titleFor = (url: string) =>
    decodeURIComponent(new URL(url).pathname.split('/').pop()!).replaceAll('_', ' ');
  const data = await cachedJson<ImagesApi>('https://pt.wikipedia.org/w/api.php', {
    searchParams: {
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'images',
      imlimit: 'max',
      titles: selected.map((m) => titleFor(m.wikipediaPt!)).join('|'),
    },
  });
  const pages = new Map((data.query?.pages ?? []).map((page) => [page.title, page]));
  for (const municipality of selected) {
    const page = pages.get(titleFor(municipality.wikipediaPt!));
    for (const kind of ['brasao', 'bandeira'] as const) {
      if (municipality[kind].status !== 'nao_encontrado') continue;
      const ranked = (page?.images ?? [])
        .map((image) => ({
          title: image.title.replace(/^Ficheiro:/, 'File:'),
          score: scoreCandidate(
            { title: image.title, commons: true },
            municipality.municipio,
            municipality.uf,
            kind,
          ),
        }))
        .filter((candidate) => candidate.score >= 50)
        .sort((a, b) => b.score - a.score);
      if (!ranked.length) continue;
      const best = ranked[0]!;
      Object.assign(municipality[kind], {
        status: 'descoberto',
        arquivoCommons: best.title,
        fonteDescoberta: 'wikipedia',
        pontuacaoConfianca: best.score,
        avisos:
          ranked.length > 1 && ranked[1]!.score === best.score
            ? ['Mais de um candidato plausível encontrado no fallback']
            : [],
      });
    }
  }
  await saveCatalog(catalog);
}
