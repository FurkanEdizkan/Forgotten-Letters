import { z } from 'zod';
import { formAction } from '#lib/server/http';
import * as backups from '#lib/server/services/backups';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ backups: await backups.list() });

export const actions = {
	/**
	 * Restore a backup over the current data; a dump of the current state is written first.
	 * Who: owners.
	 * In: form { name } a backup file name from the list.
	 * Out: { op: 'restore', name, safety } the name of the dump written before restoring.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found no such backup, 500 internal pg_restore failed.
	 */
	restore: (event) =>
		formAction(event, z.object({ name: z.string().min(1).max(200) }), async ({ name }, ctx) => {
			const { safety } = await backups.restore(ctx, name);
			return { op: 'restore', name, safety };
		})
} satisfies Actions;
