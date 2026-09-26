import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const ADMIN_COOKIE = 'cf_admin';

function secret() {
	return env.ADMIN_PASSWORD ?? 'changeme';
}

export function adminToken() {
	return createHmac('sha256', secret()).update('campaign-master').digest('hex');
}

export function checkPassword(input: string) {
	const a = Buffer.from(input);
	const b = Buffer.from(secret());
	return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(cookie: string | undefined) {
	if (!cookie) return false;
	const a = Buffer.from(cookie);
	const b = Buffer.from(adminToken());
	return a.length === b.length && timingSafeEqual(a, b);
}
