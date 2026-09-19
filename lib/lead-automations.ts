import prisma from '@/lib/prisma';
import { sendWhatsAppTemplate, normalizePhone } from '@/lib/whatsapp';

type AutomationLead = {
  id: string;
  customerName: string;
  contactNumber: string | null;
  propertyType: string | null;
  budgetRange: string | null;
  city: string | null;
  leadSource: string | null;
};

/**
 * Fire the WhatsApp auto-template rules for a freshly created lead.
 *
 * `keywordSource` is the text each rule's `formKeyword` is matched against —
 * the instant-form name for Meta leads, "website <campaign>" for website leads.
 * Shared by every lead-intake route so the rules behave identically regardless
 * of where the lead came from. Never throws; callers fire-and-forget it.
 */
export async function runNewLeadAutomations(lead: AutomationLead, keywordSource: string) {
  try {
    const sourceLower = keywordSource.toLowerCase();

    // Find ALL matching active rules (not just the first)
    const rules = await prisma.whatsAppTemplateRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const matchedRules = rules.filter((r: { formKeyword: string }) =>
      r.formKeyword.split('||').some(kw => sourceLower.includes(kw.trim()))
    );

    // Fallback to env var if no rules matched
    if (matchedRules.length === 0 && process.env.WHATSAPP_AUTO_TEMPLATE) {
      matchedRules.push({
        templateName: process.env.WHATSAPP_AUTO_TEMPLATE,
        language: 'en',
        videoId: null,
        notifyNumber: null,
      } as typeof rules[0]);
    }

    for (const rule of matchedRules) {
      // Notification rules (notifyNumber set) get full lead details + URL button
      // Lead intro rules get customer name + optional video header
      const isNotification = !!rule.notifyNumber;

      // Lead intro rules require the lead to have a contact number
      if (!isNotification && !lead.contactNumber) continue;

      const templateComponents: object[] = isNotification
        ? [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: lead.customerName },
                { type: 'text', text: lead.contactNumber || '-' },
                { type: 'text', text: lead.propertyType || '-' },
                { type: 'text', text: lead.budgetRange || '-' },
                { type: 'text', text: lead.city || '-' },
                { type: 'text', text: lead.leadSource || 'Meta Ads' },
              ],
            },
            // URL button — {{1}} is replaced with the lead ID
            {
              type: 'button',
              sub_type: 'url',
              index: 0,
              parameters: [{ type: 'text', text: lead.id }],
            },
          ]
        : [
            ...(rule.videoId ? [{
              type: 'header',
              parameters: [{ type: 'video', video: { id: rule.videoId } }],
            }] : []),
            {
              type: 'body',
              parameters: [{ type: 'text', text: lead.customerName }],
            },
          ];

      // Send to fixed notify numbers (internal) or lead's own number
      const targetNumbers: string[] = rule.notifyNumber
        ? rule.notifyNumber.split('||').map((n: string) => n.trim()).filter(Boolean)
        : [lead.contactNumber!];

      for (const targetNumber of targetNumbers) {
        const apiRes = await sendWhatsAppTemplate(
          targetNumber,
          rule.templateName,
          rule.language,
          templateComponents
        );
        if (!apiRes.error) {
          // Only save to lead's chat if this went to the lead's own number
          if (!isNotification) {
            await prisma.whatsAppMessage.create({
              data: {
                leadId: lead.id,
                wamid: apiRes.messages?.[0]?.id ?? null,
                fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID!,
                toNumber: normalizePhone(targetNumber),
                direction: 'outbound',
                messageType: 'template',
                templateName: rule.templateName,
                status: 'sent',
                sentAt: new Date(),
              },
            });
          }
        } else {
          console.error('Auto WhatsApp template error for', targetNumber, ':', JSON.stringify(apiRes.error));
        }
      }
    }
  } catch (e) {
    console.error('Auto WhatsApp template send failed:', e);
  }
}
