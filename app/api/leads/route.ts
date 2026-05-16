import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { sendNewLeadNotification } from "@/lib/mailer";
import { ActivityType, logLeadActivity } from "@/lib/lead-activity-log";

// GET leads with full server-side filtering + pagination
export async function GET(req: NextRequest) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const { searchParams } = new URL(req.url);
    const search       = searchParams.get("search") || "";
    const status       = searchParams.get("status") || "";
    const temperature  = searchParams.get("temperature") || "";
    const activeStatus = searchParams.get("activeStatus") || "";
    const assignedTo   = searchParams.get("assignedTo") || "";
    const platform     = searchParams.get("platform") || "";
    const leadSource   = searchParams.get("leadSource") || "";
    const dateCreated  = searchParams.get("dateCreated") || "";
    const followUp     = searchParams.get("followUp") || "";
    const page         = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize     = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));
    const exportAll    = searchParams.get("all") === "1";

    const ISTOffsetMs   = 5.5 * 60 * 60 * 1000;
    const nowIST        = new Date(Date.now() + ISTOffsetMs);
    const todayStartUTC = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - ISTOffsetMs);
    const todayEndUTC   = new Date(todayStartUTC.getTime() + 86400000);
    const weekStartUTC  = new Date(todayStartUTC.getTime() - 6 * 86400000);
    const weekEndUTC    = new Date(todayStartUTC.getTime() + 7 * 86400000);
    const monthStartUTC = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1) - ISTOffsetMs);

    const where = {
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: "insensitive" as const } },
          { contactNumber: { contains: search } },
        ],
      }),
      ...(status       && { status:       status as never }),
      ...(temperature  && { temperature:  temperature as never }),
      ...(activeStatus && { activeStatus: activeStatus as never }),
      ...(platform     && { platform }),
      ...(leadSource   && { leadSource }),
      // USER role: always restrict to their own assigned leads, ignoring any assignedTo filter
      ...(role === "USER"
        ? { assignedTo: user.id }
        : assignedTo === "UNASSIGNED" ? { assignedTo: null } : assignedTo ? { assignedTo } : {}),
      ...(dateCreated === "today" && { createdAt: { gte: todayStartUTC, lt: todayEndUTC } }),
      ...(dateCreated === "week"  && { createdAt: { gte: weekStartUTC } }),
      ...(dateCreated === "month" && { createdAt: { gte: monthStartUTC } }),
      ...(followUp === "overdue"  && { followUpDate: { not: null, lt: todayStartUTC } }),
      ...(followUp === "today"    && { followUpDate: { gte: todayStartUTC, lt: todayEndUTC } }),
      ...(followUp === "week"     && { followUpDate: { gte: todayStartUTC, lt: weekEndUTC } }),
      ...(followUp === "no_date"  && { followUpDate: null }),
    };

    const include = {
      user:         { select: { id: true, name: true, email: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      teamMembers:  { include: { user: { select: { id: true, name: true, email: true } } } },
      comments:     { orderBy: { createdAt: "desc" as const }, take: 1 },
      meetings:     { orderBy: { meetingDate: "asc" as const }, take: 1 },
    };

    if (exportAll) {
      const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, include });
      return NextResponse.json({ success: true, data: leads, pagination: { total: leads.length, page: 1, pageSize: leads.length, totalPages: 1 } });
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create a new lead
export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAuthWithRole();
    if (!user) return response!;

    const body = await req.json();
    const lead = await prisma.lead.create({
      data: {
        customerName:     body.customerName,
        contactNumber:    body.contactNumber,
        alternateContact: body.alternateContact,
        email:            body.email,
        state:            body.state,
        city:             body.city,
        platform:         body.platform || "Meta Ads",
        leadSource:       body.leadSource || "Meta Ads",
        status:           body.status || "NEW",
        temperature:      body.temperature,
        activeStatus:     body.activeStatus || "ACTIVE",
        assignedTo:       body.assignedTo,
        leadCreatedDate:  body.leadCreatedDate ? new Date(body.leadCreatedDate) : new Date(),
        followUpDate:     body.followUpDate ? new Date(body.followUpDate) : null,
        propertyType:     body.propertyType,
        briefScope:       body.briefScope,
        budgetRange:      body.budgetRange,
        requirement:      body.requirement,
        initialNotes:     body.initialNotes,
        userId:           user.id,
      },
    });

    await logLeadActivity({
      leadId: lead.id,
      userId: user.id,
      type: ActivityType.LEAD_CREATED,
      content: `Lead created manually${body.leadSource ? ` from ${body.leadSource}` : ''}`,
    });

    // Fire-and-forget — don't block the response
    void sendNewLeadNotification({
      id: lead.id,
      customerName: lead.customerName,
      contactNumber: lead.contactNumber ?? "",
      city: lead.city,
      platform: lead.platform,
      leadSource: lead.leadSource,
      propertyType: lead.propertyType,
      status: lead.status,
      assignedUser: null,
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error("POST lead error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
