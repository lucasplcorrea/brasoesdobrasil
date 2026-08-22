import path from 'node:path';

export const ROOT = process.env.BRASOES_ROOT
  ? path.resolve(process.env.BRASOES_ROOT)
  : path.resolve(import.meta.dirname, '..');
export const paths = {
  catalog: path.join(ROOT, 'data/catalogo.json'),
  ibge: path.join(ROOT, 'data/municipios-ibge.json'),
  reviews: path.join(ROOT, 'data/revisoes.json'),
  sources: path.join(ROOT, 'data/fontes.csv'),
  cache: path.join(ROOT, 'data/cache'),
  checkpoint: path.join(ROOT, 'data/checkpoints/downloads.json'),
  worker: path.join(ROOT, 'data/checkpoints/worker.json'),
  audit: path.join(ROOT, 'data/auditoria.json'),
  auditReport: path.join(ROOT, 'docs/auditoria.md'),
};

export function userAgent(): string {
  const contact = process.env.BRASOES_CONTACT;
  const repository = process.env.BRASOES_REPOSITORY_URL;
  if (!contact) throw new Error('Defina BRASOES_CONTACT antes de acessar serviços externos.');
  return `BrasoesDoBrasilBot/0.2 (${repository ?? 'https://meta.wikimedia.org/wiki/User:BrasoesDoBrasilBot'}; ${contact})`;
}
