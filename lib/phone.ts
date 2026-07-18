/**
 * Normalizes a phone number for storage, always assuming India: strips
 * everything but digits, keeps the last 10 (an Indian mobile number's local
 * length — this recovers the local number regardless of what country code,
 * leading 0, or "+" prefix was in front of it), and prepends "+91".
 *
 * This is a deliberate choice over trusting an existing "+" country code —
 * Meta Lead Ads forms pre-fill the phone field from the lead's Facebook
 * account, which can carry a stale/wrong number (e.g. an old SIM's country
 * code) even though the lead itself is a genuine local inquiry. A rare
 * legitimate NRI lead's number gets mis-tagged as +91 by this trade-off.
 *
 * Passes null/undefined/empty straight through so optional fields stay optional.
 */
export function normalizeIndianPhone(raw: string): string;
export function normalizeIndianPhone(raw: string | null | undefined): string | null | undefined;
export function normalizeIndianPhone(raw: string | null | undefined): string | null | undefined {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${local}`;
}
