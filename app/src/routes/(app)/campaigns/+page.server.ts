import { z } from 'zod';
import { ctxOf, formAction } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import * as joinRequests from '#lib/server/services/join-requests';
import { canRunCampaigns } from '#lib/campaign-rights';
import { requestInput } from '#lib/schemas/campaigns';
import type { ApiCampaignCard } from '#lib/api-types';
import type { Actions, PageServerLoad } from './$types';

// ponytail: one page of 100 per group; key paging (the services' `next`) once a group has more campaigns than that.
const LIMIT = 100;

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	const runner = !!event.locals.user && canRunCampaigns(event.locals.user.role);
	const [mine, listed, deleted] = await Promise.all([
		campaigns.list(ctx, { scope: 'mine', limit: LIMIT }),
		campaigns.list(ctx, { scope: 'listed', limit: LIMIT }),
		// Only Owners and Admins can be a CM, so only they can have deleted campaigns to see.
		runner ? campaigns.list(ctx, { scope: 'deleted', limit: LIMIT }) : { items: [] }
	]);
	return {
		mine: mine.items as ApiCampaignCard[],
		listed: listed.items as ApiCampaignCard[],
		deleted: deleted.items as ApiCampaignCard[],
		view: event.url.searchParams.get('view') === 'deleted' ? 'deleted' : 'all'
	};
};

const askInput = requestInput.extend({ id: z.uuid() });
const idInput = z.object({ id: z.uuid() });

export const actions = {
	/**
	 * Ask to join a listed campaign, with an optional note for the CM.
	 * Who: anyone signed in, not seated in it, while it is listed and mustering; one open request per person.
	 * In: form { id, note? }.
	 * Out: { op: 'ask', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not listed, 404 not_found, 409 conflict a request is
	 * already open, already holds a seat or not mustering.
	 */
	ask: (event) =>
		formAction(event, askInput, async ({ id, note }, ctx) => {
			await joinRequests.request(ctx, id, note);
			return { op: 'ask', id, done: true };
		}),
	/**
	 * Withdraw my open request to join a campaign.
	 * Who: the person who asked.
	 * In: form { id }.
	 * Out: { op: 'withdraw', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 404 not_found no open request.
	 */
	withdraw: (event) =>
		formAction(event, idInput, async ({ id }, ctx) => {
			await joinRequests.withdraw(ctx, id);
			return { op: 'withdraw', id, done: true };
		}),
	/**
	 * Restore a deleted campaign within 30 days of its deletion.
	 * Who: its CM, or an Owner.
	 * In: form { id }.
	 * Out: { op: 'restore', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found purged, 409 conflict name taken.
	 */
	restore: (event) =>
		formAction(event, idInput, async ({ id }, ctx) => {
			await campaigns.restore(ctx, id);
			return { op: 'restore', id, done: true };
		})
} satisfies Actions;
