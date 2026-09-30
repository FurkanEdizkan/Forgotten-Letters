import { MIN_PASSWORD, USERNAME, normaliseUsername } from './passwords';

/** Beyond this many waiting sign-ups the form turns people away, so a stranger can't flood the list. */
export const MAX_PENDING_SIGNUPS = 50;

export interface SignupInput {
	username: string;
	displayName: string;
	/** Optional: kept for the Campaign Master's records (and later, email resets); nothing is sent. */
	email?: string;
	password: string;
	confirm: string;
}

/** Deliberately loose: something@something.tld, no spaces. The address is only stored, never mailed. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An optional email as typed: trimmed and lowercased, null when blank, false when malformed. */
export function normaliseEmail(raw: string | undefined): string | null | false {
	const email = (raw ?? '').trim().toLowerCase();
	if (!email) return null;
	return email.length <= 254 && EMAIL.test(email) ? email : false;
}

export type SignupCheck =
	| { ok: true; value: { username: string; displayName: string | null; email: string | null; password: string } }
	| { ok: false; message: string };

/** Check a sign-up form as typed. Whether the username is free is the database's question, not this one's. */
export function checkSignup(input: SignupInput): SignupCheck {
	const username = normaliseUsername(input.username);
	if (!USERNAME.test(username))
		return {
			ok: false,
			message: 'Usernames are 2–32 lowercase letters, digits, dots, dashes or underscores, starting with a letter or digit.'
		};
	if (input.password.length < MIN_PASSWORD) return { ok: false, message: `Passwords need at least ${MIN_PASSWORD} characters.` };
	if (input.password !== input.confirm) return { ok: false, message: 'The two passwords do not match.' };
	const email = normaliseEmail(input.email);
	if (email === false) return { ok: false, message: 'That email address does not look right.' };
	const displayName = input.displayName.trim().replace(/\s+/g, ' ').slice(0, 40) || null;
	return { ok: true, value: { username, displayName, email, password: input.password } };
}
