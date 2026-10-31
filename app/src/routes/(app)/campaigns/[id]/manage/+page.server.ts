import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { ctxOf, formAction, orPageError } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import * as seats from '#lib/server/services/seats';
import * as joinRequests from '#lib/server/services/join-requests';
import { canInCampaign } from '#lib/campaign-rights';
import {
	approveInput,
	campaignPatch,
	candidatesQuery,
	personInput,
	seatCount,
	seatName,
	stageMove
} from '#lib/schemas/campaigns';
import type { ApiCampaign, ApiJoinRequest, ApiSeat, ApiSeatLink } from '#lib/api-types';
import { m } from '#lib/messages';
import { requireSignedIn } from '../../../guard';
import { withJsonField } from '../../form';
import type { Actions, PageServerLoad } from './$types';

type Candidate = { id: string; displayName: string; username: string };

/** A search box's text as the candidates query, or null when empty or not valid. */
const query = (url: URL, key: string) => {
	const r = candidatesQuery.safeParse({ q: url.searchParams.get(key) ?? '' });
	return r.success ? r.data.q : null;
};

export const load: PageServerLoad = async (event) => {
	const me = requireSignedIn(event);
	const ctx = ctxOf(event);
	const id = event.params.id;
	const campaign: ApiCampaign = await orPageError(event, campaigns.get(ctx, id));
	if (!canInCampaign(campaign.myRole, me.role, 'manage'))
		error(403, m.errors.forbidden, { requestId: event.locals.requestId });
	const can = (a: Parameters<typeof canInCampaign>[2]) =>
		canInCampaign(campaign.myRole, me.role, a);
	// "Fill a seat by name" and "Add a co-CM" search through the page's own query, so they work without scripts.
	const find = query(event.url, 'find');
	const cmFind = query(event.url, 'cmfind');
	const [seatList, requests, candidates, coCmCandidates]: [
		ApiSeat[],
		ApiJoinRequest[],
		Candidate[],
		Candidate[]
	] = await Promise.all([
		seats.list(ctx, id),
		can('requests') ? joinRequests.listOpen(ctx, id) : [],
		find && can('seats') ? seats.candidates(ctx, id, find) : [],
		cmFind && can('co_cms') ? campaigns.coCmCandidates(ctx, id, cmFind) : []
	]);
	return {
		campaign,
		seats: seatList,
		requests,
		find: find ?? '',
		candidates,
		cmFind: cmFind ?? '',
		coCmCandidates,
		created: event.url.searchParams.has('created'),
		tab: event.url.searchParams.get('tab') ?? 'seats'
	};
};

const row = z.object({ id: z.uuid() });
const versioned = row.extend({ version: z.coerce.number().int().min(1) });
const nothing = z.object({});

export const actions = {
	/**
	 * Move the campaign to another stage: start it, end it, or take it back to mustering.
	 * Who: the CM and co-CMs.
	 * In: form stageMove { to }.
	 * Out: { op: 'stage', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict stage move not allowed.
	 */
	stage: (event) =>
		formAction(event, stageMove, async ({ to }, ctx) => {
			await campaigns.moveStage(ctx, event.params.id, to);
			return { op: 'stage', done: true };
		}),
	/**
	 * Save the campaign's settings and house rules, with a version check.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form campaignPatch { name, description, gamesPerPlayer?, startsOn?, endsOn?, visibility, houseRules (JSON),
	 * version }.
	 * Out: { op: 'settings', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict changed meanwhile, name
	 * taken or campaign ended.
	 */
	settings: (event) =>
		formAction(event, withJsonField(campaignPatch, 'houseRules'), async (input, ctx) => {
			await campaigns.update(ctx, event.params.id, input);
			return { op: 'settings', done: true };
		}),
	/**
	 * Add empty seats, named on after the last one.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form seatCount { count }.
	 * Out: { op: 'addSeats', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict 30 seats at most.
	 */
	addSeats: (event) =>
		formAction(event, seatCount, async ({ count }, ctx) => {
			await seats.add(ctx, event.params.id, count);
			return { op: 'addSeats', done: true };
		}),
	/**
	 * Rename a seat.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form { id, version, name }.
	 * Out: { op: 'rename', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict changed meanwhile.
	 */
	rename: (event) =>
		formAction(event, versioned.extend({ name: seatName }), async ({ id, version, name }, ctx) => {
			await seats.update(ctx, event.params.id, id, { version, name });
			return { op: 'rename', id, done: true };
		}),
	/**
	 * Free a seat: its player leaves the campaign; the seat stays, empty.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form { id, version }.
	 * Out: { op: 'free', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict changed meanwhile.
	 */
	free: (event) =>
		formAction(event, versioned, async ({ id, version }, ctx) => {
			await seats.update(ctx, event.params.id, id, { version, free: true });
			return { op: 'free', id, done: true };
		}),
	/**
	 * Remove an empty seat.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form { id }.
	 * Out: { op: 'removeSeat', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict seat taken.
	 */
	removeSeat: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			await seats.remove(ctx, event.params.id, id);
			return { op: 'removeSeat', id, done: true };
		}),
	/**
	 * Make a one-time link for an empty seat, shown only now; it revokes the seat's open link.
	 * Who: the CM and co-CMs, while the campaign is mustering.
	 * In: form { id }.
	 * Out: { op: 'link', id, link: { seatId, seatName, url, expiresAt } }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict seat taken or joining
	 * closed.
	 */
	link: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			const link: ApiSeatLink = await seats.makeLink(ctx, event.params.id, id);
			return { op: 'link', id, link };
		}),
	/**
	 * Make links for every empty seat at once, each shown only now; their old links are revoked.
	 * Who: the CM and co-CMs, while the campaign is mustering.
	 * In: form { }.
	 * Out: { op: 'links', links: { seatId, seatName, url, expiresAt }[] }.
	 * Errors: 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict joining closed.
	 */
	links: (event) =>
		formAction(event, nothing, async (_input, ctx) => {
			const links: ApiSeatLink[] = await seats.makeAllLinks(ctx, event.params.id);
			return { op: 'links', links };
		}),
	/**
	 * Revoke a seat's open link; it stops working.
	 * Who: the CM and co-CMs.
	 * In: form { id }.
	 * Out: { op: 'revoke', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	revoke: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			await seats.revokeLink(ctx, event.params.id, id);
			return { op: 'revoke', id, done: true };
		}),
	/**
	 * Fill an empty seat with an existing account, picked by name.
	 * Who: the CM and co-CMs, until the campaign ends.
	 * In: form { userId, seatId }.
	 * Out: { op: 'assign', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict seat taken or already
	 * holds a seat.
	 */
	assign: (event) =>
		formAction(event, personInput.merge(approveInput), async ({ userId, seatId }, ctx) => {
			await seats.assign(ctx, event.params.id, seatId, userId);
			return { op: 'assign', done: true };
		}),
	/**
	 * Approve a request to join into an empty seat.
	 * Who: the CM and co-CMs.
	 * In: form { id (the request), seatId }.
	 * Out: { op: 'approve', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict seat taken or request
	 * already decided.
	 */
	approve: (event) =>
		formAction(event, row.merge(approveInput), async ({ id, seatId }, ctx) => {
			await joinRequests.approve(ctx, event.params.id, id, seatId);
			return { op: 'approve', id, done: true };
		}),
	/**
	 * Decline a request to join.
	 * Who: the CM and co-CMs.
	 * In: form { id (the request) }.
	 * Out: { op: 'decline', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict request already decided.
	 */
	decline: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			await joinRequests.decline(ctx, event.params.id, id);
			return { op: 'decline', id, done: true };
		}),
	/**
	 * Add a co-CM: an active Admin or Owner.
	 * Who: the CM.
	 * In: form { userId }.
	 * Out: { op: 'addCoCm', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict not an Admin or Owner.
	 */
	addCoCm: (event) =>
		formAction(event, personInput, async ({ userId }, ctx) => {
			await campaigns.addCoCm(ctx, event.params.id, userId);
			return { op: 'addCoCm', done: true };
		}),
	/**
	 * Remove a co-CM; they keep their seat if they hold one.
	 * Who: the CM.
	 * In: form { id (the co-CM's user id) }.
	 * Out: { op: 'removeCoCm', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	removeCoCm: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			await campaigns.removeCoCm(ctx, event.params.id, id);
			return { op: 'removeCoCm', id, done: true };
		}),
	/**
	 * Hand the CM role to a co-CM; the old CM becomes a co-CM.
	 * Who: the CM, or an Owner.
	 * In: form { id (the co-CM's user id) }.
	 * Out: { op: 'transfer', id, done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict not a co-CM.
	 */
	transfer: (event) =>
		formAction(event, row, async ({ id }, ctx) => {
			await campaigns.transfer(ctx, event.params.id, id);
			return { op: 'transfer', id, done: true };
		}),
	/**
	 * Delete the campaign for everyone; the CM or an Owner can restore it within 30 days.
	 * Who: the CM.
	 * In: form { }.
	 * Out: 303 to /campaigns?view=deleted.
	 * Errors: 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	remove: (event) =>
		formAction(event, nothing, async (_input, ctx) => {
			await campaigns.remove(ctx, event.params.id);
			redirect(303, '/campaigns?view=deleted');
		})
} satisfies Actions;
