import { NextRequest, NextResponse } from "next/server";
import { runFollowUpReminders } from "@/lib/followUpReminder";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runFollowUpReminders();
    return NextResponse.json({
      success: true,
      message: `Sent ${results.length} follow-up reminder(s)`,
      results,
    });
  } catch (error) {
    console.error("Follow-up reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
