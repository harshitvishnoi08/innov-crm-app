import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { requireAuth, adminClient } from "@/lib/api-auth";

const BUCKET = "lead-chat-attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response!;

    const form = await req.formData();
    const file = form.get("file");
    const leadId = form.get("leadId");
    const caption = (form.get("caption") as string | null)?.trim() || "";

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 });
    }

    // Ensure the lead exists before we store anything
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const ext = EXT_BY_TYPE[file.type] ?? "bin";
    const path = `${leadId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = adminClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = publicData.publicUrl;

    const comment = await prisma.comment.create({
      data: {
        leadId,
        userId: user.id,
        content: caption,
        type: "image",
        imageUrl,
        imageName: file.name,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // Mirror into the activity log for a complete audit trail
    await prisma.leadActivity.create({
      data: {
        leadId,
        userId: user.id,
        activityType: "image",
        note: caption ? `Photo: ${caption}` : "Photo uploaded",
        activityDate: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: comment });
  } catch (error) {
    console.error("POST comment upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
