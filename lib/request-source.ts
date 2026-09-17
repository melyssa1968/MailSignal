// Use runtime metadata only, never caller-supplied location/forwarding headers.
// No raw IP, coordinates, or reverse-DNS lookup is collected.
export function requestSource(request: Request, kind: string) {
 const cf = (request as Request & {cf?: Record<string, unknown>}).cf;
 const clean = (v: unknown) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160) || null : null;
 const country = clean(cf?.country);
 return {
  city: clean(cf?.city), region: clean(cf?.region),
  country: country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null,
  network: clean(cf?.asOrganization),
  asn: typeof cf?.asn === 'number' && Number.isSafeInteger(cf.asn) && cf.asn > 0 ? cf.asn : null,
  proxy: kind === 'google_proxy' ? 'Google image proxy (request signature)' : null,
 };
}
export function parseRequestSource(value: string | null) {
 if (!value) return null;
 try { return JSON.parse(value); } catch { return null; }
}
