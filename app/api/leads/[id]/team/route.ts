import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { ActivityType, logLeadActivity } from "@/lib/lead-activity-log";
import { sendCollaboratorAddedWhatsApp } from "@/lib/lead-collaborator-notification";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const { id: leadId } = await params;
    const body = await req.json();

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        assignedTo: true,
        customerName: true,
        contactNumber: true,
        city: true,
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (role === "USER" && lead.assignedTo !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [member, adder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: body.userId },
        select: { name: true, phone: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      }),
    ]);

    await prisma.leadTeamMember.create({
      data: { leadId, userId: body.userId },
    });

    await logLeadActivity({
      leadId,
      userId: user.id,
      type: ActivityType.TEAM_ADD,
      content: `${member?.name ?? "User"} was added to the team`,
    });

    if (member?.phone) {
      void sendCollaboratorAddedWhatsApp({
        leadId,
        customerName: lead.customerName,
        contactNumber: lead.contactNumber,
        city: lead.city,
        collaboratorName: member.name ?? "Team",
        collaboratorPhone: member.phone,
        addedByName: adder?.name ?? "A teammate",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const { id: leadId } = await params;
    const body = await req.json();

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { assignedTo: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (role === "USER" && lead.assignedTo !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const member = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { name: true },
    });

    await prisma.leadTeamMember.delete({
      where: { leadId_userId: { leadId, userId: body.userId } },
    });

    await logLeadActivity({
      leadId,
      userId: user.id,
      type: ActivityType.TEAM_REMOVE,
      content: `${member?.name ?? "User"} was removed from the team`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE team member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
