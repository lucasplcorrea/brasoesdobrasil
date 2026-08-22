import path from 'node:path';
import { ROOT } from '../config.js';
import { loadCatalog } from '../catalogo/index.js';
import { writeTextAtomic } from '../io.js';

const label = { brasao: 'Brasão', bandeira: 'Bandeira' } as const;
export const cleanReportText = (value: unknown, fallback: string) => {
  const cleaned = String(value ?? '')
    .replace(/\.mw-parser-output[\s\S]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
};
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export async function generateReports(): Promise<void> {
  const c = await loadCatalog();
  const approved = (kind: 'brasao' | 'bandeira') =>
    c.municipios.filter((m) => m[kind].status === 'aprovado');
  const pending = c.municipios.flatMap((m) =>
    (['brasao', 'bandeira'] as const)
      .filter((k) => m[k].status === 'revisao_pendente')
      .map((k) => `${m.codigoIbge} — ${m.municipio}/${m.uf} — ${label[k]}`),
  );
  const license = c.municipios.flatMap((m) =>
    (['brasao', 'bandeira'] as const)
      .filter((k) => m[k].status === 'licenca_pendente')
      .map((k) => `${m.codigoIbge} — ${m.municipio}/${m.uf} — ${label[k]}`),
  );
  const missing = c.municipios
    .filter((m) => m.brasao.status === 'nao_encontrado' || m.bandeira.status === 'nao_encontrado')
    .map((m) => `${m.codigoIbge} — ${m.municipio}/${m.uf}`);
  await writeTextAtomic(
    path.join(ROOT, 'docs/cobertura.md'),
    `# Cobertura\n\n- Municípios no catálogo: ${c.municipios.length}\n- Brasões aprovados: ${approved('brasao').length}\n- Bandeiras aprovadas: ${approved('bandeira').length}\n- Ambos aprovados: ${c.municipios.filter((m) => m.brasao.status === 'aprovado' && m.bandeira.status === 'aprovado').length}\n`,
  );
  await writeTextAtomic(
    path.join(ROOT, 'docs/revisao-pendente.md'),
    `# Revisão pendente\n\n${pending.map((x) => `- ${x}`).join('\n') || 'Nenhum.'}\n`,
  );
  await writeTextAtomic(
    path.join(ROOT, 'docs/licencas-pendentes.md'),
    `# Licenças pendentes\n\n${license.map((x) => `- ${x}`).join('\n') || 'Nenhuma.'}\n`,
  );
  await writeTextAtomic(
    path.join(ROOT, 'docs/municipios-faltantes.md'),
    `# Municípios com símbolo não encontrado\n\n${missing.map((x) => `- ${x}`).join('\n') || 'Nenhum.'}\n`,
  );
  await writeTextAtomic(
    path.join(ROOT, 'docs/inconsistencias.md'),
    '# Inconsistências\n\nNenhuma inconsistência registrada.\n',
  );
  await generateAttributions(false);
  await generateReviewHtml();
}
export async function generateAttributions(approvedOnly = true): Promise<void> {
  const c = await loadCatalog();
  const blocks = c.municipios.flatMap((m) =>
    (['brasao', 'bandeira'] as const)
      .filter((k) => m[k].atribuicaoObrigatoria && (!approvedOnly || m[k].status === 'aprovado'))
      .map((k) => {
        const a = m[k];
        return `### ${label[k]} de ${m.municipio} — ${m.uf}\n\n- Código IBGE: \`${m.codigoIbge}\`\n- Obra: ${cleanReportText(a.titulo, 'não informado')}\n- Autor: ${cleanReportText(a.autor, 'não informado')}\n- Origem: ${a.paginaOrigem ?? 'não informada'}\n- Arquivo original: ${a.urlOriginal ?? 'não informado'}\n- Licença: ${a.licencaUrl ? `[${cleanReportText(a.licenca, 'pendente')}](${a.licencaUrl})` : cleanReportText(a.licenca, 'pendente')}\n- Crédito: ${cleanReportText(a.credito, 'não informado')}\n- Alterações: ${a.alteracoes.join('; ') || 'previstas: redimensionamento proporcional, centralização e conversão para JPEG'}\n- Consulta realizada em: ${a.dataConsulta?.slice(0, 10) ?? 'não informada'}\n`;
      }),
  );
  await writeTextAtomic(
    path.join(ROOT, approvedOnly ? 'ATTRIBUTIONS.md' : 'docs/ATTRIBUTIONS.preview.md'),
    `# Atribuições${approvedOnly ? '' : ' — prévia'}\n\n${(blocks.join('\n') || 'Nenhum asset com atribuição registrado.').trimEnd()}\n`,
  );
}
function reviewCards(c: Awaited<ReturnType<typeof loadCatalog>>, uf: string) {
  return c.municipios
    .filter((m) => m.uf === uf)
    .map(
      (m) =>
        `<section><h2>${escapeHtml(m.municipio)} — ${escapeHtml(m.uf)} <code>${escapeHtml(m.codigoIbge)}</code></h2>${(
          ['brasao', 'bandeira'] as const
        )
          .map((k) => {
            const a = m[k];
            return `<article><h3>${label[k]}</h3>${a.arquivoNormalizadoLocal ? `<img src="../../${escapeHtml(a.arquivoNormalizadoLocal)}" width="192" height="192" alt="Candidato a ${label[k].toLowerCase()} de ${escapeHtml(m.municipio)}">` : ''}<dl><dt>Status</dt><dd>${escapeHtml(a.status)}</dd><dt>Commons</dt><dd><a href="${escapeHtml(a.paginaOrigem ?? '#')}">${escapeHtml(a.arquivoCommons ?? 'não encontrado')}</a></dd><dt>Autor</dt><dd>${escapeHtml(cleanReportText(a.autor, 'não informado'))}</dd><dt>Licença</dt><dd>${escapeHtml(cleanReportText(a.licenca, 'pendente'))}</dd><dt>Atribuição</dt><dd>${a.atribuicaoObrigatoria ? 'sim' : 'não/indeterminada'}</dd><dt>Confiança</dt><dd>${a.pontuacaoConfianca ?? 0}</dd></dl></article>`;
          })
          .join('')}</section>`,
    )
    .join('');
}

export function stateReviewSummary(c: Awaited<ReturnType<typeof loadCatalog>>, uf: string) {
  const municipalities = c.municipios.filter((m) => m.uf === uf);
  const assets = municipalities.flatMap((m) => [m.brasao, m.bandeira]);
  return {
    uf,
    municipios: municipalities.length,
    pendentes: assets.filter((a) => a.status === 'revisao_pendente').length,
    aprovados: assets.filter((a) => a.status === 'aprovado').length,
    faltantes: assets.filter((a) => a.status === 'nao_encontrado').length,
    excecoes: assets.filter((a) =>
      ['rejeitado', 'licenca_pendente', 'desatualizado'].includes(a.status),
    ).length,
  };
}

const reviewStyle =
  'body{font:16px system-ui;max-width:1000px;margin:auto;padding:1rem}section{border-bottom:1px solid #ccc}article{display:inline-block;vertical-align:top;width:45%;padding:2%}img{object-fit:contain;background:#fff;border:1px solid #ddd}dt{font-weight:bold}table{border-collapse:collapse;width:100%}td,th{padding:.5rem;border:1px solid #ddd;text-align:left}';

async function generateReviewHtml() {
  const c = await loadCatalog();
  const ufs = [...new Set(c.municipios.map((m) => m.uf))].sort();
  const summaries = ufs.map((uf) => stateReviewSummary(c, uf));
  for (const summary of summaries)
    await writeTextAtomic(
      path.join(ROOT, `docs/revisao/${summary.uf}.html`),
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Revisão — ${summary.uf}</title><style>${reviewStyle}</style><nav><a href="../revisao.html">← Índice nacional</a></nav><h1>Revisão humana — ${summary.uf}</h1><p>${summary.municipios} municípios; ${summary.pendentes} candidatos pendentes; ${summary.aprovados} aprovados; ${summary.faltantes} não encontrados; ${summary.excecoes} exceções.</p><p>Nenhum item nesta página está aprovado automaticamente.</p>${reviewCards(c, summary.uf)}</html>`,
    );
  const rows = summaries
    .map(
      (summary) =>
        `<tr><td><a href="revisao/${summary.uf}.html">${summary.uf}</a></td><td>${summary.municipios}</td><td>${summary.pendentes}</td><td>${summary.aprovados}</td><td>${summary.faltantes}</td><td>${summary.excecoes}</td></tr>`,
    )
    .join('');
  await writeTextAtomic(
    path.join(ROOT, 'docs/revisao.html'),
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Revisão nacional</title><style>${reviewStyle}</style><h1>Revisão humana por UF</h1><p>Nenhum item é aprovado automaticamente.</p><table><thead><tr><th>UF</th><th>Municípios</th><th>Pendentes</th><th>Aprovados</th><th>Não encontrados</th><th>Exceções</th></tr></thead><tbody>${rows}</tbody></table></html>`,
  );
}
