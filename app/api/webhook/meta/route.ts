import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNewLeadNotification } from "@/lib/mailer";
import { sendWhatsAppTemplate, normalizePhone } from "@/lib/whatsapp";

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

              // Auto-send WhatsApp welcome template if phone exists and template is configured
              const autoTemplate = process.env.WHATSAPP_AUTO_TEMPLATE;
              if (newLead.contactNumber && autoTemplate) {
                void (async () => {
                  try {
                    const apiRes = await sendWhatsAppTemplate(newLead.contactNumber, autoTemplate);
                    if (!apiRes.error) {
                      await prisma.whatsAppMessage.create({
                        data: {
                          leadId: newLead.id,
                          wamid: apiRes.messages?.[0]?.id ?? null,
                          fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID!,
                          toNumber: normalizePhone(newLead.contactNumber),
                          direction: 'outbound',
                          messageType: 'template',
                          templateName: autoTemplate,
                          status: 'sent',
                          sentAt: new Date(),
                        },
                      });
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
