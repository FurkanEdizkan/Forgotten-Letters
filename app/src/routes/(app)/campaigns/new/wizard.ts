/**
 * The campaign wizard's browser-side checks: every step is checked with the same shared zod schema the server
 * applies on Create, so a mistake shows under its field before the CM moves on. The whole input is parsed each time
 * (every field has a valid default) and the issues are kept for the step's own fields; the date-order rule only
 * runs once the rest parses, which the defaults make sure of. Pure, so it is unit-tested.
 */
import { m } from '#lib/messages';
import { campaignCreate, type HouseRule, type Kind, type Visibility } from '#lib/schemas/campaigns';

export type WizardValues = {
	name: string;
	kind: Kind;
	description: string;
	gamesPerPlayer: string;
	startsOn: string;
	endsOn: string;
	visibility: Visibility;
	seats: number;
	houseRules: HouseRule[];
};

export type FieldErrors = Record<string, string>;

export const STEPS = 6;
export const REVIEW = STEPS - 1;

/** Which step each field lives on (by its first path segment), so a server error sends the wizard back to it. */
export const STEP_OF: Record<string, number> = {
	name: 0,
	kind: 0,
	description: 0,
	gamesPerPlayer: 1,
	startsOn: 1,
	endsOn: 1,
	visibility: 1,
	seats: 2,
	houseRules: 3
};

export const blankValues = (): WizardValues => ({
	name: '',
	kind: 'carcass_front',
	description: '',
	gamesPerPlayer: '',
	startsOn: '',
	endsOn: '',
	visibility: 'listed',
	seats: 8,
	houseRules: []
});

const stepOf = (key: string) => STEP_OF[key.split('.')[0] ?? ''];

/** Every field message, keyed by its dotted path ("houseRules.2.name"), as the server keys them. */
export function allErrors(v: WizardValues): FieldErrors {
	const r = campaignCreate.safeParse(v);
	const out: FieldErrors = {};
	if (!r.success) for (const i of r.error.issues) out[i.path.map(String).join('.')] ??= i.message;
	return out;
}

/** Check one step. An empty object means the step is fine; Map and Review have no fields. */
export function checkStep(step: number, v: WizardValues): FieldErrors {
	return Object.fromEntries(Object.entries(allErrors(v)).filter(([k]) => stepOf(k) === step));
}

/** The first step with a problem, or null when every step is fine. */
export function firstBadStep(v: WizardValues) {
	const errors = allErrors(v);
	const steps = Object.keys(errors)
		.map(stepOf)
		.filter((s): s is number => s !== undefined);
	if (!steps.length) return null;
	const step = Math.min(...steps);
	return { step, errors: checkStep(step, v) };
}

/** The step to return to for a set of server field errors (the earliest one), or null. */
export function stepForFields(fields: FieldErrors) {
	const steps = Object.keys(fields)
		.map(stepOf)
		.filter((s): s is number => s !== undefined);
	return steps.length ? Math.min(...steps) : null;
}

/** The seat names the wizard will make: "Seat 1" … "Seat N". */
export const seatNames = (n: number) =>
	Array.from({ length: n }, (_, i) => m.campaigns.wizard.review.seatName(i + 1));
