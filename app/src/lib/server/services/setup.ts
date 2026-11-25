/**
 * First-run setup, Jellyfin style: while no owner exists, setup is open to whoever opens the app (accepted risk on
 * a shared network; see the first_start view). The wizard sends everything at once; one transaction creates the
 * owner, saves the look, marks setup done and signs the owner in. A second attempt is refused. The port is not
 * chosen here: it is picked when the app starts.
 */
import { AppError } from '../errors';
import { db } from '../db';
import { logger } from '../infra/logger';
import * as settingsRepo from '../repos/settings';
import * as usersRepo from '../repos/users';
import { record, type Ctx, type SessionUser } from './audit';
import { checkPassword, createSession, limitJoin, toSessionUser, type NewSession } from './auth';
import { hashPassword, tokenHash } from './passwords';
import { forgetCachedSettings, getSettings } from './settings';
import type { SetupInput } from '#lib/schemas/settings';

const RECHECK_MS = 2000;

// The guard asks on every request, so the answer is cached: once an owner exists setup stays closed for the life of
// the process (owners are never all removed); while open, the database is asked at most every two seconds.
let closed = false;
let open = true;
let checkedAt = 0;

/** Forget the cached answer (tests, which empty the database between cases). */
export function forgetSetupState() {
	closed = false;
	open = true;
	checkedAt = 0;
}

/** Is setup open, that is, is there no owner yet? */
export async function isSetupOpen(): Promise<boolean> {
	if (closed) return false;
	if (Date.now() - checkedAt < RECHECK_MS) return open;
	const owner = await usersRepo.anyOwner(db());
	checkedAt = Date.now();
	open = !owner;
	closed = owner;
	return open;
}

/** At start: while no owner exists, log where to open the wizard. Returns the address, or null. */
export async function logSetupOpen(): Promise<string | null> {
	if (!(await isSetupOpen())) return null;
	const { address } = await getSettings();
	logger.warn(
		{ setup: true },
		`Setup is open at ${address}. Open it in a browser to create the owner.`
	);
	return address;
}

/**
 * Finish the wizard: create the first owner, save text size and accent, mark setup done and sign the owner in
 * (remembered). Anyone may call it while no owner exists; a second attempt is refused.
 */
export async function completeSetup(
	input: SetupInput,
	ctx: Ctx
): Promise<{ session: NewSession; user: SessionUser }> {
	limitJoin(ctx);
	checkPassword(input.password);
	const passwordHash = await hashPassword(input.password);
	const out = await db().transaction(async (tx) => {
		// The row lock makes parallel submits wait here; the one that comes second then sees the owner.
		await settingsRepo.lockForUpdate(tx);
		if (await usersRepo.anyOwner(tx))
			throw new AppError('conflict', 'Setup is already done. Sign in instead.');
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
		const look = { textScale: input.textScale, accent: input.accent };
		await settingsRepo.update(tx, look, user.id);
		await settingsRepo.markSetupDone(tx);
		const session = await createSession(tx, user.id, true, ctx);
		const actor = toSessionUser(user, tokenHash(session.token));
		await record(tx, { ...ctx, actor }, 'setup.owner_created', { type: 'user', id: user.id }, look);
		return { session, user: actor };
	});
	closed = true;
	open = false;
	forgetCachedSettings();
	return out;
}
