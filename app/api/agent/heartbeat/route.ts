import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 🟢 CHANGE 1: Add 'req' back so we can read the body
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🟢 CHANGE 2: Read the 'increment' flag safely
    // We use .catch() in case the body is empty (e.g. simple ping)
    const { increment } = await req.json().catch(() => ({ increment: false }));

    const userId = session.user.id;
    const today = new Date().toISOString().split("T")[0];

    // 1. Fetch User
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check Premium Status
    const isPremium =
      user.plan === "pro" ||
      (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date());

    if (isPremium) {
      return NextResponse.json({ status: "allowed", remaining: "unlimited" });
    }

    let currentSeconds = user.secondsUsedToday ?? 0;

    // 2. LAZY RESET (Keep this outside so checks also reset the day)
    if (user.lastUsageDate !== today) {
      currentSeconds = 0;
      // We always update the date reset, even if just checking
      await db
        .update(users)
        .set({ lastUsageDate: today, secondsUsedToday: 0 })
        .where(eq(users.id, userId));
    }

    // 3. ENFORCE LIMIT
    if (currentSeconds >= 3600) {
      return NextResponse.json(
        {
          status: "blocked",
          reason: "daily_quota_exceeded",
          remaining: 0, // 🟢 ADD THIS: Tell the UI exactly 0 is left
        },
        { status: 200 },
      );
    }

    // 🟢 CHANGE 3: Only add time if the frontend explicitly asked for it
    if (increment) {
      await db
        .update(users)
        .set({ secondsUsedToday: currentSeconds + 60 }) // Adds 1 minute
        .where(eq(users.id, userId));

      // Update local variable for accurate return value
      currentSeconds += 60;
    }

    return NextResponse.json({
      status: "allowed",
      remaining: 3600 - currentSeconds,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Heartbeat Error:", msg);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
