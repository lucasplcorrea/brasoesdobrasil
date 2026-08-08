export type LicenseInfo = {
  status: 'ok' | 'pendente';
  name?: string;
  url?: string;
  attribution: boolean;
  publicDomain?: boolean;
  reason?: string;
};
const plain = (value: unknown) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim();
export function normalizeLicense(metadata: Record<string, { value?: unknown }>): LicenseInfo {
  const name = plain(metadata.LicenseShortName?.value || metadata.License?.value);
  const url = plain(metadata.LicenseUrl?.value);
  const usage = plain(metadata.UsageTerms?.value);
  const templates = plain(metadata.License?.value);
  const publicDomain = /public domain|domínio público/i.test(`${name} ${usage}`);
  if (!name || /unknown|copyrighted free use/i.test(name))
    return { status: 'pendente', attribution: true };
  return {
    status: 'ok',
    name,
    ...(url ? { url } : {}),
    attribution: !publicDomain,
    publicDomain,
    ...(publicDomain && (templates || usage) ? { reason: templates || usage } : {}),
  };
}
