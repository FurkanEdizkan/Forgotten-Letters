import { redirect } from '@sveltejs/kit';
import { formAction } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { campaignCreate } from '#lib/schemas/campaigns';
import { requireRole } from '../../guard';
import { withJsonField } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireRole(event, 'admin');
};

export const actions = {
	/**
	 * Create a campaign from the wizard: the campaign, its CM (the creator) and its seats, in one transaction.
	 * Who: Owners and Admins.
	 * In: form campaignCreate { name, kind, description, gamesPerPlayer?, startsOn?, endsOn?, visibility, seats,
	 * houseRules (JSON) } (the wizard's six steps).
	 * Out: 303 to the new campaign's manage page (?created=1, which shows the "Campaign created" message).
	 * Errors: 400 invalid with field reasons (the wizard returns to that step), 401 unauthenticated, 403 forbidden,
	 * 409 conflict name taken (on the name field).
	 */
	create: (event) =>
		formAction(event, withJsonField(campaignCreate, 'houseRules'), async (input, ctx) => {
			const { campaign } = await campaigns.create(ctx, input);
			redirect(303, `/campaigns/${campaign.id}/manage?created=1`);
		})
} satisfies Actions;
