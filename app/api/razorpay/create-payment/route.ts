import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { type, userId } = await req.json();

    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    if (type === "subscription") {
      // 🟢 OPTION 1: RECURRING AUTOPAY
      const subscription = await razorpay.subscriptions.create({
        plan_id: process.env.RAZORPAY_PLAN_ID!, // From Razorpay Dashboard
        customer_notify: 1,
        total_count: 12,
        notes: { userId },
      });
      return NextResponse.json({ id: subscription.id, type: "subscription" });
    } else {
      // 🟢 OPTION 2: ONE-TIME 30-DAY PASS
      const order = await razorpay.orders.create({
        amount: 120000, // ₹1200.00 in paise
        currency: "INR",
        notes: { userId, type: "one_time_pass" },
      });
      return NextResponse.json({ id: order.id, type: "order" });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Payment Init Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}