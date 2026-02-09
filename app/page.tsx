"use client";
import { useState, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation"; // 🟢 For Redirects
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  MessageCircle,
  Bot,
  Server,
  CloudLightning,
  Cpu,
  Key,
  Smartphone,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  LogOut,
  CreditCard,
} from "lucide-react";

// --- TYPES ---
interface StarStyle {
  width: string;
  height: string;
  top: string;
  left: string;
  animationDelay: string;
  animationDuration: string;
}

interface ProviderCardProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  desc: string;
}

interface ChannelInputProps {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

// --- SUB-COMPONENT: Starry Effect ---
const Stars = () => {
  const [stars, setStars] = useState<StarStyle[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const generatedStars = [...Array(50)].map(() => ({
        width: `${Math.random() * 2}px`,
        height: `${Math.random() * 2}px`,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${Math.random() * 3 + 2}s`,
      }));
      setStars(generatedStars);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {stars.map((style, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full opacity-40 animate-pulse"
          style={style}
        />
      ))}
    </div>
  );
};

// --- SUB-COMPONENT: Terminal Typewriter ---
const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState("");
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span className="font-mono">
      {displayText}
      <span className="animate-pulse ml-1 inline-block w-2 h-4 bg-white align-middle"></span>
    </span>
  );
};

export default function Wizard() {
  const router = useRouter(); // 🟢 Router for redirects

  // 1. STATE DECLARATIONS
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [deployedId, setDeployedId] = useState("");

  // 🟢 Usage State
  const [usage, setUsage] = useState({ remaining: 3600, isPremium: false });

  const [formData, setFormData] = useState({
    agentName: "",
    provider: "localclaw",
    apiKey: "",
    telegramToken: "",
    whatsappToken: "",
  });
  const hasTelegram = formData.telegramToken.trim().length > 0;
  const hasWhatsapp = formData.whatsappToken.trim().length > 0;

  // 2. TERMINAL REFS
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  // 🟢 3. AUTH & QUOTA CHECK ON LOAD
  useEffect(() => {
    const checkAuthAndQuota = async () => {
      try {
        // We call heartbeat to see if user is logged in and has time
        const res = await fetch("/api/agent/heartbeat", { method: "POST" });

        if (res.status === 401) {
          // Not logged in -> Go to Login
          router.push("/login");
          return;
        }

        const data = await res.json();

        if (data.status === "blocked") {
          // Quota exceeded -> Go to Billing
          router.push("/billing");
          return;
        }

        setUsage({
          remaining:
            data.remaining === "unlimited"
              ? 3600
              : Number(data.remaining) || 3600,
          isPremium: data.remaining === "unlimited",
        });
      } catch (e) {
        console.error("Auth Check Failed", e);
      }
    };

    // Only check when user clicks "Initialize" to avoid spamming before they start
    if (started) {
      checkAuthAndQuota();
    }
  }, [started, router]);

  // 4. EFFECT: Stream QR Code (UNCHANGED)
  useEffect(() => {
    if (
      step === 3 &&
      formData.whatsappToken &&
      deployedId &&
      terminalRef.current
    ) {
      const term = new Terminal({
        theme: { background: "#000000", foreground: "#ffffff" },
        fontSize: 10,
        lineHeight: 0.7,
        cursorBlink: true,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = term;

      let active = true;

      const streamLogs = async () => {
        try {
          term.writeln("Auto-Healing Config...");
          term.writeln("Initializing Secure Handshake...");

          const res = await fetch(`/api/whatsapp/qr?agentId=${deployedId}`);
          if (!res.ok) throw new Error(`Server Error: ${res.status}`);
          if (!res.body) throw new Error("No body in response");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          while (active) {
            const { done, value } = await reader.read();
            if (done) break;
            term.write(decoder.decode(value));
          }
        } catch (err) {
          term.writeln(`\r\nConnection Error: ${String(err)}`);
        }
      };

      streamLogs();
      return () => {
        active = false;
        term.dispose();
        xtermRef.current = null;
      };
    }
  }, [step, formData.whatsappToken, deployedId]);

  const handleDeploy = async () => {
    setLoading(true);
    const agentId =
      (formData.agentName || "agent").toLowerCase().replace(/\s+/g, "-") +
      "-" +
      Math.floor(Math.random() * 1000);
    setDeployedId(agentId);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          provider: formData.provider,
          apiKey: formData.apiKey,
          channels: {
            telegram: formData.telegramToken,
            whatsapp: formData.whatsappToken,
          },
          // 🟢 NOTE: We don't need to send userId anymore, the API gets it from session!
        }),
      });

      const data = await res.json();

      // 🟢 HANDLE SAAS ERRORS
      if (res.status === 403 || data.code === "QUOTA_EXCEEDED") {
        router.push("/billing");
        return;
      }

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (data.success) {
        setResultUrl(data.dashboardUrl);
        setStep(3);
      } else {
        alert("Error: " + data.error);
      }
    } catch {
      alert("Deployment Failed");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden"
      style={{ fontFamily: '"Fira Sans", sans-serif' }}
    >
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;500;600;700&display=swap");
      `}</style>
      <Stars />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

      {/* 🟢 TOP BAR: Usage & Logout */}
      {started && (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
          {/* Usage Badge */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {usage.isPremium ? "PRO PLAN" : "DAILY USAGE"}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    usage.isPremium
                      ? "bg-amber-400"
                      : 3600 - usage.remaining > 3000
                        ? "bg-red-600"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    // 🟢 Fills up as you use it
                    width: usage.isPremium
                      ? "100%"
                      : `${((3600 - usage.remaining) / 3600) * 100}%`,
                  }}
                />
              </div>
              <span
                className={`text-xs font-mono ${usage.isPremium ? "text-amber-400" : "text-white"}`}
              >
                {usage.isPremium
                  ? "∞"
                  : `${Math.floor((3600 - usage.remaining) / 60)} / 60m`}{" "}
                {/* 🟢 Shows "58 / 60m" */}
              </span>
            </div>
          </div>

          {/* Billing Button */}
          {!usage.isPremium && (
            <button
              onClick={() => router.push("/billing")}
              className="p-2 bg-slate-900 border border-slate-700 rounded-full hover:border-red-500 text-slate-400 hover:text-white transition"
              title="Upgrade Plan"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={() =>
              fetch("/api/auth/signout").then(() => router.push("/login"))
            }
            className="p-2 bg-slate-900 border border-slate-700 rounded-full hover:bg-red-900 hover:border-red-600 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      )}

      {/* --- WELCOME SCREEN --- */}
      {!started && (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-red-900/20 rounded-full blur-[160px] pointer-events-none" />
          <div className="text-center space-y-10 max-w-2xl animate-in fade-in zoom-in duration-1000">
            <h1
              className="text-7xl font-black tracking-tighter uppercase italic"
              style={{ fontFamily: "sans-serif" }}
            >
              <span className="text-red-600">Local</span>
              <span className="text-white">Claw</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-lg mx-auto leading-relaxed font-light tracking-wide">
              Deploy autonomous AI agents to your local grid.{" "}
              <span className="block text-red-500/80 font-medium mt-1">
                Zero latency. Total privacy.
              </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-500 pt-4 uppercase tracking-[0.2em]">
              <div className="flex items-center justify-center gap-2 border-r border-white/5 last:border-0">
                <Shield className="w-4 h-4 text-red-600" /> Private
              </div>
              <div className="flex items-center justify-center gap-2 border-r border-white/5 last:border-0">
                <Zap className="w-4 h-4 text-red-500" /> Local
              </div>
              <div className="flex items-center justify-center gap-2">
                <Globe className="w-4 h-4 text-red-400" /> Scalable
              </div>
            </div>
            <button
              onClick={() => setStarted(true)}
              className="group relative inline-flex items-center justify-center px-10 py-5 text-sm font-bold tracking-[0.3em] uppercase text-white transition-all duration-300 bg-red-700/10 border border-red-600/30 rounded-full hover:bg-red-600 hover:text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] mt-4"
            >
              Initialize System{" "}
              <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
          <div className="absolute bottom-6 text-red-900/40 text-[10px] tracking-[0.5em] uppercase font-bold">
            Neural Interface v2.8.0
          </div>
        </div>
      )}

      {/* --- WIZARD FORM --- */}
      {started && (
        <div className="max-w-2xl w-full bg-slate-950/80 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-600/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  System Configuration
                </h1>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                  <span className={step >= 1 ? "text-red-500" : ""}>Brain</span>
                  <span>/</span>
                  <span className={step >= 2 ? "text-red-500" : ""}>
                    Network
                  </span>
                  <span>/</span>
                  <span className={step === 3 ? "text-green-500" : ""}>
                    Sync
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStarted(false)}
              className="text-[10px] uppercase tracking-widest text-slate-600 hover:text-red-500 transition"
            >
              Abort
            </button>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-2 ml-1">
                  Agent Identifier
                </label>
                <input
                  value={formData.agentName}
                  onChange={(e) =>
                    setFormData({ ...formData, agentName: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                  placeholder="JARVIS-01"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 ml-1">
                  Processing Core
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ProviderCard
                    active={formData.provider === "localclaw"}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        provider: "localclaw",
                        apiKey: "",
                      })
                    }
                    icon={Server}
                    title="LocalClaw"
                    desc="Ollama Core"
                  />
                  <ProviderCard
                    active={formData.provider === "openai"}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        provider: "openai",
                        apiKey: "",
                      })
                    }
                    icon={CloudLightning}
                    title="OpenAI"
                    desc="GPT-4o Uplink"
                  />
                  <ProviderCard
                    active={formData.provider === "gemini"}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        provider: "gemini",
                        apiKey: "",
                      })
                    }
                    icon={Cpu}
                    title="Gemini"
                    desc="Flash Matrix"
                  />
                </div>
              </div>
              {formData.provider !== "localclaw" && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-2 ml-1">
                    Access Protocol (API)
                  </label>
                  <div className="relative">
                    <Key className="absolute left-4 top-4 w-5 h-5 text-slate-600" />
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) =>
                        setFormData({ ...formData, apiKey: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 focus:border-red-600 outline-none font-mono text-sm"
                      placeholder="SECRET_KEY"
                    />
                  </div>
                </div>
              )}
              <button
                onClick={() => setStep(2)}
                className="w-full py-5 bg-red-600 text-white hover:bg-red-500 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-600/20"
              >
                Next Sequence
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              <div className="space-y-4">
                <ChannelInput
                  icon={<MessageCircle className="w-5 h-5 text-red-500" />}
                  label="Telegram Bot Uplink"
                  value={formData.telegramToken}
                  onChange={(v) =>
                    setFormData({ ...formData, telegramToken: v })
                  }
                  placeholder="Token..."
                />
                <ChannelInput
                  icon={<Smartphone className="w-5 h-5 text-red-500" />}
                  label="WhatsApp Uplink"
                  value={formData.whatsappToken}
                  onChange={(v) =>
                    setFormData({ ...formData, whatsappToken: v })
                  }
                  placeholder="Auth..."
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl font-bold transition text-slate-400"
                >
                  Back
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={loading}
                  className={`flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed ${loading ? "cursor-wait" : ""}`}
                >
                  {loading ? (
                    <TypewriterText text="Compiling Agent..." />
                  ) : (
                    "Finalize & Launch"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS (XTERM ENABLED) */}
          {step === 3 && (
            <div className="text-center py-12 animate-in zoom-in duration-500">
              <MessageCircle className="w-16 h-16 text-green-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
              <h2>
                {hasWhatsapp
                  ? "WhatsApp QR Link"
                  : hasTelegram
                    ? "Telegram Linked Successfully"
                    : "Agent Ready"}
              </h2>

              {hasWhatsapp && (
                <div className="mt-8 mb-8 w-full max-w-md mx-auto text-left relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-900 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  {/* TERMINAL CONTAINER */}
                  <div
                    ref={terminalRef}
                    className="w-full h-100 bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl p-2"
                  />
                  <p className="text-center text-slate-500 text-[10px] mt-4 uppercase tracking-widest font-bold">
                    Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Scan
                    Code
                  </p>
                </div>
              )}

              {!hasWhatsapp && hasTelegram && (
                <p className="text-green-400 text-sm font-bold">
                  Telegram Bot Connected Successfully ✅
                </p>
              )}
              {hasWhatsapp && hasTelegram && (
                <p className="text-blue-400 text-xs mt-2">
                  Telegram + WhatsApp Active
                </p>
              )}

              <div className="space-y-3">
                <a
                  href={resultUrl}
                  target="_blank"
                  className="block w-full py-5 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl hover:bg-slate-200 transition-all"
                >
                  Initialize Dashboard ↗
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---
function ProviderCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: ProviderCardProps) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all group ${active ? "bg-red-600/10 border-red-600 shadow-lg shadow-red-600/10" : "bg-white/5 border-white/5 hover:border-white/20"}`}
    >
      <div
        className={`mb-3 p-2 rounded-lg w-fit transition-colors ${active ? "bg-red-600 text-white" : "bg-white/5 text-red-500"}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="font-bold text-sm text-white">{title}</div>
      <div className="text-[10px] uppercase font-medium text-slate-400 mt-1 group-hover:text-slate-300 transition-colors">
        {desc}
      </div>
    </button>
  );
}

function ChannelInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: ChannelInputProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-2">
        {icon} {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:border-red-600 outline-none font-mono text-xs text-white placeholder:text-slate-700"
        placeholder={placeholder}
      />
    </div>
  );
}
