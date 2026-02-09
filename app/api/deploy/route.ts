import { NextResponse } from "next/server";
import Docker from "dockerode";
import fs from "fs";
import path from "path";
// 🟢 SAAS IMPORTS
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
// 🟢 AUTH IMPORT (New)
import { auth } from "@/auth";

// --- TYPE DEFINITIONS ---




// Connect to Docker
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// CRITICAL: Physical path on your Windows D: drive
const HOST_AGENTS_PATH = "D:\\abhay_projects\\localclaw\\agents";

// 🟢 1. SYSTEM PROMPT RULE (For WhatsApp Targeting)


// --- HELPER 1: The "Janitor" (Cleanup Orphaned Agents) ---
async function cleanupOrphanedAgents() {
  console.log("🧹 Starting deep cleanup (Containers + Folders)...");
  try {
    const containers = await docker.listContainers({ all: true });
    const targets = containers.filter((c) =>
      c.Names.some(
        (name) => name.includes("agent-") || name.includes("telebot-"),
      ),
    );

    if (targets.length === 0) {
      console.log("✨ No orphaned agents found.");
      return;
    }

    console.log(`🗑️ Found ${targets.length} orphaned agents. Purging...`);

    for (const cInfo of targets) {
      const agentId = cInfo.Names[0].replace("/", "");
      const agentFolderPath = path.join(HOST_AGENTS_PATH, agentId);

      try {
        const container = docker.getContainer(cInfo.Id);
        await container.remove({ force: true });
        console.log(`✅ Docker Container Removed: ${agentId}`);

        if (fs.existsSync(agentFolderPath)) {
          fs.rmSync(agentFolderPath, { recursive: true, force: true });
          console.log(`📂 Local Directory Deleted: ${agentId}`);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Partial cleanup for ${agentId}: ${msg}`);
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Cleanup failed:", msg);
  }
}

// --- HELPER 2: Ensure Local Model Exists ---
async function ensureLocalModel(modelName: string) {
  const OLLAMA_API = "http://localclaw-ollama-1:11434";
  console.log(`🔍 Checking if ${modelName} exists in LocalClaw...`);

  try {
    const listReq = await fetch(`${OLLAMA_API}/api/tags`);
    const listData = await listReq.json();
    const exists = listData.models.some((m: any) => m.name.includes(modelName));

    if (exists) {
      console.log(`✅ ${modelName} is ready!`);
      return;
    }

    console.log(
      `⬇️ Model missing. Pulling ${modelName}... (This may take time)`,
    );
    const pullReq = await fetch(`${OLLAMA_API}/api/pull`, {
      method: "POST",
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (!pullReq.ok)
      throw new Error(`Ollama Pull Failed: ${pullReq.statusText}`);
    console.log(`🎉 ${modelName} installed successfully!`);
  } catch (error) {
    console.error("❌ LocalClaw Error:", error);
    console.warn("Proceeding with deployment despite Ollama check failure...");
  }
}

// --- HELPER 3: The Config Generator ---
function generateConfig(
  agentId: string,
  provider: string,
  apiKey: string,
  channels: any,
) {
  const isLocal = provider === "localclaw" || provider === "local";
  const modelId = isLocal
    ? "qwen2.5:7b"
    : provider === "openai"
      ? "gpt-4o"
      : "gemini-1.5-flash";
  const providerKey = isLocal
    ? "ollama"
    : provider === "openai"
      ? "openai"
      : "google";

 const config: any = {
    tools: {
      profile: "messaging",
    },
    agents: {
      defaults: {
        maxConcurrent: 4,
        workspace: "/root/openclaw/workspace",
        model: {
          primary: isLocal ? `ollama/${modelId}` : `${providerKey}/${modelId}`,
        },
      },
    },
    models: {
      providers: {
        [providerKey]: isLocal
          ? {
              baseUrl: "http://localclaw-ollama-1:11434/v1",
              apiKey: "ollama",
              api: "openai-responses",
              models: [{ id: modelId, name: modelId }],
            }
          : {
              apiKey: apiKey,
              models: [{ id: modelId, name: "Cloud Model" }],
            },
      },
    },
    gateway: {
      bind: "lan",
      port: 18789,
      controlUi: {
        allowInsecureAuth: true,
      },
      auth: {
        mode: "token",
        token: process.env.OPENCLAW_GATEWAY_TOKEN || "localclaw_master_token",
      },
    },
    channels: {},
  };

  if (channels?.telegram) {
    config.channels["telegram"] = {
      enabled: true,
      botToken: channels.telegram,
      dmPolicy: "open",
      allowFrom: ["*"],
    };
  }

  if (channels?.whatsapp) {
    const userPhone = channels.whatsapp.startsWith("+")
      ? channels.whatsapp.trim()
      : `+${channels.whatsapp.trim()}`;

    config.channels["whatsapp"] = {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: [userPhone],
      sendReadReceipts: true,
      ackReaction: {
        emoji: "👀",
        direct: true,
      },
    };
  }
  return JSON.stringify(config, null, 2);
}

// --- MAIN API HANDLER ---
export async function POST(req: Request) {
  try {
    // 🟢 AUTH CHECK (Replaces manual userId)
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 },
      );
    }

    // Authenticated User ID
    const userId = session.user.id;

    const body = await req.json();
    // Removed 'userId' from body destructuring since we trust the session
    const { agentId, provider, apiKey, channels } = body;
    const imageName = "alpine/openclaw:latest";

    // 🟢 3. SAAS GUARD: Check 1-Hour Limit Logic
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user) {
      // Check if premium (Plan is 'pro' OR One-Time Pass is valid)
      const isPremium =
        user.plan === "pro" ||
        (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date());

      const usedSeconds = user.secondsUsedToday ?? 0;

      // Block if not premium and over 1 hour (3600 seconds)
      if (!isPremium && usedSeconds >= 3600) {
        return NextResponse.json(
          {
            error: "Daily Quota Exceeded. Upgrade to continue.",
            code: "QUOTA_EXCEEDED",
          },
          { status: 403 },
        );
      }
    } else {
      // Fallback: If session exists but DB user missing (rare edge case)
      return NextResponse.json(
        { error: "User record not found" },
        { status: 404 },
      );
    }

    // --- CLEANUP ---
    await cleanupOrphanedAgents();

    // --- MODEL CHECK ---
    if (provider === "localclaw" || provider === "local") {
      await ensureLocalModel("qwen2.5:7b");
    }

    // --- IMAGE PULL ---
    console.log(`📡 Checking for image: ${imageName}`);
    try {
      await docker.getImage(imageName).inspect();
      console.log("✅ Image already exists locally.");
    } catch {
      console.log(`⬇️ Image missing. Pulling ${imageName}...`);
      const stream = await docker.pull(imageName);
      await new Promise((resolve, reject) => {
        // Explicitly type callbacks to fix build error
        docker.modem.followProgress(stream, (err: any, res: any) =>
          err ? reject(err) : resolve(res),
        );
      });
      console.log("🎉 Pull complete!");
    }

    // --- DIRECTORY SETUP ---
    const agentDir = path.join(process.cwd(), "agents", agentId);
    const configDir = path.join(agentDir, ".openclaw");
    const workspaceDir = path.join(agentDir, "workspace");
    const whatsappAuthDir = path.join(
      configDir,
      "credentials",
      "whatsapp",
      "default",
    );

    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (!fs.existsSync(workspaceDir))
      fs.mkdirSync(workspaceDir, { recursive: true });
    if (!fs.existsSync(whatsappAuthDir)) {
      fs.mkdirSync(whatsappAuthDir, { recursive: true });
    }

    // --- CONFIG GENERATION ---
    const configJSON = generateConfig(agentId, provider, apiKey, channels);
    fs.writeFileSync(path.join(configDir, "openclaw.json"), configJSON);

    // --- CONTAINER SPAWN ---
    const existingContainer = docker.getContainer(agentId);
    try {
      await existingContainer.remove({ force: true });
    } catch {
      /* Ignore */
    }


    const container = await docker.createContainer({
      Image: imageName,
      name: agentId,
      User: "0:0",
      Labels: {
        "com.docker.compose.project": "localclaw",
        "com.docker.compose.service": "agent",
        "com.docker.compose.oneoff": "False",
      },
   
      HostConfig: {
        NetworkMode: "localclaw_default",
        Binds: [
          `${HOST_AGENTS_PATH}/${agentId}/.openclaw:/root/.openclaw`,
          `${HOST_AGENTS_PATH}/${agentId}/workspace:/root/openclaw/workspace`,
        ],
        PortBindings: { "18789/tcp": [{ HostPort: "0" }] },

        RestartPolicy: { Name: "unless-stopped" },
      },
      Cmd: [
        "node",
        "openclaw.mjs",
        "gateway",
        "--bind",
        "lan",
        "--allow-unconfigured",
       
      ],
    });

    await container.start();

    const info = await container.inspect();
    const port = info.NetworkSettings.Ports["18789/tcp"][0].HostPort;

    return NextResponse.json({
      success: true,
      port: port,
       dashboardUrl: `http://localhost:${port}/?token=${process.env.OPENCLAW_GATEWAY_TOKEN || "localclaw_master_token"}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Deployment Failed:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
