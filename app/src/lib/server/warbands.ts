import { buildGraph } from '$lib/rules/zones';
import { FACTIONS } from '$lib/rules/factions';
import { visionById } from '$lib/rules/visions';

export interface WarbandForm {
	playerName: string;
	seat: number | null;
	name: string;
	faction: string;
	variant: string | null;
	patron: string | null;
	entryZone: string;
}

/** Parse and validate the shared warband form. Returns field errors, or the values. */
export function parseWarbandForm(data: FormData, houseZones: boolean) {
	const s = (k: string) => String(data.get(k) ?? '').trim();
	const seatRaw = Number(s('seat'));
	const values: WarbandForm = {
		playerName: s('playerName'),
		seat: Number.isInteger(seatRaw) && seatRaw > 0 ? seatRaw : null,
		name: s('name'),
		faction: s('faction'),
		variant: s('variant') || null,
		patron: s('patron') || null,
		entryZone: s('entryZone')
	};
	const errors: Partial<Record<keyof WarbandForm, string>> = {};
	if (!values.playerName) errors.playerName = 'Name the player';
	if (!values.name) errors.name = 'Name the warband';
	const faction = FACTIONS.find((f) => f.id === values.faction);
	if (!faction) errors.faction = 'Choose a faction';
	else if (values.variant && !faction.variants.includes(values.variant)) values.variant = null;
	const zone = buildGraph(houseZones).zones.get(values.entryZone);
	if (zone?.type !== 'entry') errors.entryZone = 'Choose an Entry Zone';
	return { values, errors };
}

export function parseVision(data: FormData) {
	const card = String(data.get('visionCard') ?? '');
	const level = Number(data.get('visionProgress'));
	return {
		visionCard: visionById(card) ? card : null,
		visionProgress: Number.isInteger(level) ? Math.max(0, Math.min(3, level)) : 0,
		visionNotes: String(data.get('visionNotes') ?? '').trim() || null
	};
}
