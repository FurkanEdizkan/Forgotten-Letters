/** The campaign's life, from founding to the final reckoning: pure rules shared by server and pages. */

export const STAGES = ['setup', 'mustering', 'underway', 'ended'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
	setup: 'Setup',
	mustering: 'Mustering',
	underway: 'Underway',
	ended: 'Ended'
};

export function nextStage(stage: Stage): Stage | null {
	return STAGES[STAGES.indexOf(stage) + 1] ?? null;
}

export type InviteState = 'valid' | 'used' | 'revoked' | 'expired';

/** Used beats revoked beats expired: a link someone already joined with stays "used" whatever happened after. */
export function inviteState(i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InviteState {
	if (i.usedAt) return 'used';
	if (i.revokedAt) return 'revoked';
	return i.expiresAt <= now ? 'expired' : 'valid';
}

export interface SeatFacts {
	hasAccount: boolean;
	hasWarband: boolean;
	visionOffered: boolean;
	visionChosen: boolean;
}

export type MusterStep = 'account' | 'warband' | 'vision';

/**
 * Where a seat stands in mustering. A seat is ready once it has a warband and a Vision; an account is only needed
 * to do those yourself (the Campaign Master can build a warband for a seat nobody has claimed).
 */
export function musterSteps(s: SeatFacts) {
	const ready = s.hasWarband && s.visionChosen;
	const next: MusterStep | null = ready ? null : !s.hasAccount && !s.hasWarband ? 'account' : !s.hasWarband ? 'warband' : 'vision';
	return { account: s.hasAccount, warband: s.hasWarband, vision: s.visionChosen, ready, next };
}

/** Whether mustering may end: every seat ready, or the Campaign Master's say-so with at least two warbands. */
export function canStartCampaign(seats: ReturnType<typeof musterSteps>[], override: boolean): { ok: true } | { ok: false; message: string } {
	if (seats.filter((s) => s.warband).length < 2) return { ok: false, message: 'A campaign needs at least two warbands.' };
	const waiting = seats.filter((s) => !s.ready).length;
	if (waiting && !override) return { ok: false, message: `${waiting} seat${waiting === 1 ? ' is' : 's are'} not ready yet.` };
	return { ok: true };
}

/**
 * Deal two Vision cards to every warband that has neither kept one nor been offered two, from one pack per eight
 * warbands, minus cards already kept or on offer. A warband never gets the same card twice (packs repeat cards).
 */
export function dealVisionOffers(
	warbands: { id: string; visionCard: string | null; visionOffer: string[] | null }[],
	cardIds: string[],
	random: () => number = Math.random
): Record<string, [string, string]> {
	const deck: string[] = [];
	for (let p = 0; p < Math.max(1, Math.ceil(warbands.length / 8)); p++) deck.push(...cardIds);
	for (const taken of warbands.flatMap((w) => [...(w.visionCard ? [w.visionCard] : []), ...(w.visionOffer ?? [])])) {
		const i = deck.indexOf(taken);
		if (i >= 0) deck.splice(i, 1);
	}
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	// Pair the two cards with the most copies left (the earlier in the shuffle on a tie), so duplicate copies are
	// used up first and never end the deal stranded as an identical pair.
	const count = (c: string) => deck.filter((d) => d === c).length;
	const mostLeft = (except?: string) => {
		let best: string | undefined;
		for (const c of deck) if (c !== except && (best === undefined || count(c) > count(best))) best = c;
		return best;
	};
	const deal: Record<string, [string, string]> = {};
	for (const w of warbands) {
		if (w.visionCard || w.visionOffer?.length) continue;
		const first = mostLeft();
		const second = first === undefined ? undefined : mostLeft(first);
		if (first === undefined || second === undefined) break;
		deck.splice(deck.indexOf(first), 1);
		deck.splice(deck.indexOf(second), 1);
		deal[w.id] = [first, second];
	}
	return deal;
}
