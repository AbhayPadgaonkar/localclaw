"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { useSession, signIn } from "next-auth/react";
import { Check, Zap, CreditCard, Clock, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string | undefined;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  handler: (response: unknown) => void;
  theme?: { color: string };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: {
    userId: string;
    planType: string;
  };
}

export default function BillingPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState({
    used: 0,
    limit: 3600,
    isPremium: false,
  });

  // 1. Fetch User Usage on Load
  useEffect(() => {
    const fetchUsage = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch("/api/agent/heartbeat", {
          method: "POST",
          body: JSON.stringify({ userId: session.user.id, increment: false }),
        });
        const data = await res.json();

        const isPro = data.remaining === "unlimited";
        const remaining = isPro ? 3600 : Number(data.remaining) || 0;
        setUsage({
          used: 3600 - remaining,
          limit: 3600,
          isPremium: isPro,
        });
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      }
    };

    if (status === "authenticated") {
      fetchUsage();
    }
  }, [session, status]);

  // 2. Handle Payment Trigger
  const handlePayment = async (type: "subscription" | "one_time") => {
    if (!session?.user?.id) {
      alert("Please log in to upgrade your account.");
      signIn();
      return;
    }

    setLoading(true);
    try {
      // 1. Create Order
      const res = await fetch("/api/razorpay/create-payment", {
        method: "POST",
        body: JSON.stringify({
          type,
          userId: session.user.id,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 2. Configure Razorpay Options
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        name: "LocalClaw Pro",
        description:
          type === "subscription" ? "Monthly Pro Plan" : "30-Day Pass",

        ...(type === "subscription"
          ? { subscription_id: data.id }
          : { order_id: data.id }),

        prefill: {
          name: session.user.name || "",
          email: session.user.email || "",
        },
        notes: {
          userId: session.user.id,
          planType: type,
        },
        handler: function () {
          window.location.href = "/?upgraded=true";
        },
        theme: { color: "#dc2626" },
      };

      // 3. Open Payment Modal
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment failed";
      alert("Payment Error: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 LOGIC UPDATE: Calculate "Remaining" % instead of "Used" %
  const remainingSeconds = Math.max(0, usage.limit - usage.used);
  const remainingPercent = (remainingSeconds / usage.limit) * 100;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden">
      {/* 🟢 Starry Background */}
      <style jsx>{`
        .stars-bg {
          background-color: #000;
          background-image:
            radial-gradient(
              white,
              rgba(255, 255, 255, 0.2) 2px,
              transparent 3px
            ),
            radial-gradient(
              white,
              rgba(255, 255, 255, 0.15) 1px,
              transparent 2px
            ),
            radial-gradient(
              white,
              rgba(255, 255, 255, 0.1) 2px,
              transparent 3px
            );
          background-size:
            550px 550px,
            350px 350px,
            250px 250px;
          background-position:
            0 0,
            40px 60px,
            130px 270px;
        }
      `}</style>

      {/* Background Layer */}
      <div className="absolute inset-0 stars-bg z-0 opacity-80" />

      {/* Content Layer */}
      <div className="relative z-10 p-8">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        <div className="max-w-4xl mx-auto space-y-12">
          {/* HEADER: Inclined & Stylized Logo */}
          <div className="text-center space-y-4 pt-10">
            <h1 className="text-6xl font-black tracking-tighter uppercase transform -skew-x-12">
              <span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                Local
              </span>
              <span className="text-white">Claw</span>
              <span className="text-amber-500 ml-3 text-5xl">Pro</span>
            </h1>
            <p className="text-slate-400 text-lg font-medium">
              Deploy unlimited agents. No daily timeouts.
            </p>
          </div>

          {/* USAGE CARD */}
          {/* USAGE CARD */}
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium uppercase tracking-widest text-slate-300">
                Daily Free Limit Used
              </span>
              <span className="text-xl font-mono">
                {usage.isPremium
                  ? "UNLIMITED"
                  : `${Math.floor(usage.used / 60)} / 60 mins`}{" "}
                {/* 🟢 Shows "58 / 60 mins" */}
              </span>
            </div>

            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  usage.isPremium
                    ? "bg-amber-500 w-full shadow-[0_0_10px_#f59e0b]"
                    : (usage.used / usage.limit) * 100 > 80
                      ? "bg-red-600 animate-pulse" // Red if > 80% used
                      : "bg-emerald-500" // Green if safe
                }`}
                style={{
                  // 🟢 Width increases as you use time
                  width: usage.isPremium
                    ? "100%"
                    : `${(usage.used / usage.limit) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* PRICING GRID */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* OPTION 1: MONTHLY SUBSCRIPTION */}
            <div className="relative group bg-slate-950/80 backdrop-blur-md border border-slate-800 hover:border-red-600/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.1)] transition-all duration-300 rounded-3xl p-8 flex flex-col">
              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl uppercase tracking-widest shadow-lg">
                Best Value
              </div>
              <div className="mb-6">
                <Zap className="w-10 h-10 text-red-500 mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <h3 className="text-2xl font-bold italic">
                  Monthly Auto-Pilot
                </h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black">₹999</span>
                  <span className="text-slate-500">/mo</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500" /> Unlimited
                  Deployment Time
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500" /> Priority
                  Container Queuing
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500" /> Early Access to
                  New Models
                </li>
              </ul>
              <button
                onClick={() => handlePayment("subscription")}
                disabled={loading || usage.isPremium}
                className={`w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${usage.isPremium ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white text-black hover:bg-slate-200 hover:scale-[1.02]"}`}
              >
                {loading ? (
                  "Processing..."
                ) : usage.isPremium ? (
                  "Already Active"
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Subscribe Now
                  </>
                )}
              </button>
            </div>

            {/* OPTION 2: ONE-TIME PASS */}
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 hover:border-slate-600 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-300 rounded-3xl p-8 flex flex-col">
              <div className="mb-6">
                <Clock className="w-10 h-10 text-slate-400 mb-4" />
                <h3 className="text-2xl font-bold italic">30-Day Pass</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black">₹1,200</span>
                  <span className="text-slate-500">/one-time</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-slate-500" /> 30 Days Unlimited
                  Access
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-slate-500" /> No Auto-Renewal
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-slate-500" /> Standard Support
                </li>
              </ul>
              <button
                onClick={() => handlePayment("one_time")}
                disabled={loading || usage.isPremium}
                className={`w-full py-4 font-bold rounded-xl transition-all ${usage.isPremium ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-slate-800 text-white hover:bg-slate-700 hover:scale-[1.02]"}`}
              >
                {loading
                  ? "Processing..."
                  : usage.isPremium
                    ? "Already Active"
                    : "Buy Pass"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 max-w-lg mx-auto pb-10">
            Payments are secured by Razorpay. By upgrading, you agree to our
            Terms of Service. Refunds available within 24 hours of purchase.
          </p>
        </div>
      </div>
    </div>
  );
}
