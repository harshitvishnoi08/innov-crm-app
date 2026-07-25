import { sendWhatsAppTemplate } from "@/lib/whatsapp";

const waSafe = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "N/A");

const TEMPLATE_NAME =
  process.env.WHATSAPP_COLLABORATOR_TEMPLATE?.trim() || "lead_collaborator_added";

export type CollaboratorAddedPayload = {
  leadId: string;
  customerName: string;
  contactNumber: string | null;
  city: string | null;
  collaboratorName: string;
  collaboratorPhone: string;
  addedByName: string;
};

/**
 * Notifies a user via WhatsApp when they are added as a collaborator on a lead.
 *
 * Requires an approved Meta template named `lead_collaborator_added` (or
 * WHATSAPP_COLLABORATOR_TEMPLATE) with body vars:
 *   {{1}} collaborator name, {{2}} added-by name, {{3}} customer name,
 *   {{4}} contact phone, {{5}} city
 * and a URL button whose {{1}} is the lead id.
 */
export async function sendCollaboratorAddedWhatsApp(payload: CollaboratorAddedPayload) {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    return;
  }

  const {
    leadId,
    customerName,
    contactNumber,
    city,
    collaboratorName,
    collaboratorPhone,
    addedByName,
  } = payload;

  try {
    const waRes = await sendWhatsAppTemplate(collaboratorPhone, TEMPLATE_NAME, "en", [
      {
        type: "body",
        parameters: [
          { type: "text", text: waSafe(collaboratorName) },
          { type: "text", text: waSafe(addedByName) },
          { type: "text", text: waSafe(customerName) },
          { type: "text", text: waSafe(contactNumber) },
          { type: "text", text: waSafe(city) },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: leadId }],
      },
    ]);

    if (waRes.error) {
      console.error("Collaborator added WhatsApp error:", waRes.error);
    }
  } catch (err) {
    console.error("Collaborator added WhatsApp send failed:", err);
  }
}
