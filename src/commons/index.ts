import { loadCatalog, saveCatalog } from '../catalogo/index.js';
import { cachedJson } from '../http/client.js';
import { normalizeLicense } from '../licenciamento/index.js';

const API = 'https://commons.wikimedia.org/w/api.php';
type Api = { query?: { pages?: Record<string, { title: string; imageinfo?: Array<any> }> } };
const text = (field: any) =>
  String(field?.value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim();
export async function enrichCommons(filters: {
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
  const jobs = selected.flatMap((municipality) =>
    (['brasao', 'bandeira'] as const)
      .map((kind) => ({ asset: municipality[kind] }))
      .filter(({ asset }) => asset.arquivoCommons && asset.status !== 'aprovado'),
  );
  if (!jobs.length) return;
  const data = await cachedJson<Api>(API, {
    searchParams: {
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      prop: 'imageinfo',
      titles: jobs.map(({ asset }) => asset.arquivoCommons).join('|'),
      iiprop: 'url|size|sha1|mime|mediatype|extmetadata',
    },
  });
  const pages = Object.values(data.query?.pages ?? {});
  for (const { asset } of jobs) {
    const page = pages.find((candidate) => candidate.title === asset.arquivoCommons);
    const info = page?.imageinfo?.[0];
    if (!info) {
      asset.status = 'nao_encontrado';
      continue;
    }
    const license = normalizeLicense(info.extmetadata ?? {});
    Object.assign(asset, {
      titulo: text(info.extmetadata?.ObjectName) || page?.title,
      paginaOrigem: info.descriptionurl,
      urlOriginal: info.url,
      autor: text(info.extmetadata?.Artist),
      credito: text(info.extmetadata?.Credit),
      licenca: license.name,
      licencaUrl: license.url,
      termosDeUso: text(info.extmetadata?.UsageTerms),
      atribuicaoObrigatoria: license.attribution,
      declaracaoDominioPublico: license.publicDomain ? license.name : undefined,
      motivoDominioPublico: license.reason,
      sha1Original: info.sha1,
      mime: info.mime,
      mediaType: info.mediatype,
      largura: info.width,
      altura: info.height,
      dataConsulta: new Date().toISOString(),
      status: license.status === 'ok' ? 'descoberto' : 'licenca_pendente',
    });
  }
  await saveCatalog(catalog);
}
