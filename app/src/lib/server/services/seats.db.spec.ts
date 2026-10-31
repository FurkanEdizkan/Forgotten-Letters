import { describe, expect, it } from 'vitest';
import { ctx, newCampaign, person, sql, uniqueName, useTestDatabase } from '../testing/db';
import { moveStage } from './campaigns';
import * as seats from './seats';

useTestDatabase();

const tokenOf = (url: string) => url.split('/join/')[1]!;
const account = () => ({
	username: uniqueName('player'),
	displayName: 'Sister Vey',
	password: 'mud and brass 77'
});

/** Hold the campaign row (as another transaction would) while both calls start, then let them race. */
async function racing(
	campaignId: string,
	first: () => Promise<unknown>,
	second: () => Promise<unknown>
) {
	let release!: () => void;
	let locked!: () => void;
	const held = new Promise<void>((r) => (release = r));
	const isLocked = new Promise<void>((r) => (locked = r));
	const holder = sql().begin(async (t) => {
		await t`select 1 from campaign.campaigns where id = ${campaignId} for no key update`;
		locked();
		await held;
	});
	await isLocked;
	const one = first().then(
		(v) => ({ ok: v }),
		(e) => ({ err: e })
	);
	const two = second().then(
		(v) => ({ ok: v }),
		(e) => ({ err: e })
	);
	// Wait until both are queued on the campaign lock, so the test proves the lock and not the timing.
	let queued = 0;
	for (let i = 0; i < 100 && queued < 2; i++) {
		const [w] =
			await sql()`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`;
		queued = w!.n;
		await new Promise((r) => setTimeout(r, 50));
	}
	expect(queued).toBe(2);
	release();
	await holder;
	return Promise.all([one, two]);
}

describe('seats', () => {
	it('adds seats up to 30, numbered on', async () => {
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { seats: 28 });
		const added = await seats.add(cm.ctx(), campaign.id, 2);
		expect(added.map((s) => s.name)).toEqual(['Seat 29', 'Seat 30']);
		await expect(seats.add(cm.ctx(), campaign.id, 1)).rejects.toMatchObject({ code: 'conflict' });
	});
	it('renames with a version check, frees a seat, and audits both', async () => {
		const cm = await person('admin');
		const user = await person('user', { displayName: 'Vey' });
		const { campaign, seats: made } = await newCampaign(cm);
		const s = await seats.assign(cm.ctx(), campaign.id, made[0]!.id, user.row.id);
		expect(s).toMatchObject({ name: 'Vey', player: { id: user.row.id } });
		const renamed = await seats.update(cm.ctx(), campaign.id, s.id, {
			version: s.version,
			name: 'Left flank'
		});
		expect(renamed.name).toBe('Left flank');
		await expect(
			seats.update(cm.ctx(), campaign.id, s.id, { version: s.version, name: 'x' })
		).rejects.toMatchObject({ code: 'conflict' });
		const freed = await seats.update(cm.ctx(), campaign.id, s.id, {
			version: renamed.version,
			free: true
		});
		expect(freed).toMatchObject({ player: null, joinedAt: null, name: 'Left flank' });
		const acts =
			await sql()`select action from auth.audit_log where action like 'seat.%' order by id`;
		expect(acts.map((a) => a.action)).toEqual(['seat.assigned', 'seat.renamed', 'seat.freed']);
	});
	it('removes only empty seats, and keeps at least 2', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, user.row.id);
		await expect(seats.remove(cm.ctx(), campaign.id, made[0]!.id)).rejects.toMatchObject({
			code: 'conflict',
			message: 'That seat is taken.'
		});
		await seats.remove(cm.ctx(), campaign.id, made[2]!.id);
		await expect(seats.remove(cm.ctx(), campaign.id, made[1]!.id)).rejects.toMatchObject({
			code: 'conflict'
		});
		expect(await seats.list(cm.ctx(), campaign.id)).toHaveLength(2);
	});
	it('outsiders of a listed campaign see seats without players; players see them', async () => {
		const cm = await person('admin');
		const player = await person('user', { displayName: 'Vey' });
		const outsider = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, player.row.id);
		expect((await seats.list(outsider.ctx(), campaign.id))[0]).toMatchObject({
			name: 'Seat 1',
			player: null,
			joinedAt: expect.any(String)
		});
		expect((await seats.list(player.ctx(), campaign.id))[0]).toMatchObject({
			name: 'Vey',
			player: { displayName: 'Vey' }
		});
	});
	it('players and outsiders may not manage seats', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await expect(seats.add(user.ctx(), campaign.id, 1)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(seats.makeLink(user.ctx(), campaign.id, made[0]!.id)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});

describe('add by name and leaving', () => {
	it('one seat per person; a taken seat is refused; works while active, not when ended', async () => {
		const cm = await person('admin');
		const a = await person('user', { displayName: 'Ana' });
		const b = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		expect((await seats.candidates(cm.ctx(), campaign.id, 'ana')).map((c) => c.id)).toEqual([
			a.row.id
		]);
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, a.row.id);
		expect(await seats.candidates(cm.ctx(), campaign.id, 'ana')).toEqual([]);
		await expect(seats.assign(cm.ctx(), campaign.id, made[1]!.id, a.row.id)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('already holds a seat')
		});
		await expect(seats.assign(cm.ctx(), campaign.id, made[0]!.id, b.row.id)).rejects.toMatchObject({
			code: 'conflict',
			message: 'That seat is taken.'
		});
		await moveStage(cm.ctx(), campaign.id, 'active');
		await expect(seats.assign(cm.ctx(), campaign.id, made[1]!.id, b.row.id)).resolves.toBeTruthy();
		await moveStage(cm.ctx(), campaign.id, 'ended');
		await expect(seats.assign(cm.ctx(), campaign.id, made[2]!.id, cm.row.id)).rejects.toMatchObject(
			{
				code: 'conflict'
			}
		);
	});
	it('a player leaves while mustering; the seat gets its default name back', async () => {
		const cm = await person('admin');
		const p = await person('user', { displayName: 'Vey' });
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.assign(cm.ctx(), campaign.id, made[0]!.id, p.row.id);
		await moveStage(cm.ctx(), campaign.id, 'active');
		await expect(seats.leave(p.ctx(), campaign.id)).rejects.toMatchObject({ code: 'conflict' });
		await moveStage(cm.ctx(), campaign.id, 'mustering');
		await seats.leave(p.ctx(), campaign.id);
		expect((await seats.list(cm.ctx(), campaign.id))[0]).toMatchObject({
			name: 'Seat 1',
			player: null
		});
		await expect(seats.leave(p.ctx(), campaign.id)).rejects.toMatchObject({ code: 'not_found' });
	});
});

describe('seat links', () => {
	it('a new link revokes the open one; a taken seat refuses new links', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		const first = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		expect(first.url).toMatch(/\/join\/[\w-]+$/);
		const second = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		expect(await seats.preview(tokenOf(first.url))).toMatchObject({ state: 'revoked' });
		expect(await seats.preview(tokenOf(second.url))).toMatchObject({
			state: 'open',
			seatName: 'Seat 1',
			campaign: { id: campaign.id, cmName: cm.row.displayName }
		});
		expect((await seats.list(cm.ctx(), campaign.id))[0]!.hasOpenLink).toBe(true);
		const visitor = ctx();
		await seats.accept(tokenOf(second.url), account(), visitor);
		await expect(seats.makeLink(cm.ctx(), campaign.id, made[0]!.id)).rejects.toMatchObject({
			code: 'conflict',
			message: 'That seat is taken.'
		});
	});
	it('make all links covers every empty seat; links work only while mustering', async () => {
		const cm = await person('admin');
		const user = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		await seats.assign(cm.ctx(), campaign.id, made[1]!.id, user.row.id);
		const links = await seats.makeAllLinks(cm.ctx(), campaign.id);
		expect(links.map((l) => l.seatId)).toEqual([made[0]!.id, made[2]!.id]);
		await moveStage(cm.ctx(), campaign.id, 'active');
		await expect(seats.makeAllLinks(cm.ctx(), campaign.id)).rejects.toMatchObject({
			code: 'conflict'
		});
		await expect(seats.accept(tokenOf(links[0]!.url), account(), ctx())).rejects.toMatchObject({
			code: 'conflict'
		});
	});
	it('revoking a link stops it', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		const link = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		await seats.revokeLink(cm.ctx(), campaign.id, made[0]!.id);
		await expect(seats.accept(tokenOf(link.url), account(), ctx())).rejects.toMatchObject({
			code: 'not_found'
		});
	});
	it('a visitor makes an account and takes the seat (renamed to them), signed in', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		const link = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		const r = await seats.accept(tokenOf(link.url), account(), ctx());
		expect(r).toMatchObject({
			campaignId: campaign.id,
			session: { token: expect.any(String) },
			user: { role: 'user', displayName: 'Sister Vey' }
		});
		expect((await seats.list(cm.ctx(), campaign.id))[0]).toMatchObject({
			name: 'Sister Vey',
			player: { id: r.user!.id },
			hasOpenLink: false
		});
		await expect(seats.accept(tokenOf(link.url), account(), ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('already used')
		});
	});
	it('signed in takes the seat with {}; a second seat is refused; a renamed seat keeps its name', async () => {
		const cm = await person('admin');
		const p = await person('user');
		const { campaign, seats: made } = await newCampaign(cm);
		const s = (await seats.list(cm.ctx(), campaign.id))[0]!;
		await seats.update(cm.ctx(), campaign.id, s.id, { version: s.version, name: 'Vanguard' });
		const one = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		const two = await seats.makeLink(cm.ctx(), campaign.id, made[1]!.id);
		await expect(seats.accept(tokenOf(one.url), {}, p.ctx())).resolves.toMatchObject({
			session: null,
			user: null
		});
		expect((await seats.list(cm.ctx(), campaign.id))[0]!.name).toBe('Vanguard');
		await expect(seats.accept(tokenOf(two.url), {}, p.ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: 'You already hold a seat in this campaign.'
		});
	});
	it('expired, unknown and username-taken links fail cleanly; a visitor must send an account', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		const link = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
		await expect(seats.accept(tokenOf(link.url), {}, ctx())).rejects.toMatchObject({
			code: 'unauthenticated'
		});
		await expect(
			seats.accept(tokenOf(link.url), { ...account(), username: cm.row.username }, ctx())
		).rejects.toMatchObject({ code: 'invalid', fields: { username: expect.any(String) } });
		await sql()`update campaign.seat_invites set expires_at = now() - interval '1 minute'`;
		expect(await seats.preview(tokenOf(link.url))).toMatchObject({ state: 'expired' });
		await expect(seats.accept(tokenOf(link.url), account(), ctx())).rejects.toMatchObject({
			code: 'not_found',
			message: expect.stringContaining('expired')
		});
		expect(await seats.preview('nope')).toEqual({ state: 'unknown' });
	});
	it('two people accepting one link at once: exactly one wins', async () => {
		const cm = await person('admin');
		const { campaign, seats: made } = await newCampaign(cm);
		const token = tokenOf((await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id)).url);
		const [a, b] = await racing(
			campaign.id,
			() => seats.accept(token, account(), ctx()),
			() => seats.accept(token, account(), ctx())
		);
		const results = [a, b];
		expect(results.filter((r) => 'ok' in r)).toHaveLength(1);
		expect(results.filter((r) => 'err' in r).map((r) => ('err' in r ? r.err.code : ''))).toEqual([
			'conflict'
		]);
		const [n] =
			await sql()`select count(user_id)::int as n from campaign.seats where campaign_id = ${campaign.id}`;
		expect(n!.n).toBe(1);
		const [users] = await sql()`select count(*)::int as n from auth.users where role = 'user'`;
		expect(users!.n).toBe(1);
	});
});
