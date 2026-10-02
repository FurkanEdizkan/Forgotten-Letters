import { json, text } from '@sveltejs/kit';
import { builderWarband } from '$lib/server/builder';
import { roster } from '$lib/server/roster';
import { FACTIONS } from '$lib/rules/factions';
import { toTcText } from '$lib/tc-import';
import type { RequestHandler } from './$types';

/**
 * The warband as a file: our JSON (`?format=json`, the default; it imports back with everything), or Trench
 * Companion's text layout (`?format=text`). A private list's share link (`?share=`) opens it too.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { w } = await builderWarband(params.id, locals.user, url.searchParams.get('share'));
	const { units, stash } = await roster(w.id);
	const file = w.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'warband';
	if (url.searchParams.get('format') === 'text') {
		const body = toTcText({
			name: w.name,
			faction: w.variant ?? FACTIONS.find((f) => f.id === w.faction)?.name ?? w.faction,
			patron: w.patron,
			ducats: w.treasuryDucats,
			glory: w.treasuryGlory,
			units,
			stash,
			fireteams: w.fireteams
		});
		const inline = url.searchParams.has('view');
		return text(body, { headers: { 'content-type': 'text/plain; charset=utf-8', ...(inline ? {} : { 'content-disposition': `attachment; filename="${file}.txt"` }) } });
	}
	const body = {
		app: 'carcass-front-warband',
		version: 1,
		exportedAt: new Date().toISOString(),
		warband: {
			name: w.name,
			faction: w.faction,
			variant: w.variant,
			patron: w.patron,
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
	return json(body, { headers: { 'content-disposition': `attachment; filename="${file}.json"` } });
};
