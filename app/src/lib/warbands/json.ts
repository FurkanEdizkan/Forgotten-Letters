/**
 * JSON both ways: our own versioned export (`forgotten-letters-warband`, version 1: the state as stored, checked
 * with zod on the way in), and Trench Companion's JSON (the `warband_data` behind a share link), read by name and
 * matched to the rules set like its text export.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/roster.ts (fromOwnExport, fromTrenchCompanion), rewritten to
 * ids and the rules folder format.
 */
import { matchNamed, type Named, type NamedFighter } from './match.ts';
import type { SetWithBase } from './resolve.ts';
import { warbandStateSchema, type WarbandState } from './types.ts';

export const JSON_APP = 'forgotten-letters-warband';
export const JSON_VERSION = 1;

export const toJson = (state: WarbandState) =>
	JSON.stringify({ app: JSON_APP, version: JSON_VERSION, warband: state }, null, '\t');

/** Our own export read back: the warband, or why it is not one. */
export function fromJson(
	text: string
): { ok: true; state: WarbandState } | { ok: false; error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'That is not JSON.' };
	}
	const o = raw as { app?: unknown; version?: unknown; warband?: unknown };
	if (o?.app !== JSON_APP)
		return { ok: false, error: 'That is not a Forgotten Letters warband export.' };
	if (o.version !== JSON_VERSION)
		return { ok: false, error: `Export version ${String(o.version)} is not supported.` };
	const r = warbandStateSchema.safeParse(o.warband);
	return r.success
		? { ok: true, state: r.data }
		: {
				ok: false,
				error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
			};
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Trench Companion's JSON has no published schema. */
const str = (v: any) => (v == null ? '' : String(v));
/** "fc_iron_sultanate" or "md_heretic_trooper": an id made readable when the name is missing. */
const humanise = (id: string) =>
	id
		.replace(/^[a-z]{2}_/, '')
		.split(/[_-]/)
		.filter(Boolean)
		.map((w) => w[0]!.toUpperCase() + w.slice(1))
		.join(' ');
const refName = (u: any) => str(u?.name ?? u?.object_name ?? humanise(str(u?.id ?? u?.object_id)));

/** `fc_cultoftheblackgrail_fv_dirgeofthegreathegemon`: the variant's run-together name, else the faction's. */
function factionName(f: any): string | undefined {
	if (f?.name) return str(f.name);
	const id = str(f?.faction_property?.object_id).replace(/^fc_/, '');
	const [base, variant] = id.split('_fv_');
	return variant || base || undefined;
}

/** Trench Companion's JSON as names: models, kit, upgrades, skills, injuries, banks, stash, fireteams. */
export function parseTcJson(raw: unknown): Named {
	const outer = raw as { warband_data?: string } & Record<string, unknown>;
	const w = (
		typeof outer?.warband_data === 'string' ? JSON.parse(outer.warband_data) : outer
	) as any;
	if (!w || !Array.isArray(w.models)) throw new Error('That is not a Trench Companion warband.');
	const item = (e: any) => str(e?.equipment?.name ?? humanise(str(e?.equipment?.id ?? 'item')));
	const ids: unknown[] = [];
	const fighters: NamedFighter[] = w.models.map((entry: any) => {
		const m = entry?.model ?? {};
		const rel = entry?.purchase?.custom_rel ?? {};
		const unit = str(m.name ?? humanise(str(m.model ?? 'model')));
		ids.push(entry?.purchase?.purchaseid ?? m.id);
		const dead = m.active && m.active !== 'active' && !/retir/i.test(str(m.active));
		return {
			unit,
			name: m.custom_name ?? m.nickname ?? undefined,
			group: dead ? 'dead' : rel.mercenary ? 'mercenary' : m.elite ? 'elite' : 'troop',
			kit: (m.equipment ?? []).map(item),
			upgrades: (m.list_upgrades ?? []).map((u: any) =>
				str(u?.purchase?.custom_rel?.name ?? refName(u))
			),
			skills: (m.list_skills ?? []).map(refName),
			injuries: (m.list_injury ?? []).map(refName),
			xp: Number(m.experience) || 0
		};
	});
	const fireteams = (Array.isArray(w.fireteams) ? w.fireteams : [])
		.map((t: any) =>
			(t?.selections ?? [])
				.map((s: any) => ids.indexOf(s?.selection_ID))
				.filter((i: number) => i >= 0)
		)
		.filter((t: number[]) => t.length >= 2)
		.map((t: number[]) => [t[0], t[1]] as [number, number]);
	return {
		name: str(w.name) || undefined,
		faction: factionName(w.faction),
		ducats: Number(w.ducat_bank) || 0,
		glory: Number(w.glory_bank) || 0,
		fighters,
		stash: (w.equipment ?? []).map(item),
		fireteams,
		locations: []
	};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A Trench Companion JSON export as a warband of this rules set; what does not match is reported. */
export const fromTcJson = (
	raw: unknown,
	set: SetWithBase,
	into?: { factionId: string; variantId?: string }
) => matchNamed(parseTcJson(raw), set, into);
