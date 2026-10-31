import { z } from 'zod';
import { ctxOf, formAction } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import * as seats from '#lib/server/services/seats';
import * as joinRequests from '#lib/server/services/join-requests';
import { personInput, requestInput } from '#lib/schemas/campaigns';
import type { ApiCampaign, ApiSeat } from '#lib/api-types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	// The campaign first: a campaign you may not see answers 404 before anything else is asked.
	const campaign: ApiCampaign = await campaigns.get(ctx, event.params.id);
	const member = !!campaign.myRole || campaign.mySeat;
	const seatList: ApiSeat[] = member ? await seats.list(ctx, event.params.id) : [];
	return { campaign, seats: seatList };
};

const opOnly = z.object({});

export const actions = {
	/**
	 * Leave my seat in this campaign; the seat stays, empty.
	 * Who: the seat holder, while the campaign is mustering.
	 * In: form { } (the campaign from the path).
	 * Out: { op: 'leave', done: true }.
	 * Errors: 401 unauthenticated, 404 not_found no seat of mine, 409 conflict not mustering.
	 */
	leave: (event) =>
		formAction(event, opOnly, async (_input, ctx) => {
			await seats.leave(ctx, event.params.id);
			return { op: 'leave', done: true };
		}),
	/**
	 * Ask to join this listed campaign, with an optional note for the CM.
	 * Who: anyone signed in, not seated in it, while it is listed and mustering; one open request per person.
	 * In: form { note? }.
	 * Out: { op: 'ask', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not listed, 404 not_found, 409 conflict a request is
	 * already open, already holds a seat or not mustering.
	 */
	ask: (event) =>
		formAction(event, requestInput, async ({ note }, ctx) => {
			await joinRequests.request(ctx, event.params.id, note);
			return { op: 'ask', done: true };
		}),
	/**
	 * Withdraw my open request to join this campaign.
	 * Who: the person who asked.
	 * In: form { }.
	 * Out: { op: 'withdraw', done: true }.
	 * Errors: 401 unauthenticated, 404 not_found no open request.
	 */
	withdraw: (event) =>
		formAction(event, opOnly, async (_input, ctx) => {
			await joinRequests.withdraw(ctx, event.params.id);
			return { op: 'withdraw', done: true };
		}),
	/**
	 * Hand this campaign's CM role to one of its co-CMs, or take it yourself; the old CM becomes a co-CM.
	 * Who: Owners, member or not (decision 7).
	 * In: form { userId } (a co-CM, or the Owner's own id).
	 * Out: { op: 'transfer', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict not a co-CM or already the
	 * CM.
	 */
	transfer: (event) =>
		formAction(event, personInput, async ({ userId }, ctx) => {
			await campaigns.transfer(ctx, event.params.id, userId);
			return { op: 'transfer', done: true };
		})
} satisfies Actions;
