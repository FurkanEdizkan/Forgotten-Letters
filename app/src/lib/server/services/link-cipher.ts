/**
 * Seat links are stored encrypted so the CM can copy them again (AES-256-GCM). The key is LINK_KEY when set, else
 * derived from the database password, so an install has nothing new to set; pg_dump backups never hold it. A link
 * that no longer decrypts (key changed, or made before 1 Nov 2026) reads as null: "old link, make a new one".
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { config } from '../infra/config';

let key: Buffer | null = null;

function linkKey() {
	if (key) return key;
	const c = config();
	const secret =
		c.LINK_KEY ?? (decodeURIComponent(new URL(c.databaseUrl).password) || c.databaseUrl);
	key = Buffer.from(hkdfSync('sha256', secret, 'forgotten-letters', 'seat-links', 32));
	return key;
}

/** `v1.iv.tag.data`, base64url parts. */
export function sealLink(token: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', linkKey(), iv);
	const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
	return ['v1', iv, cipher.getAuthTag(), data]
		.map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
		.join('.');
}

export function openLink(sealed: string | null): string | null {
	const parts = sealed?.split('.');
	if (!parts || parts.length !== 4 || parts[0] !== 'v1') return null;
	try {
		const [iv, tag, data] = parts.slice(1).map((p) => Buffer.from(p, 'base64url')) as [
			Buffer,
			Buffer,
			Buffer
		];
		const d = createDecipheriv('aes-256-gcm', linkKey(), iv);
		d.setAuthTag(tag);
		return Buffer.concat([d.update(data), d.final()]).toString('utf8');
	} catch {
		return null;
	}
}

/** Tests only: forget the cached key after changing the settings. */
export const resetLinkKey = () => (key = null);
