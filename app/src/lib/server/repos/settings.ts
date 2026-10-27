/** The copy-wide settings. The only SQL for app.settings, which always holds exactly one row (id 1). */
import { eq } from 'drizzle-orm';
import type { Tx } from '../db';
import { settings, type SettingsRow } from '../db/schema';

const ONE = eq(settings.id, 1);

/** The settings row. The migration creates it, so it is always there. */
export async function get(tx: Tx): Promise<SettingsRow> {
	const [r] = await tx.select().from(settings).where(ONE);
	if (!r) throw new Error('app.settings has no row: the migrations did not run');
	return r;
}

/** The settings row, locked until the transaction ends: setup and changes run one at a time. */
export async function lockForUpdate(tx: Tx): Promise<SettingsRow> {
	const [r] = await tx.select().from(settings).where(ONE).for('update');
	if (!r) throw new Error('app.settings has no row: the migrations did not run');
	return r;
}

export type SettingsPatchRow = Partial<Pick<SettingsRow, 'textScale' | 'accent' | 'port'>>;

/** Change some settings; `userId` is who changed them. Returns the new row. */
export async function update(
	tx: Tx,
	patch: SettingsPatchRow,
	userId: string | null
): Promise<SettingsRow> {
	const [r] = await tx
		.update(settings)
		.set({ ...patch, updatedBy: userId })
		.where(ONE)
		.returning();
	return r!;
}

/** Note that the setup wizard has been finished. */
export const markSetupDone = (tx: Tx) =>
	tx.update(settings).set({ setupCompletedAt: new Date() }).where(ONE);
