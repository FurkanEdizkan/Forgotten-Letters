import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const LEN = 64;

/** `scrypt$N$r$p$salt$hash`, base64url parts. */
export async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const hash = await scrypt(password, salt, LEN, { N, r: R, p: P });
	return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
	if (!stored) return false;
	const [kind, n, r, p, salt, hash] = stored.split('$');
	if (kind !== 'scrypt' || !salt || !hash) return false;
	const want = Buffer.from(hash, 'base64url');
	const got = await scrypt(password, Buffer.from(salt, 'base64url'), want.length, { N: +n, r: +r, p: +p });
	return got.length === want.length && timingSafeEqual(got, want);
}

/** A random session token for the cookie; only its hash is stored. */
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

/** A readable temporary password for the CM to hand over, e.g. `ember-crow-4821`. */
export function temporaryPassword() {
	const words = ['ash', 'bell', 'bone', 'crow', 'dirge', 'ember', 'flag', 'grail', 'iron', 'lamp', 'mire', 'nail', 'relic', 'salt', 'shroud', 'thorn', 'vigil', 'wick'];
	const pick = () => words[randomBytes(1)[0] % words.length];
	return `${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}`;
}

/**
 * Fixed-window attempt counter: at most `limit` tries per key per window.
 * In memory; a restart clears it, which is fine for a LAN app.
 */
export function rateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
	const hits = new Map<string, { count: number; reset: number }>();
	return {
		/** Record an attempt; false when the key is over its limit. */
		take(key: string) {
			const t = now();
			const h = hits.get(key);
			if (!h || h.reset <= t) {
				hits.set(key, { count: 1, reset: t + windowMs });
				return true;
			}
			h.count++;
			return h.count <= limit;
		},
		clear(key: string) {
			hits.delete(key);
		}
	};
}

export const USERNAME = /^[a-z0-9][a-z0-9_.-]{1,31}$/;
export const normaliseUsername = (u: string) => u.trim().toLowerCase();
export const MIN_PASSWORD = 8;
