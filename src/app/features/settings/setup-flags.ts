/** Tenant dokümanından kurulum durumunu çıkarır (saf; test edilebilir). */
export function tenantSetupFlags(d: Record<string, unknown> | null | undefined): { business: boolean; receipt: boolean; backup: boolean } {
  const o = d ?? {};
  const filled = (k: string) => typeof o[k] === 'string' && (o[k] as string).trim().length > 0;
  const settings = (o['settings'] && typeof o['settings'] === 'object' ? o['settings'] : {}) as Record<string, unknown>;
  const receipt = (settings['receipt'] && typeof settings['receipt'] === 'object' ? settings['receipt'] : {}) as Record<string, unknown>;
  const rFilled = (k: string) => typeof receipt[k] === 'string' && (receipt[k] as string).trim().length > 0;
  return {
    business: ['name', 'phone', 'address', 'taxNo'].every(filled),
    receipt: rFilled('logo') || rFilled('headerNote') || filled('receiptFooter'),
    backup: !!o['lastBackupAt'],
  };
}
