/**
 * How strong a new password is. Pure, so the meter under a password field and the server's `password` schema judge
 * with the same rule: only Strong and Very strong are accepted. Never used at sign-in.
 */

/** The most common passwords of 10+ characters; refused outright. */
export const COMMON_PASSWORDS = new Set([
	'1234567890',
	'0123456789',
	'12345678910',
	'1234567891',
	'0987654321',
	'1111111111',
	'0000000000',
	'qwertyuiop',
	'1q2w3e4r5t',
	'1qaz2wsx3edc',
	'password12',
	'password123',
	'password1234',
	'passw0rd123',
	'iloveyou12',
	'qwerty1234',
	'qwerty12345',
	'qwerty123456',
	'abcdefghij',
	'abc1234567',
	'aaaaaaaaaa',
	'football12',
	'baseball12',
	'princess12',
	'sunshine12',
	'letmein123',
	'welcome123',
	'trustno1234',
	'administrator',
	'changeme123',
	'trenchcrusade',
	'forgottenletters'
]);

export const isCommonPassword = (p: string) => COMMON_PASSWORDS.has(p.toLowerCase());

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** 0 too common, 1 weak, 2 fair, 3 strong, 4 very strong. */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;
/** The lowest level a new password may have. */
export const STRENGTH_NEEDED: StrengthLevel = 3;

/**
 * Estimated bits of guessing work: each character is worth log2 of the alphabet it draws from, except a character
 * that repeats or continues a run from the one before (aaa, abc, 321), which is worth one bit.
 * ponytail: no dictionary beyond COMMON_PASSWORDS, so a long run of plain words still scores well; swap in
 * zxcvbn-ts if that ever matters.
 */
export function passwordBits(p: string) {
	let pool = 0;
	if (/[a-z]/.test(p)) pool += 26;
	if (/[A-Z]/.test(p)) pool += 26;
	if (/[0-9]/.test(p)) pool += 10;
	if (/[^a-zA-Z0-9]/.test(p)) pool += 33;
	if (!pool) return 0;
	const each = Math.log2(pool);
	let bits = 0;
	for (let i = 0; i < p.length; i++) {
		const step = i ? p.charCodeAt(i) - p.charCodeAt(i - 1) : 99;
		bits += Math.abs(step) <= 1 ? 1 : each;
	}
	return bits;
}

export function passwordStrength(p: string): StrengthLevel {
	if (isCommonPassword(p)) return 0;
	const bits = passwordBits(p);
	if (bits >= 80) return 4;
	if (bits >= 60) return 3;
	if (bits >= 40) return 2;
	return 1;
}

/** The field message for a password that may not be set, or null when it is fine. */
export function passwordProblem(p: string): string | null {
	if (p.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
	if (p.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
	const level = passwordStrength(p);
	if (level === 0) return 'That password is too common. Choose another.';
	if (level < STRENGTH_NEEDED)
		return 'Not strong enough yet. Make it longer, or mix in capitals, digits or symbols.';
	return null;
}
