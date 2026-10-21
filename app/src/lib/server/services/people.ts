/**
 * Managing people. Owners see every account and change roles, disable, reset and anonymise accounts; admins see
 * the users they invited. The last active owner is never demoted or disabled. Every change is audited in the same
 * transaction, and edits carry the row's version so two owners never silently overwrite each other.
 */
import { can, type Role } from '#lib/roles';
import { AppError } from '../errors';
import { db } from '../db';
import * as usersRepo from '../repos/users';
import { record, type Ctx } from './audit';
import { endSessions, requireUser } from './auth';
import { hashPassword, temporaryPassword } from './passwords';

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

const stale = () =>
	new AppError('conflict', 'Someone changed this account meanwhile. Reload and try again.');

export async function changeRole(ctx: Ctx, id: string, role: Role, version: number) {
	requireOwner(ctx);
	return db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (u.role === role) return toPerson(u);
		if (u.role === 'owner' && !u.disabledAt && (await usersRepo.activeOwnerCount(tx)) <= 1)
			throw new AppError('conflict', 'This is the last owner. Make someone else an owner first.');
		const next = await usersRepo.update(tx, id, { role }, version);
		if (!next) throw stale();
		await record(tx, ctx, 'role.changed', { type: 'user', id }, { from: u.role, to: role });
		return toPerson(next);
	});
}

export async function setDisabled(ctx: Ctx, id: string, disabled: boolean, version: number) {
	const me = requireOwner(ctx);
	if (disabled && id === me.id)
		throw new AppError('conflict', 'You cannot disable your own account.');
	return db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (
			disabled &&
			u.role === 'owner' &&
			!u.disabledAt &&
			(await usersRepo.activeOwnerCount(tx)) <= 1
		)
			throw new AppError('conflict', 'This is the last owner. Make someone else an owner first.');
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

/** A disabled account's display name becomes "Former member"; its history stays. */
export async function anonymise(ctx: Ctx, id: string, version: number) {
	requireOwner(ctx);
	return db().transaction(async (tx) => {
		const u = await load(tx, id);
		if (!u.disabledAt) throw new AppError('conflict', 'Disable the account first.');
		const next = await usersRepo.update(
			tx,
			id,
			{ displayName: 'Former member', anonymisedAt: new Date() },
			version
		);
		if (!next) throw stale();
		await record(tx, ctx, 'account.anonymised', { type: 'user', id });
		return toPerson(next);
	});
}
