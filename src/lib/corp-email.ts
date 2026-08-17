export const CORP_DOMAINS = ["@unihabitat.net", "@unihabitat.com"] as const;

export function isCorporateAdminEmail(email: string): boolean {
  const emailLower = email.toLowerCase().trim();
  return CORP_DOMAINS.some((d) => emailLower.endsWith(d));
}
