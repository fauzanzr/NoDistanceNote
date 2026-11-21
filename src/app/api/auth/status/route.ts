import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/session";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAuthed(),
    pinRequired: !!process.env.MASTER_PIN,
    storage: storageMode,
  });
}
