import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { logLeadFieldChanges } from "@/lib/lead-activity-log";
import { sendLeadCrmEvent } from "@/lib/meta-capi";
import { normalizeIndianPhone } from "@/lib/phone";

const TRACKED_FIELDS = [
  "customerName",
  "contactNumber",
  "email",
  "city",
  "state",
  "status",
  "temperature",
  "activeStatus",
  "assignedTo",
  "followUpDate",
  "propertyType",
  "briefScope",
  "budgetRange",
  "requirement",
  "initialNotes",
] as const;

// GET single lead
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        teamMembers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        meetings: {
          orderBy: { meetingDate: "asc" },
          include: { user: { select: { id: true, name: true } } },
        },
        activities: {
          orderBy: { activityDate: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    // USER can only view leads assigned to them
    if (role === "USER" && lead.assignedTo !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error("GET lead error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH update a lead
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // USER can only update leads assigned to them, and cannot reassign
    if (role === "USER") {
      if (existing.assignedTo !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();

    const updateData: Record<string, unknown> = {
      ...(body.customerName && { customerName: body.customerName }),
      ...(body.contactNumber && { contactNumber: normalizeIndianPhone(body.contactNumber) }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.status && { status: body.status }),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.activeStatus && { activeStatus: body.activeStatus }),
      ...(role === "ADMIN" && body.assignedTo !== undefined && { assignedTo: body.assignedTo || null }),
      ...(body.followUpDate !== undefined && {
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        // A new/changed follow-up date re-arms the time-based WhatsApp reminder.
        followUpReminderSent: false,
      }),
      ...(body.followUpHasTime !== undefined && { followUpHasTime: !!body.followUpHasTime }),
      ...(body.propertyType !== undefined && { propertyType: body.propertyType }),
      ...(body.briefScope !== undefined && { briefScope: body.briefScope }),
      ...(body.budgetRange !== undefined && { budgetRange: body.budgetRange }),
      ...(body.requirement !== undefined && { requirement: body.requirement }),
      ...(body.initialNotes !== undefined && { initialNotes: body.initialNotes }),
    };

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    await logLeadFieldChanges({
      leadId: id,
      userId: user.id,
      before: existing as Record<string, unknown>,
      after: lead as Record<string, unknown>,
      fields: [...TRACKED_FIELDS],
    });

    // Meta lead-quality feedback: when a Meta-sourced lead changes status, tell
    // Meta whether it was qualified or junk. Fire-and-forget; never blocks save.
    if (existing.leadgenId && lead.status !== existing.status) {
      void sendLeadCrmEvent({ leadgenId: existing.leadgenId, status: lead.status });
    }

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error("PATCH lead error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE a lead — ADMIN only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE lead error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
