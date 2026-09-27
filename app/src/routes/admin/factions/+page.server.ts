import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { unit, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { listModels } from '$lib/server/models';
import { listArt, removeArt, setArt } from '$lib/server/unit-art';
import { saveImage } from '$lib/server/uploads';
import { publish } from '$lib/server/hub';
import { FACTIONS } from '$lib/rules/factions';
import { unitTypeKey } from '$lib/unit-art';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const models = (await listModels(c.id)).filter((m) => m.ownerType === 'faction');
	const pick = (kind: 'outpost' | 'figure', faction: string) => {
		const m = models.find((m) => m.kind === kind && m.ownerId === faction);
		return m ? { id: m.id, token: m.token, hasStl: !!m.stl, params: m.params } : null;
	};
	// Unit types: every type on a roster of that faction, plus any the CM has given a picture.
	const inUse = await db
		.selectDistinct({ faction: warband.faction, type: unit.type })
		.from(unit)
		.innerJoin(warband, eq(warband.id, unit.warbandId))
		.where(eq(unit.campaignId, c.id));
	const art = await listArt(c.id);
	const typesFor = (faction: string) => {
		const byKey = new Map<string, { key: string; type: string; image: string | null }>();
		for (const r of inUse) if (r.faction === faction && r.type.trim()) byKey.set(unitTypeKey(r.type), { key: unitTypeKey(r.type), type: r.type, image: null });
		for (const a of art) if (a.faction === faction) byKey.set(a.typeKey, { key: a.typeKey, type: a.type, image: a.image });
		return [...byKey.values()].sort((a, b) => a.type.localeCompare(b.type));
	};
	return {
		factions: FACTIONS.map((f) => ({
			id: f.id,
			name: f.name,
			outpost: pick('outpost', f.id),
			figure: pick('figure', f.id),
			units: typesFor(f.id)
		}))
	};
};

export const actions: Actions = {
	/** Set the default picture for a unit type in a faction. */
	art: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) error(404, 'No campaign');
		const data = await request.formData();
		const faction = String(data.get('faction'));
		const type = String(data.get('type') ?? '').trim().slice(0, 80);
		if (!FACTIONS.some((f) => f.id === faction)) return fail(400, { artMessage: 'Unknown faction', faction });
		if (!unitTypeKey(type)) return fail(400, { artMessage: 'Name the unit type', faction });
		let image: string | null;
		try {
			image = await saveImage(c.id, data.get('image'), 640);
		} catch (e) {
			return fail(400, { artMessage: (e as Error).message, faction });
		}
		if (!image) return fail(400, { artMessage: 'Choose a picture', faction });
		await setArt(c.id, faction, type, image);
		publish(c.id);
		return { artSaved: type, faction };
	},

	artRemove: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) error(404, 'No campaign');
		const data = await request.formData();
		await removeArt(c.id, String(data.get('faction')), String(data.get('key')));
		publish(c.id);
		return { faction: String(data.get('faction')) };
	}
};
