const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const BASE_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

/** Strip non-digits, add 91 prefix for 10-digit Indian numbers */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '91' + digits.slice(1);
  return digits;
}

export async function sendWhatsAppText(to: string, body: string) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'text',
      text: { body },
    }),
  });
  return res.json() as Promise<WhatsAppApiResponse>;
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = 'en',
  components?: object[]
) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    }),
  });
  return res.json() as Promise<WhatsAppApiResponse>;
}

export interface WhatsAppApiResponse {
  messaging_product?: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string; message_status?: string }[];
  error?: { message: string; type: string; code: number };
}
