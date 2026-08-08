import { loadCatalog, saveCatalog } from '../catalogo/index.js';
import { paths } from '../config.js';
import { readJson, writeJsonAtomic } from '../io.js';

type Review = {
  codigoIbge: string;
  tipo: 'brasao' | 'bandeira';
  decisao: 'aprovado' | 'rejeitado';
  motivo?: string;
  data: string;
};
async function append(review: Review) {
  let rows: Review[] = [];
  try {
    rows = await readJson(paths.reviews);
  } catch {
    /* first review */
  }
  rows.push(review);
  await writeJsonAtomic(paths.reviews, rows);
}
export async function listReviews() {
  const catalog = await loadCatalog();
  return catalog.municipios.flatMap((m) =>
    (['brasao', 'bandeira'] as const)
      .filter((t) => ['revisao_pendente', 'licenca_pendente'].includes(m[t].status))
      .map((tipo) => ({
        codigoIbge: m.codigoIbge,
        municipio: m.municipio,
        uf: m.uf,
        tipo,
        status: m[tipo].status,
      })),
  );
}
export async function decide(
  codigoIbge: string,
  tipo: 'brasao' | 'bandeira',
  decisao: 'aprovado' | 'rejeitado',
  motivo?: string,
) {
  const catalog = await loadCatalog();
  const municipality = catalog.municipios.find((m) => m.codigoIbge === codigoIbge);
  if (!municipality) throw new Error('Município não encontrado');
  const asset = municipality[tipo];
  if (decisao === 'aprovado' && asset.status !== 'revisao_pendente')
    throw new Error('Somente assets em revisão pendente podem ser aprovados');
  if (decisao === 'rejeitado' && !motivo) throw new Error('A rejeição exige motivo');
  asset.status = decisao;
  if (motivo) asset.motivoRejeicao = motivo;
  await saveCatalog(catalog);
  await append({
    codigoIbge,
    tipo,
    decisao,
    ...(motivo ? { motivo } : {}),
    data: new Date().toISOString(),
  });
}
