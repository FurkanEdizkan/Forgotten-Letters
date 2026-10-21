import { api, parse } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { pageQuery } from '#lib/schemas/auth';

/**
 * A page of people, oldest first.
 * Who: owners (everyone) and admins (the people they invited).
 * In: query ?after=<id>&limit=<1..100, default 50>
 * Out: 200 { items: Person[], next }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden for users.
 */
export const GET = api(async (event, ctx) =>
	people.list(ctx, parse(pageQuery, Object.fromEntries(event.url.searchParams)))
);
