import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { formAction, setSessionCookie } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { signIn } from '#lib/server/services/auth';
import { newAccountInput, signInInput } from '#lib/schemas/auth';
import type { ApiSeatInvitePreview } from '#lib/api-types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const preview: ApiSeatInvitePreview | { state: 'unknown' } = await seats.preview(params.token);
	return { preview, signedInAs: locals.user?.displayName ?? null };
};

const toCampaign = (campaignId: string) => redirect(303, `/campaigns/${campaignId}`);

export const actions = {
	/**
	 * Take the seat with the account already signed in.
	 * Who: anyone signed in who holds the seat link.
	 * In: form { } (the token from the path).
	 * Out: 303 to the campaign's page.
	 * Errors: 401 unauthenticated, 404 not_found unknown or expired link, 409 conflict link used or revoked, already
	 * holds a seat.
	 */
	take: (event) =>
		formAction(event, z.object({}), async (_input, ctx) => {
			const { campaignId } = await seats.accept(event.params.token, {}, ctx);
			toCampaign(campaignId);
		}),
	/**
	 * Sign in, then take the seat with that account.
	 * Who: anyone holding the seat link with an account here.
	 * In: form { username, password }.
	 * Out: 303 to the campaign's page, with a browser-session cookie.
	 * Errors: 400 invalid, 401 unauthenticated wrong username or password, 404 not_found unknown or expired link,
	 * 409 conflict link used or revoked, already holds a seat, 429 rate_limited.
	 */
	signin: (event) =>
		formAction(event, signInInput, async (input, ctx) => {
			const { session, user } = await signIn(input, ctx);
			setSessionCookie(event, session);
			// Signed in now even if the seat is gone, so a refused link still leaves the person in.
			const { campaignId } = await seats.accept(event.params.token, {}, { ...ctx, actor: user });
			toCampaign(campaignId);
		}),
	/**
	 * Create an account and take the seat with it, in one step.
	 * Who: anyone holding the seat link, signed out.
	 * In: form { username, displayName, password }.
	 * Out: 303 to the campaign's page, with a browser-session cookie for the new account.
	 * Errors: 400 invalid (taken username, common password), 404 not_found unknown or expired link, 409 conflict
	 * link used or revoked, 429 rate_limited.
	 */
	signup: (event) =>
		formAction(event, newAccountInput, async (input, ctx) => {
			const { campaignId, session } = await seats.accept(event.params.token, input, ctx);
			if (session) setSessionCookie(event, session);
			toCampaign(campaignId);
		})
} satisfies Actions;
