/** Page guards for the signed-in areas. Layouts guard pages only; actions rely on the services' own checks. */
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { can, type Role } from '#lib/roles';
import { m } from '#lib/messages';

/** The signed-in person, or a redirect to sign in that returns here afterwards. */
export function requireSignedIn({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return locals.user;
}

/** The signed-in person with at least this role, or a 403 page. */
export function requireRole(event: Pick<RequestEvent, 'locals' | 'url'>, role: Role) {
	const user = requireSignedIn(event);
	if (!can(user, role)) error(403, m.errors.forbidden, { requestId: event.locals.requestId });
	return user;
}
