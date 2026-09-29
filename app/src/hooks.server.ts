import { loadCustomFactions } from '$lib/server/factions';
import { loadZones } from '$lib/server/map';
import { seedStudio } from '$lib/server/starter';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { SESSION_COOKIE, ensureCmAccount, pruneSessions, sessionUser } from '$lib/server/auth';
import { schedule } from '$lib/server/fx';
import { migrateDb } from '$lib/server/db';
import { importLegacySqlite } from '$lib/server/db/legacy';
import { loadRulesFileIfEmpty } from '$lib/server/rules-data';

/** Bring the database up to date (and carry over an old SQLite campaign), then start the weather timer. */
export const init: ServerInit = async () => {
	await migrateDb();
	await importLegacySqlite();
	await ensureCmAccount();
	await loadRulesFileIfEmpty();
	await seedStudio();
	await loadCustomFactions();
	await loadZones();
	await pruneSessions();
	await schedule();
};

/** Pages a signed-in user can reach before choosing their own password. */
const OPEN_WHILE_TEMPORARY = ['/settings', '/logout', '/login', '/health', '/api/stream'];

export const handle: Handle = async ({ event, resolve }) => {
	const user = await sessionUser(event.cookies.get(SESSION_COOKIE));
	event.locals.user = user;
	event.locals.isAdmin = user?.role === 'cm';

	const path = event.url.pathname;
	// Account settings moved into /settings; keep old links and bookmarks working.
	if (path === '/account' || path.startsWith('/account/')) redirect(308, `/settings${event.url.search}`);
	if (user?.mustChangePassword && !OPEN_WHILE_TEMPORARY.some((p) => path === p || path.startsWith(p + '/')) && !path.startsWith('/_app/') && !path.startsWith('/uploads/'))
		redirect(303, '/settings?first=1');
	// /settings/admin is not under /admin, so it needs naming here too.
	if ((path.startsWith('/admin') || path.startsWith('/settings/admin')) && !event.locals.isAdmin) {
		redirect(303, `/login?next=${encodeURIComponent(path)}`);
	}

	return resolve(event);
};
