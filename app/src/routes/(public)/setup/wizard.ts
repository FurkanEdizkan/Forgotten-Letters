/**
 * The setup wizard's browser-side checks: each step is checked with the same shared zod rules the server applies on
 * Finish, so a mistake shows under its field before the person moves on. Pure, so it is unit-tested.
 */
import { m } from '#lib/messages';
import { newAccountInput } from '#lib/schemas/auth';
import { appearanceInput } from '#lib/schemas/settings';

export type WizardValues = {
	username: string;
	displayName: string;
	password: string;
	repeat: string;
	textScale: number;
	accent: string;
};

export type FieldErrors = Record<string, string>;

/** Which step each field lives on, so a server error can send the wizard back to it. */
export const STEP_OF: Record<string, number> = {
	username: 0,
	displayName: 0,
	password: 0,
	repeat: 0,
	textScale: 1,
	accent: 1
};

/** The first message per field from a zod result. */
function fieldsOf(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
	const out: FieldErrors = {};
	for (const i of issues) out[String(i.path[0] ?? '')] ??= i.message;
	return out;
}

/** Check one step (0 Owner, 1 Look, 2 Done). An empty object means the step is fine. */
export function checkStep(step: number, v: WizardValues): FieldErrors {
	if (step === 0) {
		const r = newAccountInput.safeParse(v);
		const out = r.success ? {} : fieldsOf(r.error.issues);
		// Say how far off a short password is, not only the rule.
		if (out.password && v.password.length < 10)
			out.password = `${out.password} ${m.wizard.owner.passwordCount(v.password.length)}`;
		if (!out.password && v.repeat !== v.password) out.repeat = m.wizard.owner.repeatMismatch;
		return out;
	}
	if (step === 1) {
		const r = appearanceInput.safeParse(v);
		return r.success ? {} : fieldsOf(r.error.issues);
	}
	return {};
}

/** The first step with a problem, or null when every step before Done is fine. */
export function firstBadStep(v: WizardValues, last: number) {
	for (let i = 0; i < last; i++) {
		const errors = checkStep(i, v);
		if (Object.keys(errors).length) return { step: i, errors };
	}
	return null;
}

/** The step to return to for a set of server field errors (the earliest one), or null. */
export const stepForFields = (fields: FieldErrors) => {
	const steps = Object.keys(fields)
		.map((k) => STEP_OF[k])
		.filter((s): s is number => s !== undefined);
	return steps.length ? Math.min(...steps) : null;
};
