"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import { markAllRead } from "@/lib/notify";

export async function markAllReadAction(): Promise<{ ok: true }> {
  const user = await requireUser();
  // Scoped to the caller inside markAllRead; no id crosses the wire.
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true };
}
