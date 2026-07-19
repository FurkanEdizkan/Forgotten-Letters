import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScenarioEditor } from "@/components/scenario-form/ScenarioEditor";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { gameSystems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "New scenario" };

export default async function NewScenarioPage() {
  // Middleware already redirects anonymous users, but the guard is
  // repeated here: middleware only checks for a cookie, and a page that
  // reads user data must not depend on that alone.
  await requireUser();

  const systems = await db
    .select({ id: gameSystems.id, name: gameSystems.name })
    .from(gameSystems)
    .where(eq(gameSystems.isActive, true));

  // Nothing can be authored without a game system; sending the user to
  // an editor with an empty select would fail validation on save.
  if (systems.length === 0) redirect("/scenarios");

  return <ScenarioEditor systems={systems} />;
}
