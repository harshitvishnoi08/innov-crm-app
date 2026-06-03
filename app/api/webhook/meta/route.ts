import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNewLeadNotification } from "@/lib/mailer";
import { sendWhatsAppTemplate, normalizePhone } from "@/lib/whatsapp";
import { ActivityType, logLeadActivity } from "@/lib/lead-activity-log";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadgenId = change.value.leadgen_id;
            const formId = change.value.form_id;
            const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

            // Fetch lead field data and form name in parallel
            const [leadResponse, formResponse] = await Promise.all([
              fetch(
                "https://graph.facebook.com/v19.0/" + leadgenId + "?fields=field_data,platform,created_time&access_token=" + accessToken
              ),
              fetch(
                "https://graph.facebook.com/v19.0/" + formId + "?fields=name&access_token=" + accessToken
              ),
            ]);

            const [leadData, formData] = await Promise.all([
              leadResponse.json(),
              formResponse.json(),
            ]);

            console.log("Raw Meta lead data:", JSON.stringify(leadData));
            console.log("Form data:", JSON.stringify(formData));

            if (leadData.error) {
              console.error(
                `META TOKEN ERROR — cannot fetch lead ${leadgenId}:`,
                JSON.stringify(leadData.error),
                '| Regenerate META_PAGE_ACCESS_TOKEN with leads_retrieval permission'
              );
            }

            if (leadData.field_data) {
              const fields: Record<string, string> = {};
              for (const field of leadData.field_data) {
                fields[field.name] = field.values[0];
              }

              console.log("Parsed fields:", JSON.stringify(fields));

              const platformMap: Record<string, string> = {
                fb: "Facebook",
                ig: "Instagram",
              };
              const platform = platformMap[leadData.platform] ?? "Meta";

              const newLead = await prisma.lead.create({
                data: {
                  customerName: fields["full_name"] || fields["name"] || "Unknown",
                  contactNumber: fields["phone_number"] || fields["phone"] || "",
                  city: fields["city"] || fields["street_address"] || "",
                  propertyType: fields["your_property_type_"] || fields["property_type"] || "",
                  leadgenId: String(leadgenId),
                  serviceRequired: fields["you_are_looking_for_?_"] || "",
                  budgetRange: fields["your_expected_budget_"] || "",
                  propertySize:
                    fields["approximate_size_of_your_property?"] ||
                    fields["approximate_size_of_your_property_(in_sqft)"] ||
                    "",
                  preferredCallTime: fields["preferred_time_to_call_you?_"] || "",
                  initialNotes: fields["when_are_you_planning_to_construct_"] || "",
                  briefScope: fields["how_would_you_like_to_proceed_with_consultation?"] || "",
                  leadSource: formData.name || "Meta Ads",
                  platform,
                  status: "NEW",
                  leadCreatedDate: leadData.created_time
                    ? new Date(leadData.created_time)
                    : new Date(),
                  userId: null,
                },
              });

              console.log("New lead saved from form:", formData.name, JSON.stringify(fields));

              await logLeadActivity({
                leadId: newLead.id,
                userId: null,
                type: ActivityType.LEAD_CREATED,
                content: `Lead created from ${formData.name || "Meta Ads"} (${platform})`,
              });

              void sendNewLeadNotification({
                id: newLead.id,
                customerName: newLead.customerName,
                contactNumber: newLead.contactNumber ?? "",
                city: newLead.city,
                platform: newLead.platform,
                leadSource: newLead.leadSource,
                propertyType: newLead.propertyType,
                status: newLead.status,
                assignedUser: null,
              });

              // Auto-send WhatsApp templates — look up active rules from DB
              // NOTE: run outside contact-number check so notification rules always fire
              void (async () => {
                try {
                  const formNameLower = (formData.name || '').toLowerCase();

                  // Find ALL matching active rules (not just the first)
                  const rules = await prisma.whatsAppTemplateRule.findMany({
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' },
                  });
                  const matchedRules = rules.filter((r: { formKeyword: string }) =>
                    r.formKeyword.split('||').some(kw => formNameLower.includes(kw.trim()))
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
                    if (!isNotification && !newLead.contactNumber) continue;

                    const templateComponents: object[] = isNotification
                      ? [
                          {
                            type: 'body',
                            parameters: [
                              { type: 'text', text: newLead.customerName },
                              { type: 'text', text: newLead.contactNumber || '-' },
                              { type: 'text', text: newLead.propertyType || '-' },
                              { type: 'text', text: newLead.budgetRange || '-' },
                              { type: 'text', text: newLead.city || '-' },
                              { type: 'text', text: newLead.leadSource || 'Meta Ads' },
                            ],
                          },
                          // URL button — {{1}} is replaced with the lead ID
                          {
                            type: 'button',
                            sub_type: 'url',
                            index: 0,
                            parameters: [{ type: 'text', text: newLead.id }],
                          },
                        ]
                      : [
                          ...(rule.videoId ? [{
                            type: 'header',
                            parameters: [{ type: 'video', video: { id: rule.videoId } }],
                          }] : []),
                          {
                            type: 'body',
                            parameters: [{ type: 'text', text: newLead.customerName }],
                          },
                        ];

                    // Send to fixed notify numbers (internal) or lead's own number
                    const targetNumbers = rule.notifyNumber
                      ? rule.notifyNumber.split('||').map((n: string) => n.trim()).filter(Boolean)
                      : [newLead.contactNumber];

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
                              leadId: newLead.id,
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
              })();
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
