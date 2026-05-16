export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildFollowUpMessage(customerName?: string | null): string {
  const greeting = customerName?.trim()
    ? `Hi ${customerName.trim()},`
    : 'Hi,';

  return `${greeting}

Hope you're doing well! I wanted to follow up regarding your recent inquiry. Please let me know if you have any questions or if there's a good time to connect.

Thank you!`;
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const clean = normalizeWhatsAppPhone(phone);
  if (!clean) return 'https://wa.me/';
  const base = `https://wa.me/${clean}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppFollowUpUrl(
  phone: string,
  customerName?: string | null,
): string {
  return buildWhatsAppUrl(phone, buildFollowUpMessage(customerName));
}
