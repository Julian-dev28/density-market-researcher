import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

// Fire-and-forget: spawns the agent process and returns immediately.
// The agent writes to Supabase when done; the client polls for new findings.
export async function POST() {
  const root = path.resolve(process.cwd(), "..");

  const child = spawn("npm", ["run", "agent"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });

  child.unref();

  return NextResponse.json({ started: true, pid: child.pid });
}
