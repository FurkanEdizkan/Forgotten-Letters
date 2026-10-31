/**
 * Asking to join: anyone signed in may ask for a seat in a listed campaign while it musters (one open request at a
 * time); the CM or a co-CM approves it into an empty seat or declines it; the person may withdraw it.
 */
import type { ApiJoinRequest, ApiSeat } from '#lib/api-types';
import { joinOpen } from '#lib/campaign-stage';
import { AppError } from '../errors';
import { db } from '../db';
import * as campaignsRepo from '../repos/campaigns';
import * as requestsRepo from '../repos/join-requests';
import * as seatsRepo from '../repos/seats';
import * as usersRepo from '../repos/users';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import { access, need, toSeat } from './campaigns';
import { fill, holdsSeat, taken } from './seats';

const closed = () =>
	new AppError('conflict', 'Requests to join are open only while the campaign is mustering.');
const decided = () => new AppError('conflict', 'This request was already answered.');

const toRequest = (
	r: requestsRepo.JoinRequestRow,
	p: { displayName: string; username: string }
): ApiJoinRequest => ({
	id: r.id,
	person: { id: r.userId, displayName: p.displayName, username: p.username },
	note: r.note,
	createdAt: r.createdAt.toISOString()
});

/** Ask for a seat in a listed campaign while it musters. */
export async function request(ctx: Ctx, campaignId: string, note: string): Promise<ApiJoinRequest> {
	const me = requireUser(ctx);
	return db().transaction(async (tx) => {
		const c = await campaignsRepo.lock(tx, campaignId);
		if (!c || c.deletedAt) throw new AppError('not_found', 'No such campaign.');
		if (c.visibility !== 'listed')
			throw new AppError('forbidden', 'You can ask to join listed campaigns only.');
		if (!joinOpen(c.stage, 'request')) throw closed();
		if (await seatsRepo.seatOf(tx, campaignId, me.id)) throw holdsSeat(true);
		const r = await requestsRepo.insert(tx, { campaignId, userId: me.id, note });
		if (!r) throw new AppError('conflict', 'You already asked to join. Wait for an answer.');
		await record(tx, ctx, 'request.made', { type: 'request', id: r.id }, { campaignId });
		return toRequest(r, me);
	});
}

/** The open requests, oldest first. CM and co-CMs. */
export async function listOpen(ctx: Ctx, campaignId: string): Promise<ApiJoinRequest[]> {
	const a = await access(db(), ctx, campaignId);
	need(a, 'requests');
	return (await requestsRepo.listOpen(db(), campaignId)).map((r) => toRequest(r.request, r));
}

/** Approve a request into an empty seat. Mustering only. */
export async function approve(
	ctx: Ctx,
	campaignId: string,
	requestId: string,
	seatId: string
): Promise<ApiSeat> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'requests');
		const r = await requestsRepo.lock(tx, campaignId, requestId);
		if (!r) throw new AppError('not_found', 'No such request.');
		if (r.status !== 'open') throw decided();
		if (!joinOpen(a.c.stage, 'request')) throw closed();
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw new AppError('not_found', 'No such seat.');
		if (s.userId) throw taken();
		const u = (await usersRepo.findById(tx, r.userId))!;
		if (u.disabledAt) throw new AppError('conflict', 'That account is disabled.');
		if (await seatsRepo.seatOf(tx, campaignId, u.id)) throw holdsSeat(false);
		await fill(tx, s, u);
		await requestsRepo.decide(tx, r.id, 'approved', a.me.id);
		await record(tx, ctx, 'request.approved', { type: 'request', id: r.id }, { seatId: s.id });
		return toSeat(await seatsRepo.view(tx, s.id), true);
	});
}

/** Decline a request. CM and co-CMs. */
export async function decline(ctx: Ctx, campaignId: string, requestId: string): Promise<void> {
	await db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'requests');
		const r = await requestsRepo.lock(tx, campaignId, requestId);
		if (!r) throw new AppError('not_found', 'No such request.');
		if (r.status !== 'open') throw decided();
		await requestsRepo.decide(tx, r.id, 'declined', a.me.id);
		await record(tx, ctx, 'request.declined', { type: 'request', id: r.id });
	});
}

/** Withdraw one's own open request. */
export async function withdraw(ctx: Ctx, campaignId: string): Promise<void> {
	const me = requireUser(ctx);
	await db().transaction(async (tx) => {
		const c = await campaignsRepo.lock(tx, campaignId);
		const r = c && (await requestsRepo.findOpen(tx, campaignId, me.id));
		if (!r) throw new AppError('not_found', 'You have no open request here.');
		await requestsRepo.decide(tx, r.id, 'withdrawn', me.id);
		await record(tx, ctx, 'request.withdrawn', { type: 'request', id: r.id });
	});
}
