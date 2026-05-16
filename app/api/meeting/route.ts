import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { ActivityType, logLeadActivity } from "@/lib/lead-activity-log";

function formatMeetingDate(date: Date | string) {
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export async function GET(req: NextRequest) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    // USER role: only meetings for leads assigned to them
    const where = leadId
      ? { leadId }
      : role === "USER"
        ? { lead: { assignedTo: user.id } }
        : {};

    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: { meetingDate: "asc" },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, customerName: true, contactNumber: true } },
      },
    });

    return NextResponse.json({ success: true, data: meetings });
  } catch (error) {
    console.error("GET meetings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAuthWithRole();
    if (!user) return response!;

    const body = await req.json();
    if (!body.leadId || !body.agenda || !body.meetingDate) {
      return NextResponse.json({ error: "leadId, agenda and meetingDate are required" }, { status: 400 });
    }

    const meeting = await prisma.meeting.create({
      data: {
        leadId: body.leadId,
        userId: user.id,
        agenda: body.agenda,
        meetingDate: new Date(body.meetingDate),
      },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, customerName: true, contactNumber: true } },
      },
    });

    await logLeadActivity({
      leadId: body.leadId,
      userId: user.id,
      type: ActivityType.MEETING,
      content: `📅 Meeting scheduled for ${formatMeetingDate(body.meetingDate)} — ${body.agenda}`,
    });

    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    console.error("POST meeting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, response } = await requireAuthWithRole();
    if (!user) return response!;

    const body = await req.json();
    if (!body.id || !body.agenda || !body.meetingDate) {
      return NextResponse.json({ error: "id, agenda and meetingDate are required" }, { status: 400 });
    }

    const existing = await prisma.meeting.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meeting = await prisma.meeting.update({
      where: { id: body.id },
      data: {
        agenda: body.agenda,
        meetingDate: new Date(body.meetingDate),
        reminderSent: false,
      },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, customerName: true, contactNumber: true } },
      },
    });

    await logLeadActivity({
      leadId: existing.leadId,
      userId: user.id,
      type: ActivityType.MEETING_UPDATED,
      content: `📅 Meeting updated: ${formatMeetingDate(body.meetingDate)} — ${body.agenda} (was ${formatMeetingDate(existing.meetingDate)} — ${existing.agenda})`,
    });

    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    console.error("PATCH meeting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, response } = await requireAuthWithRole();
    if (!user) return response!;

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.meeting.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await prisma.meeting.delete({ where: { id: body.id } });

    await logLeadActivity({
      leadId: existing.leadId,
      userId: user.id,
      type: ActivityType.MEETING_CANCELLED,
      content: `📅 Meeting cancelled: ${formatMeetingDate(existing.meetingDate)} — ${existing.agenda}`,
    });

    return NextResponse.json({ success: true, data: { deletedId: body.id } });
  } catch (error) {
    console.error("DELETE meeting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
