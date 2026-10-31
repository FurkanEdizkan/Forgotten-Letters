import { describe, expect, it } from 'vitest';
import { newCampaign, person, sql, useTestDatabase } from '../testing/db';
import { get, list, moveStage } from './campaigns';
import { approve, decline, listOpen, request, withdraw } from './join-requests';
import * as seats from './seats';

useTestDatabase();

describe('join requests', () => {
	it('one open request per person; listed and mustering only', async () => {
		const cm = await person('admin');
		const user = await person('user', { displayName: 'Vey' });
		const priv = (await newCampaign(cm, { visibility: 'private' })).campaign;
		const { campaign } = await newCampaign(cm);
		await expect(request(user.ctx(), priv.id, '')).rejects.toMatchObject({ code: 'forbidden' });
		const r = await request(user.ctx(), campaign.id, 'Brings a Trench Pilgrim band.');
		expect(r).toMatchObject({
			person: { id: user.row.id, displayName: 'Vey' },
			note: expect.any(String)
		});
		await expect(request(user.ctx(), campaign.id, '')).rejects.toMatchObject({ code: 'conflict' });
		expect((await get(user.ctx(), campaign.id)).myOpenRequest).toBe(true);
		const card = (await list(user.ctx(), { scope: 'listed', limit: 10 })).items[0]!;
		expect(card.myOpenRequest).toBe(true);
		await moveStage(cm.ctx(), campaign.id, 'active');
		const other = await person('user');
		await expect(request(other.ctx(), campaign.id, '')).rejects.toMatchObject({ code: 'conflict' });
	});
	it('the CM or a co-CM lists and approves into an empty seat; mustering only', async () => {
		const cm = await person('admin');
		const user = await person('user', { displayName: 'Vey' });
		const { campaign, seats: made } = await newCampaign(cm);
		const r = await request(user.ctx(), campaign.id, '');
		await expect(listOpen(user.ctx(), campaign.id)).rejects.toMatchObject({ code: 'forbidden' });
		expect((await listOpen(cm.ctx(), campaign.id)).map((x) => x.id)).toEqual([r.id]);
		const seat = await approve(cm.ctx(), campaign.id, r.id, made[0]!.id);
		expect(seat).toMatchObject({ name: 'Vey', player: { id: user.row.id } });
		expect(await listOpen(cm.ctx(), campaign.id)).toEqual([]);
		await expect(approve(cm.ctx(), campaign.id, r.id, made[1]!.id)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('already answered')
		});
		await expect(request(user.ctx(), campaign.id, '')).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('already hold a seat')
		});
	});
	it('approving into a taken seat or after mustering is refused', async () => {
		const cm = await person('admin');
		const a = await person('user');
		const b = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, a.row.id);
		const r = await request(b.ctx(), campaign.id, '');
		await expect(approve(cm.ctx(), campaign.id, r.id, made[0]!.id)).rejects.toMatchObject({
			code: 'conflict',
			message: 'That seat is taken.'
		});
		await moveStage(cm.ctx(), campaign.id, 'active');
		await expect(approve(cm.ctx(), campaign.id, r.id, made[1]!.id)).rejects.toMatchObject({
			code: 'conflict'
		});
	});
	it('being seated by name or by link closes the open request', async () => {
		const cm = await person('admin');
		const a = await person('user');
		const b = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await request(a.ctx(), campaign.id, '');
		await request(b.ctx(), campaign.id, '');
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, a.row.id);
		const link = await seats.makeLink(cm.ctx(), campaign.id, made[1]!.id);
		await seats.accept(link.url.split('/join/')[1]!, {}, b.ctx());
		expect(await listOpen(cm.ctx(), campaign.id)).toEqual([]);
		const rows = await sql()`select status, decided_at from campaign.join_requests`;
		expect(rows.map((r) => r.status)).toEqual(['withdrawn', 'withdrawn']);
		expect(rows.every((r) => r.decided_at)).toBe(true);
	});
	it('approving still records the request as approved', async () => {
		const cm = await person('admin');
		const a = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		const r = await request(a.ctx(), campaign.id, '');
		await approve(cm.ctx(), campaign.id, r.id, made[0]!.id);
		const [row] = await sql()`select status, decided_by from campaign.join_requests`;
		expect(row).toMatchObject({ status: 'approved', decided_by: cm.row.id });
	});
	it('decline and withdraw close the request and are audited', async () => {
		const cm = await person('admin');
		const a = await person('user');
		const b = await person('user');
		const { campaign } = await newCampaign(cm);
		const ra = await request(a.ctx(), campaign.id, '');
		await request(b.ctx(), campaign.id, '');
		await decline(cm.ctx(), campaign.id, ra.id);
		await expect(decline(cm.ctx(), campaign.id, ra.id)).rejects.toMatchObject({ code: 'conflict' });
		await withdraw(b.ctx(), campaign.id);
		await expect(withdraw(b.ctx(), campaign.id)).rejects.toMatchObject({ code: 'not_found' });
		expect(await listOpen(cm.ctx(), campaign.id)).toEqual([]);
		// A declined person may ask again.
		await expect(request(a.ctx(), campaign.id, 'Again')).resolves.toBeTruthy();
		const acts =
			await sql()`select action from auth.audit_log where action like 'request.%' order by id`;
		expect(acts.map((x) => x.action)).toEqual([
			'request.made',
			'request.made',
			'request.declined',
			'request.withdrawn',
			'request.made'
		]);
	});
});
