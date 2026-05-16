import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response!;

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });

    const comments = await prisma.comment.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: comments });
  } catch (error) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response!;

    const body = await req.json();
    if (!body.leadId || !body.content) {
      return NextResponse.json({ error: "leadId and content are required" }, { status: 400 });
    }

    const type = body.type || "note";
    const comment = await prisma.comment.create({
      data: {
        leadId: body.leadId,
        userId: user.id,
        content: body.content,
        type,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // Mirror user notes into lead_activities for a complete audit trail
    if (type === "note") {
      await prisma.leadActivity.create({
        data: {
          leadId: body.leadId,
          userId: user.id,
          activityType: type,
          note: body.content,
          activityDate: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, data: comment });
  } catch (error) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
