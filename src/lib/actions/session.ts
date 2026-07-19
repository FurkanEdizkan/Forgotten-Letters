"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/lib/auth";

/** Sign out and return to the landing page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  // Server components cache the signed-in render; without this the
  // navbar keeps showing the user menu after signing out.
  revalidatePath("/", "layout");
}
