/**
 * The first owner. While no owner exists, the app logs a one-time setup link at start (random token, only its hash
 * stored, valid one hour, single use). Visiting it creates the owner and signs them in. Nobody types a password into
 * a file.
 */
import { AppError } from '../errors';
import { db } from '../db';
import { config } from '../infra/config';
import { logger } from '../infra/logger';
import * as invitesRepo from '../repos/invites';
import * as usersRepo from '../repos/users';
import { record, type Ctx } from './audit';
import { checkPassword, createSession, limitJoin, toSessionUser } from './auth';
import { hashPassword, newToken, tokenHash } from './passwords';
import type { NewAccountInput } from '#lib/schemas/auth';

const HOUR = 60 * 60 * 1000;

export const ownerExists = () => usersRepo.anyOwner(db());

/** At start: if no owner exists, make a setup token and log its link. Returns the link, or null. */
export async function ensureSetupLink(): Promise<string | null> {
	if (await ownerExists()) return null;
	const token = newToken();
	await invitesRepo.insertSetupToken(db(), tokenHash(token), new Date(Date.now() + HOUR));
	const base = config().ORIGIN ?? 'http://localhost:3000';
	const link = `${base.replace(/\/$/, '')}/setup/${token}`;
	logger.warn(
		{ setup: true },
		`No owner yet. Open this link within one hour to create the first owner: ${link}`
	);
	return link;
}

/** Is this setup token usable? */
export async function checkSetupToken(token: string) {
	const t = await invitesRepo.findSetupToken(db(), tokenHash(token));
	return !!t && !t.usedAt && t.expiresAt > new Date() && !(await ownerExists());
}

export async function completeSetup(token: string, input: NewAccountInput, ctx: Ctx) {
	limitJoin(ctx);
	checkPassword(input.password);
	const passwordHash = await hashPassword(input.password);
	return db().transaction(async (tx) => {
		const t = await invitesRepo.lockSetupToken(tx, tokenHash(token));
		if (!t || t.usedAt || t.expiresAt <= new Date())
			throw new AppError(
				'conflict',
				'This setup link has expired or was used. Restart the app to get a new one.'
			);
		if (await usersRepo.anyOwner(tx))
			throw new AppError('conflict', 'An owner already exists. Sign in instead.');
		const user = await usersRepo.insert(tx, {
			username: input.username,
			displayName: input.displayName,
			passwordHash,
			role: 'owner'
		});
		if (!user)
			throw new AppError('invalid', 'Check the highlighted fields.', {
				username: 'That username is taken.'
			});
		await invitesRepo.useSetupToken(tx, t.id);
		const session = await createSession(tx, user.id, true, ctx);
		const actor = toSessionUser(user, tokenHash(session.token));
		await record(tx, { ...ctx, actor }, 'setup.owner_created', { type: 'user', id: user.id });
		return { session, user: actor };
	});
}
