import { redirect } from '@sveltejs/kit';
import { ctxOf, formAction, orPageError } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import * as warbands from '#lib/server/services/warbands';
import { warbandCreate } from '#lib/schemas/warbands';
import { requireSignedIn } from '../../guard';
import type { Actions, PageServerLoad } from './$types';

// ?campaign=<id> builds for my seat there, with the campaign's rules (and any homebrew it allows, picked with
// ?rules=); ?rules= picks another version or a homebrew set otherwise.
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const campaignId = event.url.searchParams.get('campaign');
	const campaign = campaignId ? await orPageError(event, campaigns.get(ctx, campaignId)) : null;
	const asked = event.url.searchParams.get('rules') ?? undefined;
	const plays = campaign && [campaign.rulesSet, ...campaign.rulesExpansions].join('+');
	const want = plays ? (asked?.startsWith(`${plays}+hb:`) ? asked : plays) : asked;
	const choices = await orPageError(
		event,
		warbands.choices(
			ctx,
			want,
			campaign ? { rules: plays!, allowed: campaign.homebrewSets } : undefined
		)
	);
	return {
		choices,
		campaign: campaign && { id: campaign.id, name: campaign.name, rules: want! },
		// A campaign whose rules are not loaded cannot have a warband built for it yet.
		rulesMissing: !!campaign && choices.picked !== want
	};
};

export const actions = {
	/**
	 * Create a warband from the new-warband list and open its builder; from a seat it takes the campaign's rules and
	 * the seat.
	 * Who: anyone signed in; with campaignId, a player seated in that campaign.
	 * In: form warbandCreate { rules, factionId, variantId?, dedication?, patronId?, name, ducatLimit?,
	 * unspentGlory?, ignoreLimits?, campaignId? }.
	 * Out: redirect to /warbands/<id>.
	 * Errors: 400 invalid, 401 unauthenticated, 404 not_found rules or seat, 409 conflict no rules or campaign ended.
	 */
	create: async (event) => {
		const made = await formAction(event, warbandCreate, (input, ctx) =>
			warbands.create(ctx, input)
		);
		if ('id' in made) redirect(303, `/warbands/${made.id}`);
		return made;
	}
} satisfies Actions;
