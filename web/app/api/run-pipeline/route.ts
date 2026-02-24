import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  const root = path.resolve(process.cwd(), "..");

  const child = spawn("npm", ["run", "dev", "--", "--mode", "all"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });

  child.unref();

  return NextResponse.json({ started: true, pid: child.pid });
}
