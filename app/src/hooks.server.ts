import { loadCustomFactions } from '$lib/server/factions';
import { loadZones } from '$lib/server/map';
import { seedStudio } from '$lib/server/starter';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { SESSION_COOKIE, syncAdminAccount, pruneSessions, sessionUser } from '$lib/server/auth';
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

/** Pages a signed-in user can reach before choosing their own password. */
const OPEN_WHILE_TEMPORARY = ['/settings', '/logout', '/login', '/health', '/api/stream'];

export const handle: Handle = async ({ event, resolve }) => {
	const user = await sessionUser(event.cookies.get(SESSION_COOKIE));
	event.locals.user = user;
	event.locals.isAdmin = user?.role === 'cm';

	const path = event.url.pathname;
	// Account settings moved into /settings; keep old links and bookmarks working.
	if (path === '/account' || path.startsWith('/account/')) redirect(308, `/settings${event.url.search}`);
	// The campaign page and the standings listed the same ranking: the standings page carries both now.
	if (path === '/campaign') redirect(308, '/players');
	if (user?.mustChangePassword && !OPEN_WHILE_TEMPORARY.some((p) => path === p || path.startsWith(p + '/')) && !path.startsWith('/_app/') && !path.startsWith('/uploads/'))
		redirect(303, '/settings?first=1');
	// /settings/admin is not under /admin, so it needs naming here too.
	if ((path.startsWith('/admin') || path.startsWith('/settings/admin')) && !event.locals.isAdmin) {
		redirect(303, `/login?next=${encodeURIComponent(path)}`);
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
