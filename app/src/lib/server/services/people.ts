/**
 * Managing people. The Owner sees every account, changes roles between Admin and User, disables, resets and
 * anonymises accounts, and hands ownership on; admins see the users they invited. A copy has exactly one Owner
 * (decision 80): the Owner is never changed, disabled or anonymised here, and ownership moves only by
 * `transferOwnership`. Every change is audited in the same transaction, and edits carry the row's version so a
 * change made meanwhile is never silently overwritten.
 */
import { can, ASSIGNABLE_ROLES, type AssignableRole, type Role } from '#lib/roles';
import { AppError } from '../errors';
import { removeWarbands as removeWarbandFiles } from './fighter-images';
import { removeAllOf as removeWarbandsOf } from './warbands';
import { removeAllOf as removeHomebrewOf } from './homebrew';
import { db } from '../db';
import * as usersRepo from '../repos/users';
import { record, type Ctx } from './audit';
import { endSessions, requireUser, signInLimiter } from './auth';
import { dropCoCmRights, rolesOf } from './campaigns';
import { hashPassword, temporaryPassword, verifyPassword } from './passwords';

/** What the people list shows (never the password hash). */
export interface Person {
	id: string;
	username: string;
	displayName: string;
	role: Role;
	disabled: boolean;
	anonymised: boolean;
	mustChangePassword: boolean;
	lastSignInAt: Date | null;
	createdAt: Date;
	version: number;
}

const toPerson = (u: usersRepo.UserRow): Person => ({
	id: u.id,
	username: u.username,
	displayName: u.displayName,
	role: u.role,
	disabled: !!u.disabledAt,
	anonymised: !!u.anonymisedAt,
	mustChangePassword: u.mustChangePassword,
	lastSignInAt: u.lastSignInAt,
	createdAt: u.createdAt,
	version: u.version
});

/** A page of people: everyone for owners, their own invitees for admins. */
export async function list(ctx: Ctx, opts: { after?: string; limit: number }) {
	const me = requireUser(ctx);
	if (!can(me, 'admin'))
		throw new AppError('forbidden', 'Only owners and Campaign Masters can see people.');
	const rows = await usersRepo.page(db(), {
		...opts,
		invitedBy: me.role === 'owner' ? undefined : me.id
	});
	const items = rows.map(toPerson);
	return { items, next: rows.length === opts.limit ? rows.at(-1)!.id : null };
}

function requireOwner(ctx: Ctx) {
	const me = requireUser(ctx);
	if (me.role !== 'owner') throw new AppError('forbidden', 'Only an owner can do that.');
	return me;
}

async function load(tx: Parameters<typeof usersRepo.findById>[0], id: string) {
	const u = await usersRepo.findById(tx, id);
	if (!u) throw new AppError('not_found', 'No such account.');
	return u;
}

/**
 * A Campaign Master stays answerable for their campaign (decision 2): someone who is CM of a campaign not ended
 * cannot lose the right to run campaigns until they hand the CM role on.
 */
async function refuseWhileCm(tx: Parameters<typeof rolesOf>[0], id: string, doing: string) {
	const names = (await rolesOf(tx, id))
		.filter((r) => r.role === 'cm' && r.stage !== 'ended')
		.map((r) => (r.deletedAt ? `${r.name} (deleted)` : r.name));
	if (names.length)
		throw new AppError(
			'conflict',
			`They are the Campaign Master of ${names.join(', ')}. Hand the CM role to someone else before you ${doing}.`
		);
}

const stale = () =>
	new AppError('conflict', 'Someone changed this account meanwhile. Reload and try again.');

/** The one Owner is never changed, disabled or anonymised; they hand ownership on first (decision 80). */
const transferFirst = () => new AppError('conflict', 'Transfer ownership first.');

/**
 * Change a person's role to Admin or User. The Owner's own role never changes here ("Ownership moves only by
 * transfer."), and nobody becomes the Owner this way.
 */
export async function changeRole(ctx: Ctx, id: string, role: AssignableRole, version: number) {
	requireOwner(ctx);
	// The schemas already refuse "owner"; this keeps the rule for any other caller.
	if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role))
		throw new AppError('invalid', 'Check the highlighted fields.', {
			role: 'Pick Campaign Master or Player. Ownership moves only by transfer.'
		});
	return db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (u.role === 'owner') throw new AppError('conflict', 'Ownership moves only by transfer.');
		if (u.role === role) return toPerson(u);
		// Users only play: becoming one drops co-CM rights, and is refused while CM of a campaign not ended.
		if (role === 'user') {
			await refuseWhileCm(tx, id, 'make them a User');
			await dropCoCmRights(tx, id);
		}
		const next = await usersRepo.update(tx, id, { role }, version);
		if (!next) throw stale();
		await record(tx, ctx, 'role.changed', { type: 'user', id }, { from: u.role, to: role });
		return toPerson(next);
	});
}

/** Disable an account (signed out everywhere, no sign-in; history stays) or enable it again. Never the Owner. */
export async function setDisabled(ctx: Ctx, id: string, disabled: boolean, version: number) {
	const me = requireOwner(ctx);
	return db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (disabled && u.role === 'owner') throw transferFirst();
		if (disabled && id === me.id)
			throw new AppError('conflict', 'You cannot disable your own account.');
		if (disabled && !u.disabledAt) await refuseWhileCm(tx, id, 'disable the account');
		const next = await usersRepo.update(
			tx,
			id,
			{ disabledAt: disabled ? new Date() : null },
			version
		);
		if (!next) throw stale();
		if (disabled) await endSessions(tx, id);
		await record(tx, ctx, disabled ? 'account.disabled' : 'account.enabled', { type: 'user', id });
		return toPerson(next);
	});
}

/** Set a temporary password that must be changed at the next sign-in; returns it once, to hand over. */
export async function resetPassword(ctx: Ctx, id: string, version: number) {
	requireOwner(ctx);
	const temporary = temporaryPassword();
	const passwordHash = await hashPassword(temporary);
	return db().transaction(async (tx) => {
		await load(tx, id);
		const next = await usersRepo.update(
			tx,
			id,
			{ passwordHash, mustChangePassword: true },
			version
		);
		if (!next) throw stale();
		await endSessions(tx, id);
		await record(tx, ctx, 'password.reset', { type: 'user', id });
		return { person: toPerson(next), temporary };
	});
}

/**
 * A disabled account's display name becomes "Former member"; its history stays. Its warbands are removed (they
 * are the person's own data, not the group's history), with their fighter images once the change is saved; so is
 * its private homebrew, while shared homebrew (and any set others still build on) stays, made by "Former member".
 */
export async function anonymise(ctx: Ctx, id: string, version: number) {
	requireOwner(ctx);
	let gone: string[] = [];
	const out = await db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (u.role === 'owner') throw transferFirst();
		if (!u.disabledAt) throw new AppError('conflict', 'Disable the account first.');
		const next = await usersRepo.update(
			tx,
			id,
			{ displayName: 'Former member', anonymisedAt: new Date() },
			version
		);
		if (!next) throw stale();
		gone = await removeWarbandsOf(tx, id);
		await removeHomebrewOf(tx, id);
		await record(tx, ctx, 'account.anonymised', { type: 'user', id }, { warbands: gone.length });
		return toPerson(next);
	});
	await removeWarbandFiles(gone);
	return out;
}

/**
 * Who could become the Owner, for the Transfer ownership panel: active accounts other than the Owner whose display
 * name or username matches, with their row version (the transfer sends it back). The Owner only.
 */
export async function ownerCandidates(ctx: Ctx, q: string) {
	const me = requireOwner(ctx);
	return usersRepo.ownerCandidates(db(), q, me.id);
}

/**
 * Hand ownership to another account (decision 80). The Owner confirms with their password, checked as when they
 * change it; a wrong one is a field error and counts towards the sign-in limit (five a minute per username and per
 * address). `to` must be another account, active (not disabled, not anonymised), at `version`. One transaction locks
 * both rows and makes the Owner an Admin before it makes `to` the Owner, so `users_one_owner` holds at every moment.
 * Nobody is signed out: the role is read on every request. Returns both people as they are now.
 */
export async function transferOwnership(
	ctx: Ctx,
	input: { to: string; password: string; version: number }
): Promise<{ from: Person; to: Person }> {
	const me = requireOwner(ctx);
	if (input.to === me.id) throw new AppError('conflict', 'You are the Owner already.');
	const keys = [`u:${me.username}`, `ip:${ctx.ip ?? '?'}`];
	const wait = signInLimiter.peek(...keys);
	if (wait)
		throw new AppError(
			'rate_limited',
			`Too many tries. Wait ${wait} seconds and try again.`,
			undefined,
			wait
		);
	const mine = await usersRepo.findById(db(), me.id);
	if (!mine || !(await verifyPassword(input.password, mine.passwordHash))) {
		signInLimiter.take(...keys);
		throw new AppError('invalid', 'Check the highlighted fields.', {
			password: 'That is not your current password.'
		});
	}
	return db().transaction(async (tx) => {
		const rows = await usersRepo.lockAll(tx, [me.id, input.to]);
		const self = rows.find((r) => r.id === me.id);
		const target = rows.find((r) => r.id === input.to);
		// Read again under the lock: a second transfer sent at the same moment finds the Owner already an Admin.
		if (self?.role !== 'owner') throw new AppError('forbidden', 'Only an owner can do that.');
		if (!target) throw new AppError('not_found', 'No such account.');
		if (target.anonymisedAt)
			throw new AppError('conflict', 'An anonymised account cannot become the Owner.');
		if (target.disabledAt)
			throw new AppError(
				'conflict',
				'A disabled account cannot become the Owner. Enable it first.'
			);
		if (target.version !== input.version) throw stale();
		const from = await usersRepo.update(tx, me.id, { role: 'admin' });
		const to = await usersRepo.update(tx, target.id, { role: 'owner' }, input.version);
		if (!from || !to) throw stale();
		await record(
			tx,
			ctx,
			'owner.transferred',
			{ type: 'user', id: target.id },
			{
				from: me.id,
				to: target.id
			}
		);
		return { from: toPerson(from), to: toPerson(to) };
	});
}
