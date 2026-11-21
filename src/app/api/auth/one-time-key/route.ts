import { NextResponse } from "next/server";
import { createOtk } from "@/lib/auth";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json(await createOtk());
}
