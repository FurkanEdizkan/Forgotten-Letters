import { loadCustomFactions } from '$lib/server/factions';
import { loadZones } from '$lib/server/map';
import { seedStudio } from '$lib/server/starter';
import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { accessFor, accessMode } from '$lib/server/access';
import { FORGET_COOKIE, SESSION_COOKIE, sessionCookie, syncAdminAccount, pruneSessions, sessionUser } from '$lib/server/auth';
import { schedule } from '$lib/server/fx';
import { onReload } from '$lib/server/hub';
import { snapshotStale } from '$lib/server/public';
import { currentCampaign } from '$lib/server/campaign';
import { migrateDb, withStartupLock } from '$lib/server/db';
import { importLegacySqlite } from '$lib/server/db/legacy';
import { loadRulesFileIfEmpty } from '$lib/server/rules-data';
import { clientMeta, pruneAudit, recordAudit } from '$lib/server/audit';
import { countRequest, flushActivity } from '$lib/server/activity';
import { adminActionName, isPageView } from '$lib/server/activity-rules';

/** Background upkeep: request counts go to the database every minute; old sessions and log entries go every 6 hours. */
function startUpkeep() {
	const flush = () => flushActivity().catch((e) => console.error('activity flush:', e));
	const prune = () => Promise.all([pruneSessions(), pruneAudit()]).catch((e) => console.error('prune:', e));
	setInterval(flush, 60_000).unref();
	setInterval(prune, 6 * 60 * 60_000).unref();
	process.on('sveltekit:shutdown', () => void flush());
}

/** Routes that log their own account events (with the account as target), so the generic admin log skips them. */
const SELF_LOGGED = new Set(['/admin/players']);

/** Bring the database up to date (and carry over an old SQLite campaign), then start the weather timer. */
export const init: ServerInit = async () => {
	// One instance at a time: parallel starts would race on migrations and seeding.
	await withStartupLock(async () => {
		await migrateDb();
		await importLegacySqlite();
		await syncAdminAccount();
		await loadRulesFileIfEmpty();
		await seedStudio();
	});
	await loadCustomFactions();
	await loadZones();
	// Another instance changed factions or zones: reload this process's copy too.
	onReload((what) => void (what === 'factions' ? loadCustomFactions() : loadZones()).catch((e) => console.error(`reload ${what}:`, e)));
	await pruneSessions();
	await pruneAudit();
	await schedule();
	startUpkeep();
};


export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const user = await sessionUser(token);
	event.locals.user = user;
	event.locals.isAdmin = user?.role === 'cm';
	// The session just slid forward: a remembered cookie follows it (a browser-session cookie stays one).
	if (user?.renewed && token && !event.cookies.get(FORGET_COOKIE))
		event.cookies.set(SESSION_COOKIE, token, sessionCookie(event.url.protocol === 'https:', true));

	const path = event.url.pathname;
	// Account settings moved into /settings; keep old links and bookmarks working.
	if (path === '/account' || path.startsWith('/account/')) redirect(308, `/settings${event.url.search}`);
	// The campaign page and the standings listed the same ranking: the standings page carries both now.
	if (path === '/campaign') redirect(308, '/players');
	// Who may reach what, in either access mode: see lib/server/access.ts (and its tests).
	const access = accessFor(accessMode(env.ACCESS), { path, search: event.url.search, method: event.request.method }, user);
	if ('redirect' in access) redirect(303, access.redirect);
	if ('status' in access) {
		if (path.startsWith('/api/') || path.startsWith('/uploads/') || event.request.method !== 'GET') return json({ message: access.message }, { status: access.status });
		// A page: the root layout raises it, so the app's own error page (with a way back) shows it.
		event.locals.denied = { status: access.status, message: access.message };
	}

	if (user) countRequest(user.id, user.sessionId, { ip: clientMeta(event).ip, pageView: isPageView(event.request.method, path, { accept: event.request.headers.get('accept') }) });

	const response = await resolve(event);

	const mutation = event.request.method !== 'GET' && event.request.method !== 'HEAD';
	// Some changes don't publish: whatever changed, the cached public snapshot must not outlive it.
	if (mutation && response.status < 400 && /^\/(admin|warbands|players)(\/|$)/.test(path)) {
		const c = await currentCampaign();
		if (c) await snapshotStale(c.id).catch((e) => console.error('snapshot cache:', e));
	}

	// Every change the Campaign Master makes: form actions and API calls under /admin (never their bodies).
	if (mutation && path.startsWith('/admin') && !SELF_LOGGED.has(event.route.id ?? '')) {
		const params = Object.entries(event.params);
		recordAudit({
			category: 'admin',
			action: adminActionName(event.route.id, event.url.search, event.request.method),
			actorId: user?.id ?? null,
			actorName: user?.username ?? null,
			targetType: params[0]?.[0] ?? null,
			targetId: params[0]?.[1] ?? null,
			status: response.status,
			...clientMeta(event),
			...(params.length > 1 ? { detail: Object.fromEntries(params) } : {})
		});
	}
	return response;
};
