import { describe, expect, it } from 'vitest';
import { campaignPatch } from '#lib/schemas/campaigns';
import { housekeeping } from '../jobs';
import { newCampaign, person, sql, useTestDatabase } from '../testing/db';
import {
	addCoCm,
	coCmCandidates,
	get,
	list,
	moveStage,
	remove,
	removeCoCm,
	restore,
	transfer,
	update
} from './campaigns';
import * as seats from './seats';

useTestDatabase();

const patch = (c: { name: string; visibility: string; version: number }, over = {}) =>
	campaignPatch.parse({ name: c.name, visibility: c.visibility, version: c.version, ...over });

describe('create', () => {
	it('makes the campaign, its CM row and N seats in one go, and audits it', async () => {
		const admin = await person('admin');
		const { campaign, seats: made } = await newCampaign(admin, { seats: 4 });
		expect(campaign).toMatchObject({
			stage: 'mustering',
			myRole: 'cm',
			seatsTotal: 4,
			seatsTaken: 0,
			cmName: admin.row.displayName,
			members: [{ userId: admin.row.id, role: 'cm', siteRole: 'admin' }],
			version: 1
		});
		expect(made.map((s) => s.name)).toEqual(['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4']);
		const [a] = await sql()`select actor_id from auth.audit_log where action = 'campaign.created'`;
		expect(a!.actor_id).toBe(admin.row.id);
	});
	it('Users cannot create campaigns', async () => {
		const user = await person('user');
		await expect(newCampaign(user)).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('names are unique ignoring case; nothing is left behind on a clash', async () => {
		const admin = await person('admin');
		await newCampaign(admin, { name: 'Carcass Front' });
		await expect(newCampaign(admin, { name: 'carcass front' })).rejects.toMatchObject({
			code: 'conflict',
			fields: { name: expect.any(String) }
		});
		const [n] = await sql()`select count(*)::int as n from campaign.seats`;
		expect(n!.n).toBe(3);
	});
	it('a deleted campaign frees its name; restoring then refuses (name taken)', async () => {
		const admin = await person('admin');
		const { campaign } = await newCampaign(admin, { name: 'Mud' });
		await remove(admin.ctx(), campaign.id);
		await newCampaign(admin, { name: 'MUD' });
		await expect(restore(admin.ctx(), campaign.id)).rejects.toMatchObject({ code: 'conflict' });
	});
});

describe('list and get', () => {
	it('mine, listed and deleted scopes, with key paging', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const a = (await newCampaign(cm)).campaign;
		const b = (await newCampaign(cm, { visibility: 'private' })).campaign;
		const c = (await newCampaign(cm)).campaign;
		await remove(cm.ctx(), c.id);
		expect((await list(cm.ctx(), { scope: 'mine', limit: 50 })).items.map((x) => x.id)).toEqual([
			b.id,
			a.id
		]);
		const page1 = await list(cm.ctx(), { scope: 'mine', limit: 1 });
		expect(page1.next).toBe(b.id);
		const page2 = await list(cm.ctx(), { scope: 'mine', limit: 1, after: page1.next! });
		expect(page2.items.map((x) => x.id)).toEqual([a.id]);
		expect((await list(user.ctx(), { scope: 'listed', limit: 50 })).items.map((x) => x.id)).toEqual(
			[a.id]
		);
		expect((await list(cm.ctx(), { scope: 'listed', limit: 50 })).items).toEqual([]);
		expect((await list(cm.ctx(), { scope: 'deleted', limit: 50 })).items.map((x) => x.id)).toEqual([
			c.id
		]);
		expect((await list(user.ctx(), { scope: 'deleted', limit: 50 })).items).toEqual([]);
		const owner = await person('owner');
		expect((await list(owner.ctx(), { scope: 'deleted', limit: 50 })).items).toHaveLength(1);
	});
	it('a private campaign is not found for outsiders; listed ones are readable', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const priv = (await newCampaign(cm, { visibility: 'private' })).campaign;
		const pub = (await newCampaign(cm)).campaign;
		await expect(get(user.ctx(), priv.id)).rejects.toMatchObject({ code: 'not_found' });
		await expect(get(user.ctx(), pub.id)).resolves.toMatchObject({ myRole: null, mySeat: false });
	});
	it('CM and Owners read a deleted campaign; others do not', async () => {
		const cm = await person('admin');
		const owner = await person('owner');
		const user = await person('user');
		const { campaign } = await newCampaign(cm);
		await remove(cm.ctx(), campaign.id);
		await expect(get(cm.ctx(), campaign.id)).resolves.toMatchObject({
			deletedAt: expect.any(String)
		});
		await expect(get(owner.ctx(), campaign.id)).resolves.toBeTruthy();
		await expect(get(user.ctx(), campaign.id)).rejects.toMatchObject({ code: 'not_found' });
	});
});

describe('update', () => {
	it('saves settings and bumps the version; a stale version is refused', async () => {
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm);
		const next = await update(cm.ctx(), campaign.id, patch(campaign, { description: 'Mud.' }));
		expect(next).toMatchObject({ description: 'Mud.', version: 2 });
		await expect(update(cm.ctx(), campaign.id, patch(campaign))).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('Someone else saved')
		});
	});
	it('refuses a name another campaign uses, and an ended campaign', async () => {
		const cm = await person('admin');
		const other = (await newCampaign(cm)).campaign;
		const { campaign } = await newCampaign(cm);
		await expect(
			update(cm.ctx(), campaign.id, patch(campaign, { name: other.name.toUpperCase() }))
		).rejects.toMatchObject({ code: 'conflict', fields: { name: expect.any(String) } });
		await moveStage(cm.ctx(), campaign.id, 'active');
		const done = await moveStage(cm.ctx(), campaign.id, 'ended');
		await expect(update(cm.ctx(), campaign.id, patch(done))).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('ended')
		});
	});
	it('players and outsiders may not change settings', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const { campaign } = await newCampaign(cm);
		await expect(update(user.ctx(), campaign.id, patch(campaign))).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});

describe('stages', () => {
	it('mustering -> active -> mustering -> active -> ended; ended is final', async () => {
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm);
		for (const to of ['active', 'mustering', 'active', 'ended'] as const)
			expect((await moveStage(cm.ctx(), campaign.id, to)).stage).toBe(to);
		await expect(moveStage(cm.ctx(), campaign.id, 'active')).rejects.toMatchObject({
			code: 'conflict'
		});
		const rows =
			await sql()`select detail from auth.audit_log where action = 'campaign.stage_changed'`;
		expect(rows).toHaveLength(4);
	});
	it('mustering cannot jump to ended', async () => {
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm);
		await expect(moveStage(cm.ctx(), campaign.id, 'ended')).rejects.toMatchObject({
			code: 'conflict'
		});
	});
});

describe('delete, restore and purge', () => {
	it('only the CM deletes; the CM or an Owner restores within 30 days', async () => {
		const cm = await person('admin');
		const co = await person('admin');
		const owner = await person('owner');
		const { campaign } = await newCampaign(cm);
		await addCoCm(cm.ctx(), campaign.id, co.row.id);
		await expect(remove(co.ctx(), campaign.id)).rejects.toMatchObject({ code: 'forbidden' });
		await remove(cm.ctx(), campaign.id);
		await expect(restore(owner.ctx(), campaign.id)).resolves.toMatchObject({ deletedAt: null });
		await remove(cm.ctx(), campaign.id);
		await sql()`update campaign.campaigns set deleted_at = now() - interval '31 days'`;
		await expect(restore(cm.ctx(), campaign.id)).rejects.toMatchObject({ code: 'not_found' });
	});
	it('the purge job removes campaigns deleted over 30 days ago, with their seats', async () => {
		const cm = await person('admin');
		const old = (await newCampaign(cm)).campaign;
		const recent = (await newCampaign(cm)).campaign;
		await remove(cm.ctx(), old.id);
		await remove(cm.ctx(), recent.id);
		await sql()`update campaign.campaigns set deleted_at = now() - interval '31 days' where id = ${old.id}`;
		const job = housekeeping().find((j) => j.name === 'campaign-purge')!;
		expect(job.lock).toBe(7_314_103);
		await job.run();
		const ids = await sql()`select id from campaign.campaigns`;
		expect(ids.map((r) => r.id)).toEqual([recent.id]);
		const [n] =
			await sql()`select count(*)::int as n from campaign.seats where campaign_id = ${old.id}`;
		expect(n!.n).toBe(0);
	});
	it('the purge job removes seat links expired over 30 days ago; a recent one stays', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		await seats.makeLink(cm.ctx(), campaign.id, made[1]!.id);
		await sql()`update campaign.seat_invites set expires_at = now() - interval '31 days'
			where seat_id = ${made[0]!.id}`;
		await sql()`update campaign.seat_invites set expires_at = now() - interval '1 day'
			where seat_id = ${made[1]!.id}`;
		await housekeeping()
			.find((j) => j.name === 'campaign-purge')!
			.run();
		const rows = await sql()`select seat_id from campaign.seat_invites`;
		expect(rows.map((r) => r.seat_id)).toEqual([made[1]!.id]);
	});
});

describe('co-CMs and transfer', () => {
	it('the CM adds an active Admin or Owner as co-CM; not a User', async () => {
		const cm = await person('admin');
		const admin = await person('admin', { displayName: 'Brother Ashe' });
		const user = await person('user');
		const { campaign } = await newCampaign(cm);
		expect((await coCmCandidates(cm.ctx(), campaign.id, 'ashe')).map((c) => c.id)).toEqual([
			admin.row.id
		]);
		const c = await addCoCm(cm.ctx(), campaign.id, admin.row.id);
		expect(c.members.map((m) => m.role)).toEqual(['cm', 'co_cm']);
		await expect(addCoCm(cm.ctx(), campaign.id, user.row.id)).rejects.toMatchObject({
			code: 'conflict'
		});
		await expect(addCoCm(cm.ctx(), campaign.id, admin.row.id)).rejects.toMatchObject({
			code: 'conflict'
		});
		expect(await coCmCandidates(cm.ctx(), campaign.id, 'ashe')).toEqual([]);
	});
	it('co-CMs do everything but delete, restore, co-CMs and transfer', async () => {
		const cm = await person('admin');
		const co = await person('admin');
		const other = await person('admin');
		const { campaign } = await newCampaign(cm);
		await addCoCm(cm.ctx(), campaign.id, co.row.id);
		await expect(
			update(co.ctx(), campaign.id, patch(campaign, { description: 'by co' }))
		).resolves.toMatchObject({ myRole: 'co_cm' });
		await expect(moveStage(co.ctx(), campaign.id, 'active')).resolves.toBeTruthy();
		await expect(seats.add(co.ctx(), campaign.id, 1)).resolves.toHaveLength(1);
		await expect(addCoCm(co.ctx(), campaign.id, other.row.id)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(removeCoCm(co.ctx(), campaign.id, co.row.id)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(transfer(co.ctx(), campaign.id, co.row.id)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(remove(co.ctx(), campaign.id)).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('transfer goes to a co-CM only; the old CM becomes a co-CM; an Owner may do it', async () => {
		const cm = await person('admin');
		const co = await person('admin');
		const owner = await person('owner');
		const { campaign } = await newCampaign(cm);
		await expect(transfer(cm.ctx(), campaign.id, co.row.id)).rejects.toMatchObject({
			code: 'conflict'
		});
		await addCoCm(cm.ctx(), campaign.id, co.row.id);
		const c = await transfer(cm.ctx(), campaign.id, co.row.id);
		expect(c.members).toEqual([
			expect.objectContaining({ userId: co.row.id, role: 'cm' }),
			expect.objectContaining({ userId: cm.row.id, role: 'co_cm' })
		]);
		const back = await transfer(owner.ctx(), campaign.id, cm.row.id);
		expect(back.members[0]).toMatchObject({ userId: cm.row.id, role: 'cm' });
		await removeCoCm(cm.ctx(), campaign.id, co.row.id);
		expect((await get(cm.ctx(), campaign.id)).members).toHaveLength(1);
	});
});
