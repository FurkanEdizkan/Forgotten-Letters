import { describe, expect, it } from 'vitest';
import { STAGES, canStartCampaign, dealVisionOffers, inviteState, musterSteps, nextStage } from './campaign-flow';

describe('stages', () => {
	it('run setup → mustering → underway → ended, and stop at the end', () => {
		expect(STAGES).toEqual(['setup', 'mustering', 'underway', 'ended']);
		expect(nextStage('setup')).toBe('mustering');
		expect(nextStage('mustering')).toBe('underway');
		expect(nextStage('ended')).toBe(null);
	});
});

describe('inviteState', () => {
	const now = new Date('2026-10-01T12:00:00Z');
	const base = { usedAt: null, revokedAt: null, expiresAt: new Date('2026-10-05T00:00:00Z') };
	it('is valid until used, revoked or expired, in that order of precedence', () => {
		expect(inviteState(base, now)).toBe('valid');
		expect(inviteState({ ...base, usedAt: now, revokedAt: now }, now)).toBe('used');
		expect(inviteState({ ...base, revokedAt: now }, now)).toBe('revoked');
		expect(inviteState({ ...base, expiresAt: now }, now)).toBe('expired');
	});
});

describe('mustering', () => {
	const seat = { hasAccount: true, hasWarband: true, visionOffered: true, visionChosen: true };
	it("lists a seat's steps and whether it is ready", () => {
		expect(musterSteps({ ...seat, hasWarband: false, visionChosen: false })).toEqual({
			account: true,
			warband: false,
			vision: false,
			ready: false,
			next: 'warband'
		});
		expect(musterSteps(seat)).toMatchObject({ ready: true, next: null });
	});
	it('a seat nobody plays yet waits for an account first; a warband the CM made counts even without one', () => {
		expect(musterSteps({ hasAccount: false, hasWarband: false, visionOffered: false, visionChosen: false }).next).toBe('account');
		expect(musterSteps({ ...seat, hasAccount: false }).ready).toBe(true);
	});
	it('starts once every seat is ready, or when the Campaign Master overrides with at least two warbands', () => {
		const ready = musterSteps(seat);
		const notYet = musterSteps({ ...seat, visionChosen: false });
		expect(canStartCampaign([ready, ready], false)).toEqual({ ok: true });
		expect(canStartCampaign([ready, notYet], false)).toEqual({ ok: false, message: '1 seat is not ready yet.' });
		expect(canStartCampaign([ready, notYet], true)).toEqual({ ok: true });
		expect(canStartCampaign([ready], true)).toEqual({ ok: false, message: 'A campaign needs at least two warbands.' });
	});
});

describe('dealVisionOffers', () => {
	const cards = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
	const first = () => 0; // always takes the first remaining card: deterministic
	it('gives two different cards to each warband that has neither a Vision nor an offer', () => {
		const deal = dealVisionOffers(
			[
				{ id: 'w1', visionCard: null, visionOffer: null },
				{ id: 'w2', visionCard: 'a', visionOffer: null },
				{ id: 'w3', visionCard: null, visionOffer: ['b', 'c'] },
				{ id: 'w4', visionCard: null, visionOffer: null }
			],
			cards,
			first
		);
		expect(Object.keys(deal)).toEqual(['w1', 'w4']);
		// a is kept, b and c are on offer: d, e, f and g remain in the one pack.
		expect([...deal.w1, ...deal.w4].sort()).toEqual(['d', 'e', 'f', 'g']);
	});
	it('deals only while the deck lasts', () => {
		const deal = dealVisionOffers(
			[
				{ id: 'w1', visionCard: 'a', visionOffer: null },
				{ id: 'w2', visionCard: null, visionOffer: null },
				{ id: 'w3', visionCard: null, visionOffer: null }
			],
			['a', 'b', 'c', 'd'],
			first
		);
		expect(Object.keys(deal)).toEqual(['w2']);
	});
	it('never strands a pair of identical cards: whatever the shuffle, it deals as many warbands as the deck allows', () => {
		// Two packs of a, b, c: six cards, each twice. Three distinct pairs always exist (ab, ac, bc).
		const nine = Array.from({ length: 9 }, (_, i) => ({ id: `w${i}`, visionCard: null, visionOffer: null }));
		for (let seed = 1; seed <= 200; seed++) {
			let x = seed;
			const rng = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
			const deal = dealVisionOffers(nine, ['a', 'b', 'c'], rng);
			expect(Object.keys(deal).length, `seed ${seed}`).toBe(3);
			for (const [a, b] of Object.values(deal)) expect(a).not.toBe(b);
		}
	});
	it('adds a pack for every eight warbands, and never gives one warband the same card twice', () => {
		const many = Array.from({ length: 9 }, (_, i) => ({ id: `w${i}`, visionCard: null, visionOffer: null }));
		const deal = dealVisionOffers(many, cards, Math.random);
		expect(Object.keys(deal)).toHaveLength(7); // 2 packs × 7 cards = 14 cards → 7 warbands
		for (const [a, b] of Object.values(deal)) expect(a).not.toBe(b);
	});
});
