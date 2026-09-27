import { json } from '@sveltejs/kit';
import { builderWarband } from '$lib/server/builder';
import { roster } from '$lib/server/roster';
import type { RequestHandler } from './$types';

/** The warband as a JSON file: its settings, models and arsenal. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { w } = await builderWarband(params.id, locals.user);
	const { units, stash } = await roster(w.id);
	const body = {
		app: 'carcass-front-warband',
		version: 1,
		exportedAt: new Date().toISOString(),
		warband: {
			name: w.name,
			faction: w.faction,
			variant: w.variant,
			ducats: w.treasuryDucats,
			glory: w.treasuryGlory,
			unrestricted: w.unrestricted,
			notes: w.rosterNotes,
			lore: w.lore,
			fireteams: w.fireteams.map((t) => ({ name: t.name, members: t.members.map((id) => units.findIndex((u) => u.id === id)) }))
		},
		models: units.map(({ id: _i, warbandId: _w, campaignId: _c, sort: _s, createdAt: _t, photo: _p, ...u }) => u),
		arsenal: stash.map((s) => ({ name: s.name, kind: s.kind, cost: s.cost, currency: s.currency }))
	};
	const file = w.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'warband';
	return json(body, { headers: { 'content-disposition': `attachment; filename="${file}.json"` } });
};
