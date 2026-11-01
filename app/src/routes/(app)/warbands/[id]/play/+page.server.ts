import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import * as warbands from '#lib/server/services/warbands';
import type { Item, Unit } from '#lib/rules/pack';
import { requireSignedIn } from '../../../guard';
import type { PageServerLoad } from './$types';

// Play mode reads the warband as the builder shows it, with the full profiles of its fighters' entries and kit.
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const warband = await orPageError(event, warbands.get(ctx, event.params.id));
	const set = warband.rulesExpansions.at(-1) ?? warband.rulesSet;
	const [index, els] = await Promise.all([
		orPageError(event, rules.index(ctx, set)),
		orPageError(event, rules.elements(ctx, set, ['unit', 'item']))
	]);
	const unitIds = new Set(warband.fighters.map((x) => x.unitId));
	const itemIds = new Set(warband.fighters.flatMap((x) => x.kit.map((k) => k.itemId)));
	return {
		warband,
		set,
		names: index.names,
		keywords: index.keywords,
		units: Object.fromEntries(
			els.filter((e) => e.type === 'unit' && unitIds.has(e.id)).map((e) => [e.id, e.data as Unit])
		),
		items: Object.fromEntries(
			els.filter((e) => e.type === 'item' && itemIds.has(e.id)).map((e) => [e.id, e.data as Item])
		)
	};
};
