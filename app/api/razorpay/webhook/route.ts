import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
// 🟢 IMPORT THE EMAIL FUNCTION
import { sendInvoiceEmail } from "@/lib/email"; 

export async function POST(req: Request) {
  try {
    const body = await req.text(); 
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    // 1. Official Signature Verification
    if (!signature) {
       return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const isValid = validateWebhookSignature(body, signature, secret);

    if (!isValid) {
      console.error("❌ Razorpay Signature Mismatch!");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log("✅ Webhook Received:", event.event);

    // 🟢 HELPER: Fetch User & Send Email
    const sendInvoice = async (userId: string, planName: string, amount: number, txId: string) => {
      try {
        // Fetch user email from DB since webhook doesn't allow PII in notes
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true, name: true }
        });

        if (user?.email) {
          await sendInvoiceEmail(
            user.email, 
            user.name || "Agent", 
            planName, 
            amount, 
            txId
          );
          console.log(`📧 Invoice sent to ${user.email}`);
        }
      } catch (err) {
        console.error("Failed to send invoice:", err);
      }
    };

    // 2. Handle Success Events
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const userId = payment.notes?.userId;
        
        if (!userId) {
          console.error("❌ No userId found in payment notes");
          break;
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); 

        await db.update(users)
          .set({ plan: "pro", premiumExpiresAt: expiryDate })
          .where(eq(users.id, userId));
        
        console.log(`🚀 User ${userId} upgraded to PRO via One-Time Pass`);

        // 🟢 SEND INVOICE (One-Time Pass)
        // Amount is in paise, so divide by 100 (120000 -> 1200)
        await sendInvoice(userId, "30-Day Pass", payment.amount / 100, payment.id);
        break;
      }

      case "subscription.activated": {
        const subscription = event.payload.subscription.entity;
        const subUserId = subscription.notes?.userId;
        
        if (!subUserId) {
          console.error("❌ No userId found in subscription notes");
          break;
        }

        await db.update(users)
          .set({ plan: "pro", razorpaySubscriptionId: subscription.id })
          .where(eq(users.id, subUserId));

        console.log(`🚀 User ${subUserId} upgraded to PRO via Subscription`);

        // 🟢 SEND INVOICE (Subscription)
        // Subscriptions usually don't have 'amount' in activation payload, so we hardcode the plan price
        await sendInvoice(subUserId, "Monthly Auto-Pilot", 999, subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Webhook error";
    console.error("🚨 Webhook Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}