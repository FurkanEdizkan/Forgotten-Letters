/**
 * Passwords and tokens. Passwords are hashed with scrypt (node:crypto) in a versioned format, so the cost can be
 * raised later and old hashes rehashed at the next sign-in. Session, invite and setup tokens are random; only their
 * SHA-256 is stored.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const N = 2 ** 17;
const R = 8;
const P = 1;
const LEN = 64;
/** scrypt needs 128 * N * r bytes; allow room for that. */
const MAXMEM = 256 * 1024 * 1024;

function scrypt(
	password: string,
	salt: Buffer,
	len: number,
	n: number,
	r: number,
	p: number
): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scryptCb(password.normalize('NFKC'), salt, len, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
			err ? reject(err) : resolve(key)
		)
	);
}

/** `scrypt$v1$N$r$p$salt$hash`, base64url parts. */
export async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const hash = await scrypt(password, salt, LEN, N, R, P);
	return ['scrypt', 'v1', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join(
		'$'
	);
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
	const parts = (stored ?? '').split('$');
	if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
	const [n, r, p] = parts.slice(2, 5).map(Number) as [number, number, number];
	const want = Buffer.from(parts[6]!, 'base64url');
	// Only sane settings and a full-length hash: an empty or short hash must never match, and a stored hash must
	// never make the server spend unbounded memory.
	const sane =
		Number.isInteger(n) &&
		n >= 2 ** 14 &&
		n <= 2 ** 20 &&
		(n & (n - 1)) === 0 &&
		Number.isInteger(r) &&
		r >= 1 &&
		r <= 32 &&
		Number.isInteger(p) &&
		p >= 1 &&
		p <= 4;
	if (!sane || want.length !== LEN) return false;
	try {
		const got = await scrypt(password, Buffer.from(parts[5]!, 'base64url'), LEN, n, r, p);
		return timingSafeEqual(got, want);
	} catch {
		return false;
	}
}

/** A hash made with weaker settings than today's, to rehash after a successful sign-in. */
export const needsRehash = (stored: string) =>
	stored !== '' && !stored.startsWith(`scrypt$v1$${N}$${R}$${P}$`);

/** A hash that never matches, checked for unknown usernames so timing reveals nothing. */
export const DUMMY_HASH = `scrypt$v1$${N}$${R}$${P}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

/** A random token for a cookie or link; only its hash is stored. */
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

/** A readable temporary password for the owner to hand over, e.g. `ember-crow-relic-4821`. */
export function temporaryPassword() {
	const words = [
		'ash',
		'bell',
		'bone',
		'crow',
		'dirge',
		'ember',
		'flag',
		'grail',
		'iron',
		'lamp',
		'mire',
		'nail',
		'relic',
		'salt',
		'shroud',
		'thorn',
		'vigil',
		'wick',
		'hymn',
		'spade'
	];
	const pick = () => words[randomBytes(1)[0]! % words.length];
	return `${pick()}-${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}`;
}

/** The most common passwords of 10+ characters; these are refused. */
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
