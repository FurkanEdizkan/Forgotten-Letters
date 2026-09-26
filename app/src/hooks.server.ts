import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { ADMIN_COOKIE, isAdmin } from '$lib/server/auth';
import { schedule } from '$lib/server/fx';

/** Start the random weather events timer, if the campaign has it on. */
export const init: ServerInit = () => {
	schedule();
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.isAdmin = isAdmin(event.cookies.get(ADMIN_COOKIE));

	const path = event.url.pathname;
	if (path.startsWith('/admin') && path !== '/admin/login' && !event.locals.isAdmin) {
		redirect(303, `/admin/login?next=${encodeURIComponent(path)}`);
	}

	return resolve(event);
};
