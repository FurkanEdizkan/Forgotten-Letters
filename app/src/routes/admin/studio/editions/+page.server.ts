import { fail } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { copyEntries, createEdition, deleteEdition, editions, makeCurrent, moveWarbands, setStatus, TABLES, type EntryKind } from '$lib/server/editions';
import { recordVersion, snapshotNow } from '$lib/server/versions';
import { diff } from '$lib/rules-versions';
import type { Actions, PageServerLoad } from './$types';

/** Editions of the rules side by side: make one from another, choose the current one, move entries and warbands. */
export const load: PageServerLoad = async ({ url }) => {
	const list = await editions();
	const counts = Object.fromEntries(
		await Promise.all(list.map(async (e) => [e.id, (await db.select({ n: count() }).from(warband).where(eq(warband.edition, e.id)))[0].n] as const))
	);
	// Comparing two editions: what differs, entry by entry.
	const a = url.searchParams.get('from');
	const b = url.searchParams.get('to');
	const compare = a && b && a !== b ? { from: a, to: b, changes: diff(await snapshotNow(a), await snapshotNow(b)) } : null;
	return { editions: list.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), warbands: counts[e.id] ?? 0 })), compare };
};

const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

export const actions: Actions = {
	create: async ({ request }) => {
		const d = await request.formData();
		try {
			const id = await createEdition(str(d, 'id'), str(d, 'name'), str(d, 'basedOn') || null);
			await recordVersion(str(d, 'name') || id, 'baseline', id);
			return { created: id };
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
	},
	current: async ({ request }) => {
		await makeCurrent(str(await request.formData(), 'id'));
		return { saved: true };
	},
	status: async ({ request }) => {
		const d = await request.formData();
		const s = str(d, 'status');
		if (s === 'draft' || s === 'live' || s === 'retired') await setStatus(str(d, 'id'), s);
		return { saved: true };
	},
	/** Copy entries from one edition into another: one kind, chosen ids (one per line) or all of the kind. */
	copy: async ({ request }) => {
		const d = await request.formData();
		const kind = str(d, 'kind') as EntryKind;
		if (!(kind in TABLES)) return fail(400, { message: 'Choose what to copy.' });
		const ids = str(d, 'ids')
			.split(/\n|,/)
			.map((x) => x.trim())
			.filter(Boolean);
		const n = await copyEntries(kind, ids.length ? ids : null, str(d, 'from'), str(d, 'to'));
		await recordVersion(`Copied ${n} ${kind} from ${str(d, 'from')}`, 'house', str(d, 'to'));
		return { copied: n };
	},
	remove: async ({ request }) => {
		try {
			await deleteEdition(str(await request.formData(), 'id'));
			return { saved: true };
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
	},
	/** Move every warband on one edition to another. */
	move: async ({ request }) => {
		const d = await request.formData();
		const n = await moveWarbands(null, str(d, 'to'), str(d, 'from'));
		return { moved: n };
	}
};
