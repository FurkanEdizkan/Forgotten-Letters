/**
 * Health check.
 *
 * Reports reachability of every backing service. Used by the container
 * healthcheck and, later, by the load balancer — so it must never cache
 * and must never throw: a failing dependency is reported as a false flag
 * with a 503, not a stack trace.
 */
import { pingDb } from "@/lib/db/client";
import { pingStorage } from "@/lib/storage/r2";
import { pingMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [database, storage, mail] = await Promise.all([
    pingDb(),
    pingStorage(),
    pingMail(),
  ]);

  const healthy = database && storage && mail;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database, storage, mail },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
