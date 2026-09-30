import { MIN_PASSWORD, USERNAME, normaliseUsername } from './passwords';

/** Beyond this many waiting sign-ups the form turns people away, so a stranger can't flood the list. */
export const MAX_PENDING_SIGNUPS = 50;

export interface SignupInput {
	username: string;
	displayName: string;
	password: string;
	confirm: string;
}

export type SignupCheck =
	| { ok: true; value: { username: string; displayName: string | null; password: string } }
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
	const displayName = input.displayName.trim().replace(/\s+/g, ' ').slice(0, 40) || null;
	return { ok: true, value: { username, displayName, password: input.password } };
}
