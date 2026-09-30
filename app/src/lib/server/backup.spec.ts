import { describe, expect, it } from 'vitest';
import { revive } from './backup';

describe('revive', () => {
	it('turns every …At field back into a Date, whatever table it came from', () => {
		const iso = '2026-09-30T12:00:00.000Z';
		const row = revive<Record<string, unknown>>({ name: 'Alric', lastSeenAt: iso, closedAt: iso, expiresAt: iso, usedAt: null, createdAt: iso });
		for (const k of ['lastSeenAt', 'closedAt', 'expiresAt', 'createdAt']) expect(row[k], k).toEqual(new Date(iso));
		expect(row.usedAt).toBe(null);
		expect(row.name).toBe('Alric');
	});
});
