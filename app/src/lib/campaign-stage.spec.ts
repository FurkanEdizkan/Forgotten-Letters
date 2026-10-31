import { describe, expect, it } from 'vitest';
import { canMove, joinOpen, nextMoves, STAGES } from './campaign-stage';

describe('campaign stages', () => {
	it('moves mustering to active, active to ended or back to mustering, and nothing out of ended', () => {
		const allowed = STAGES.flatMap((from) =>
			STAGES.filter((to) => canMove(from, to)).map((to) => `${from}>${to}`)
		);
		expect(allowed.sort()).toEqual(['active>ended', 'active>mustering', 'mustering>active']);
		expect(nextMoves('ended')).toEqual([]);
	});

	it('opens links, requests and leaving only while mustering; adding by name until the end', () => {
		for (const way of ['link', 'request', 'leave'] as const) {
			expect(joinOpen('mustering', way)).toBe(true);
			expect(joinOpen('active', way)).toBe(false);
			expect(joinOpen('ended', way)).toBe(false);
		}
		expect(joinOpen('mustering', 'by_name')).toBe(true);
		expect(joinOpen('active', 'by_name')).toBe(true);
		expect(joinOpen('ended', 'by_name')).toBe(false);
	});
});
