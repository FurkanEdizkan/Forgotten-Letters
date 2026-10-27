/**
 * The setup wizard's browser-side checks: each step is checked with the same shared zod rules the server applies on
 * Finish, so a mistake shows under its field before the person moves on. Pure, so it is unit-tested.
 */
import { m } from '#lib/messages';
import { newAccountInput } from '#lib/schemas/auth';
import { appearanceInput, port as portRule } from '#lib/schemas/settings';

export type WizardValues = {
	username: string;
	displayName: string;
	password: string;
	repeat: string;
	textScale: number;
	accent: string;
	port: string;
};

export type FieldErrors = Record<string, string>;

/** Which step each field lives on, so a server error can send the wizard back to it. */
export const STEP_OF: Record<string, number> = {
	username: 0,
	displayName: 0,
	password: 0,
	repeat: 0,
	textScale: 1,
	accent: 1,
	port: 2
};

/** The first message per field from a zod result. */
function fieldsOf(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
	const out: FieldErrors = {};
	for (const i of issues) out[String(i.path[0] ?? '')] ??= i.message;
	return out;
}

/** Check one step (0 Owner, 1 Look, 2 Server, 3 Done). An empty object means the step is fine. */
export function checkStep(step: number, v: WizardValues, portLocked: boolean): FieldErrors {
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
	if (step === 2 && !portLocked) {
		const r = portRule.safeParse(v.port);
		return r.success ? {} : { port: r.error.issues[0]?.message ?? '' };
	}
	return {};
}

/** The first step with a problem, or null when every step before Done is fine. */
export function firstBadStep(v: WizardValues, portLocked: boolean, last: number) {
	for (let i = 0; i < last; i++) {
		const errors = checkStep(i, v, portLocked);
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

/**
 * The address people open after Finish: the current one with the port typed in the wizard. Ports are 1024 and up,
 * so never a scheme's default port that a URL would drop.
 */
export function addressWithPort(address: string, port: string, portLocked: boolean) {
	try {
		const u = new URL(address);
		const p = portRule.safeParse(port);
		if (portLocked || !p.success) return u.origin;
		return `${u.protocol}//${u.hostname}:${p.data}`;
	} catch {
		return address;
	}
}
