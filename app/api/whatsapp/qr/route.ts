import { NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    const container = docker.getContainer(agentId);
    
    // --- STEP 1: DOCTOR FIX (Essential for 'not enabled' error) ---
    try {
        console.log(`🔧 [API] Running Doctor Fix for ${agentId}...`);
        const fixExec = await container.exec({
            Cmd: ["node", "openclaw.mjs", "doctor", "--fix"],
            AttachStdout: true,
            AttachStderr: true
        });
        
        const fixStream = await fixExec.start({});
        
        // Wait for fix to complete (Promise wrapper)
        await new Promise((resolve, reject) => {
            fixStream.on('end', resolve);
            fixStream.on('error', reject);
            fixStream.resume(); 
        });

        console.log("✅ [API] Doctor Fix Complete.");
    } catch (e) {
        console.warn("⚠️ [API] Doctor fix warning:", e);
    }

    // --- STEP 2: LOGIN COMMAND (Updated from your Screenshot) ---
    // - Using explicit flag syntax
    const exec = await container.exec({
      Cmd: [
        "node", "openclaw.mjs", 
        "channels", "login", 
        "--channel", "whatsapp" // <--- THE MISSING LINK
      ], 
      AttachStdout: true,
      AttachStderr: true,
      Tty: true, 
      Env: ["TERM=xterm-256color"] 
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Docker Error";
    console.error("💥 [API] Critical Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}