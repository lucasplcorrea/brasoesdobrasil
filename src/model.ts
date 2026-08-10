import { z } from 'zod';

export const statuses = [
  'nao_consultado',
  'descoberto',
  'baixado',
  'revisao_pendente',
  'aprovado',
  'rejeitado',
  'nao_encontrado',
  'licenca_pendente',
  'desatualizado',
] as const;
export const StatusSchema = z.enum(statuses);
export type Status = z.infer<typeof StatusSchema>;

export const AssetSchema = z.object({
  status: StatusSchema,
  arquivoCommons: z.string().optional(),
  titulo: z.string().optional(),
  paginaOrigem: z.string().url().optional(),
  urlOriginal: z.string().url().optional(),
  autor: z.string().optional(),
  credito: z.string().optional(),
  licenca: z.string().optional(),
  licencaUrl: z.string().url().optional(),
  termosDeUso: z.string().optional(),
  atribuicaoObrigatoria: z.boolean().optional(),
  declaracaoDominioPublico: z.string().optional(),
  motivoDominioPublico: z.string().optional(),
  alteracoes: z.array(z.string()).default([]),
  sha1Original: z.string().optional(),
  sha256Derivado: z.string().optional(),
  arquivoOriginalLocal: z.string().optional(),
  arquivoNormalizadoLocal: z.string().optional(),
  dataConsulta: z.string().optional(),
  mime: z.string().optional(),
  mediaType: z.string().optional(),
  largura: z.number().int().nonnegative().optional(),
  altura: z.number().int().nonnegative().optional(),
  pontuacaoConfianca: z.number().optional(),
  fonteDescoberta: z.enum(['wikidata', 'wikipedia']).optional(),
  avisos: z.array(z.string()).default([]),
  motivoRejeicao: z.string().optional(),
  tentativasDownload: z.number().int().nonnegative().optional(),
  proximaTentativaDownload: z.string().datetime().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const CatalogEntrySchema = z.object({
  schemaVersion: z.literal(1),
  codigoIbge: z.string().regex(/^\d{7}$/),
  municipio: z.string().min(1),
  uf: z.string().regex(/^[A-Z]{2}$/),
  wikidataId: z
    .string()
    .regex(/^Q\d+$/)
    .optional(),
  wikipediaPt: z.string().url().optional(),
  brasao: AssetSchema,
  bandeira: AssetSchema,
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogSchema = z.object({
  schemaVersion: z.literal(1),
  atualizadoEm: z.string(),
  municipios: z.array(CatalogEntrySchema),
});
export type Catalog = z.infer<typeof CatalogSchema>;

export const IbgeSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  fonte: z.string().url(),
  atualizadoEm: z.string(),
  municipios: z.array(
    z.object({
      codigoIbge: z.string().regex(/^\d{7}$/),
      municipio: z.string().min(1),
      uf: z.string().regex(/^[A-Z]{2}$/),
    }),
  ),
});
