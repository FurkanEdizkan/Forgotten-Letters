import { api } from '#lib/server/http';
import * as frames from '#lib/server/services/card-frames';

/**
 * Every uploaded fighter-card frame, by faction, variant or Sin id.
 * Who: anyone signed in.
 * In: nothing.
 * Out: 200 CardFrames
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => ({ items: await frames.list(ctx) }));
