import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json(await store.storageInfo());
}
