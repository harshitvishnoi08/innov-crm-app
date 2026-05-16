import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { logBulkLeadChanges } from "@/lib/lead-activity-log";

export async function PATCH(req: NextRequest) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const body = await req.json();
    const { ids, data } = body as { ids: string[]; data: Record<string, string | null> };

    if (!ids?.length || !data) {
      return NextResponse.json({ error: "ids and data are required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.activeStatus) updateData.activeStatus = data.activeStatus;
    // Only ADMIN can bulk-reassign leads
    if (role === "ADMIN" && data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // USER can only update leads assigned to them
    const where = role === "USER"
      ? { id: { in: ids }, assignedTo: user.id }
      : { id: { in: ids } };

    const result = await prisma.lead.updateMany({ where, data: updateData });

    if (result.count > 0) {
      const updatedLeads = await prisma.lead.findMany({
        where,
        select: { id: true },
      });
      await logBulkLeadChanges({
        leadIds: updatedLeads.map((l: { id: string }) => l.id),
        userId: user.id,
        updateData,
      });
    }

    return NextResponse.json({ success: true, data: { count: result.count } });
  } catch (error) {
    console.error("PATCH bulk leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
