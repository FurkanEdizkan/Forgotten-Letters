import { RESOURCE_NAMES, type Effect } from '$lib/rules/types';

/** Effect kinds the Campaign Master can record, with their editor shape. */
export const EFFECT_KINDS = [
	{ t: 'cvp', label: 'CVP (Other track)', field: 'n' },
	{ t: 'glory', label: 'Glory ±', field: 'n' },
	{ t: 'ducats', label: 'Ducats ±', field: 'n' },
	{ t: 'fill', label: 'Fill a Resource box', field: 'track' },
	{ t: 'omen', label: 'Omen of Leviathan ±', field: 'n' },
	{ t: 'apocrypha', label: 'Apocrypha ±', field: 'n' },
	{ t: 'die', label: '+1 Exploration die', field: null },
	{ t: 'reroll', label: 'Reroll 1 die', field: null },
	{ t: 'set', label: 'Set 1 die', field: null },
	{ t: 'rollMod', label: 'Scout Report (±1 to rolls)', field: null },
	{ t: 'reach2', label: 'Personnel Carrier (reach 2)', field: null },
	{ t: 'merchant', label: 'Merchant unlock for all', field: 'tier' },
	{ t: 'building', label: 'Building +1 tier', field: 'kind' },
	{ t: 'scout', label: 'Scout a zone', field: 'zone' },
	{ t: 'outpost', label: 'Raise an Outpost', field: 'zone' },
	{ t: 'note', label: 'Note', field: 'text' }
] as const;

export function blankEffect(t: Effect['t']): Effect {
	switch (t) {
		case 'cvp':
		case 'glory':
		case 'ducats':
		case 'omen':
		case 'apocrypha':
			return { t, n: 1 };
		case 'fill':
			return { t, track: 'F' };
		case 'merchant':
			return { t, tier: 5 };
		case 'building':
			return { t, kind: 'shrine' };
		case 'scout':
		case 'outpost':
			return { t, zone: '' };
		case 'note':
			return { t, text: '' };
		default:
			return { t } as Effect;
	}
}

export function describeEffect(e: Effect, zoneName: (id: string) => string = (id) => id): string {
	const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
	switch (e.t) {
		case 'cvp':
			return `${sign(e.n)} CVP`;
		case 'glory':
			return `${sign(e.n)} Glory`;
		case 'ducats':
			return `${sign(e.n)} Ducats`;
		case 'fill':
			return `+${RESOURCE_NAMES[e.track]} box`;
		case 'unfill':
			return `−${RESOURCE_NAMES[e.track]} box`;
		case 'omen':
			return `${sign(e.n)} Omen`;
		case 'apocrypha':
			return `${sign(e.n)} Apocrypha`;
		case 'die':
			return '+1 Exploration die';
		case 'reroll':
			return 'Reroll 1 die';
		case 'set':
			return 'Set 1 die';
		case 'rollMod':
			return '±1 to Exploration Rolls';
		case 'reach2':
			return 'Attack zones up to 2 away';
		case 'merchant':
			return `Glory Items up to ${e.tier} for all`;
		case 'building':
			return `${e.kind} +1 tier`;
		case 'scout':
			return `Scouted ${zoneName(e.zone)}`;
		case 'outpost':
			return `Outpost at ${zoneName(e.zone)}`;
		case 'note':
			return e.text;
	}
}
