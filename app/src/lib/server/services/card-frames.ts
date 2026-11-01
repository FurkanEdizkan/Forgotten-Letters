/**
 * Fighter-card frames (step 4 revision 3): the Owner uploads one PNG per faction, variant or Sin (the Court's Sins
 * are variants a dedication lays). The card is drawn in the browser; a frame is laid over the whole card, so it must
 * be exactly the card's size. A warband's frame is its resolved variant's, else its faction's, else none (the
 * browser draws the built-in frame). Frames are the group's own art, kept in the uploads volume as `frames/<id>`.
 */
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	type CardFrameOut,
	type FrameTargetOut
} from '#lib/schemas/card-frames';
import { isHomebrewSet } from '#lib/rules/homebrew';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/card-frames';
import * as rulesRepo from '../repos/rules';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import * as files from './image-files';
import { listSets } from './rules';

const dir = () => files.uploadsDir('frames');

/** Where the browser fetches a frame; the version keys its cache, so a replaced frame is fetched again. */
export const frameUrl = (row: Pick<repo.CardFrameRow, 'id' | 'version'>) =>
	`/uploads/frames/${row.id}?v=${row.version}`;

const out = (row: repo.CardFrameRow): CardFrameOut => ({
	target: row.target,
	url: frameUrl(row),
	version: row.version,
	updatedAt: row.updatedAt.toISOString()
});

function requireOwner(ctx: Ctx) {
	const me = requireUser(ctx);
	if (me.role !== 'owner') throw new AppError('forbidden', 'Only an owner can change card frames.');
	return me;
}

/**
 * Every faction and variant in the loaded rules folders (not homebrew: D6), newest version first, with the Sins
 * (variants a faction's dedication lays) marked. Ids are shared across versions, so one frame serves them all.
 */
async function rulesTargets(): Promise<Omit<FrameTargetOut, 'frame'>[]> {
	const sets = (await listSets()).filter((s) => s.ok && !isHomebrewSet(s.id)).map((s) => s.id);
	const rows = await rulesRepo.nodesOfTypes(db(), sets, ['faction', 'variant']);
	// Later folders (newer versions, expansions) win for a shared id.
	rows.sort((a, b) => sets.indexOf(a.setId) - sets.indexOf(b.setId));
	const byId = new Map(rows.map((r) => [r.id, r]));
	const sins = new Set<string>();
	for (const r of byId.values())
		for (const d of (r.data.dedications as { variant?: string }[] | undefined) ?? [])
			if (d.variant) sins.add(d.variant);
	return [...byId.values()]
		.map((r) => ({
			id: r.id,
			name: r.name,
			kind:
				r.type === 'faction'
					? ('faction' as const)
					: sins.has(r.id)
						? ('sin' as const)
						: ('variant' as const),
			faction: r.type === 'faction' ? null : ((r.data.faction as string | undefined) ?? null)
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** The Owner's frames page: every faction with its variants and Sins under it, and the frame each has. */
export async function targets(ctx: Ctx): Promise<FrameTargetOut[]> {
	requireOwner(ctx);
	const [all, frames] = await Promise.all([rulesTargets(), repo.list(db())]);
	const frameOf = new Map(frames.map((f) => [f.target, out(f)]));
	const withFrame = (t: Omit<FrameTargetOut, 'frame'>) => ({
		...t,
		frame: frameOf.get(t.id) ?? null
	});
	const factions = all.filter((t) => t.kind === 'faction');
	const placed = new Set(factions.map((f) => f.id));
	return [
		...factions.flatMap((f) => [
			withFrame(f),
			...all.filter((t) => t.faction === f.id).map(withFrame)
		]),
		// A variant whose faction is in no loaded folder still gets a row.
		...all.filter((t) => t.kind !== 'faction' && !placed.has(t.faction ?? '')).map(withFrame)
	];
}

/** Every uploaded frame, for anyone signed in. */
export async function list(ctx: Ctx): Promise<CardFrameOut[]> {
	requireUser(ctx);
	return (await repo.list(db())).map(out);
}

const wrongSize = (w: number, h: number) =>
	new AppError(
		'invalid',
		`A frame must be a PNG of ${CARD_WIDTH}×${CARD_HEIGHT}. This file is ${w}×${h}.`,
		{ image: `Use a PNG of exactly ${CARD_WIDTH}×${CARD_HEIGHT} (download the template).` }
	);
const notPng = () =>
	new AppError('invalid', 'A frame must be a PNG (it keeps the transparent window).', {
		image: 'Use a PNG with transparency.'
	});

/** Check a frame file: a PNG of exactly the card's size, at most 2 MB. */
export function checkFrame(bytes: Uint8Array) {
	if (bytes.byteLength > files.MAX_IMAGE_BYTES) throw files.tooBig();
	const size = files.pngSize(bytes);
	if (!size) throw notPng();
	if (size.width !== CARD_WIDTH || size.height !== CARD_HEIGHT)
		throw wrongSize(size.width, size.height);
}

/** Give a faction, variant or Sin its frame, replacing any (Owner only). The file moves in once the row is saved. */
export async function setFrame(ctx: Ctx, target: string, bytes: Uint8Array): Promise<CardFrameOut> {
	const me = requireOwner(ctx);
	checkFrame(bytes);
	if (!(await rulesTargets()).some((t) => t.id === target))
		throw new AppError('not_found', 'No faction, variant or Sin with that id is loaded.');
	let file: Awaited<ReturnType<typeof files.stage>> | undefined;
	try {
		const row = await db().transaction(async (tx) => {
			const r = await repo.upsert(tx, target, me.id);
			file = await files.stage(dir(), r.id, bytes);
			await record(tx, ctx, 'card_frame.set', null, { target, version: r.version });
			return r;
		});
		await file!.commit();
		return out(row);
	} catch (e) {
		await file?.discard();
		throw e;
	}
}

/** Back to the faction's frame, or the built-in one (Owner only). */
export async function clearFrame(ctx: Ctx, target: string) {
	requireOwner(ctx);
	const row = await db().transaction(async (tx) => {
		const r = await repo.remove(tx, target);
		if (!r) throw new AppError('not_found', 'That has no frame.');
		await record(tx, ctx, 'card_frame.removed', null, { target });
		return r;
	});
	await files.removeAt(dir(), row.id);
}

/** A frame's file, for anyone signed in. */
export async function frameFile(ctx: Ctx, id: string) {
	requireUser(ctx);
	const row = await repo.byId(db(), id);
	const bytes = row && (await files.readAt(dir(), row.id));
	if (!row || !bytes) throw new AppError('not_found', 'No such frame.');
	return { bytes, version: row.version };
}

/**
 * The frame URL for a warband: its resolved variant's (a Court Sin dedication sets the variant), else its faction's,
 * else null for the built-in frame.
 */
export async function frameFor(
	tx: Tx,
	f: { faction: { id: string }; variant?: { id: string } | null }
): Promise<string | null> {
	const ids = [f.variant?.id, f.faction.id].filter((x): x is string => !!x);
	const rows = await repo.byTargets(tx, ids);
	const hit = ids.map((id) => rows.find((r) => r.target === id)).find(Boolean);
	return hit ? frameUrl(hit) : null;
}
