/**
 * Form transport for the builder: a form flattens to strings, so skills and injuries travel as lines of one text
 * field, fireteams and locations as one JSON field each, a recruit's upgrades as one `up:<id>` box each and its
 * loadout as its lines joined by commas; these turn them back before the shared schemas parse.
 */
import { z } from 'zod';
import { fighterPatch, fireteamsInput, locationsInput, recruitInput } from '#lib/schemas/warbands';
import { withJsonField } from '../../campaigns/form';

const lines = (v: unknown) =>
	typeof v === 'string'
		? v
				.split(/\r?\n/)
				.map((x) => x.trim())
				.filter(Boolean)
		: v;

export const fid = z.object({ fid: z.uuid() });

export const fighterForm = z.preprocess(
	(v) =>
		v && typeof v === 'object'
			? {
					...v,
					skills: lines((v as Record<string, unknown>).skills),
					injuries: lines((v as Record<string, unknown>).injuries)
				}
			: v,
	fighterPatch.extend(fid.shape)
);

export const fighterLine = fid.extend({ lineId: z.string().min(1).max(160) });
export const fighterUpgrade = fid.extend({ upgradeId: z.string().min(1).max(160) });
export const fighterImage = fid.extend({
	image: z.instanceof(Blob, { message: 'Pick an image file.' })
});
export const fireteamsForm = withJsonField(fireteamsInput, 'fireteams');
export const locationsForm = withJsonField(locationsInput, 'locations');
export const seatForm = z.object({
	campaignId: z.uuid('Pick a campaign.'),
	recheck: z.enum(['true']).optional()
});

export const recruitForm = z.preprocess((v) => {
	if (!v || typeof v !== 'object') return v;
	const o = v as Record<string, unknown>;
	const upgrades = Object.keys(o)
		.filter((k) => k.startsWith('up:'))
		.map((k) => k.slice(3));
	const kit = typeof o.loadout === 'string' && o.loadout ? o.loadout.split(',') : [];
	return { unitId: o.unitId, name: o.name, upgrades, kit };
}, recruitInput);
