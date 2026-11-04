/**
 * What the new-warband list offers: the loaded rules (each core version, each expansion on its base, then the
 * homebrew the person may see) and, for one rules choice, each faction with its variants, dedications (the Court's
 * Sins), starting banks and the Patrons each may serve.
 */
import { isHomebrewSet } from '#lib/rules/homebrew';
import { rulesLabel } from '#lib/rules/label';
import { mergeSets, resolveFaction } from '#lib/warbands';
import type { ApiChoices } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import type { Ctx } from './audit';
import { requireUser } from './auth';
import * as rules from './rules';

// ---------------------------------------------------------------- rules choices

/**
 * Loaded rules to build for: each core version (newest first), then each expansion whose chain reaches one (an
 * expansion on an expansion too: Preview on Carcass Front), labelled as players read them ("Trench Crusade 1.0.2
 * (Preview)").
 */
async function rulesOptions() {
	const sets = (await rules.listSets()).filter((s) => s.ok);
	const byId = new Map(sets.map((s) => [s.id, s]));
	const coreOf = (id: string | null) => {
		const seen = new Set<string>();
		let s = id ? byId.get(id) : undefined;
		while (s && s.kind !== 'core' && s.base && !seen.has(s.id)) {
			seen.add(s.id);
			s = byId.get(s.base);
		}
		return s?.kind === 'core' ? s : undefined;
	};
	const byVersion = (a: { version: string | null }, b: { version: string | null }) =>
		(b.version ?? '').localeCompare(a.version ?? '', 'en', { numeric: true });
	const label = (core: { id: string; name: string }, exp: string[] = []) =>
		`${core.name} ${rulesLabel(byId, core.id, exp).text}`;
	const cores = sets.filter((s) => s.kind === 'core').sort(byVersion);
	const out = cores.map((c) => ({ value: c.id, label: label(c) }));
	for (const e of sets.filter((s) => s.kind === 'expansion').sort(byVersion)) {
		const core = coreOf(e.base);
		if (core) out.push({ value: `${core.id}+${e.id}`, label: label(core, [e.id]) });
	}
	return out;
}

/** Every rules choice a warband of this person's may be built for or switched to: the loaded rules, then homebrew. */
export async function rulesChoices(ctx: Ctx) {
	requireUser(ctx);
	return [...(await rulesOptions()), ...(await homebrewOptions(ctx))];
}

/**
 * Homebrew to build on, after the official rules: every loaded set the person may see, as its whole chain; from a
 * campaign seat, the sets the campaign allows, on the campaign's rules.
 */
async function homebrewOptions(ctx: Ctx, campaign?: { rules: string; allowed: string[] }) {
	const sets = (await rules.sets(ctx, true)).filter((s) => s.ok && isHomebrewSet(s.id));
	const names = new Map((await rules.listSets(true)).map((s) => [s.id, s]));
	const out: { value: string; label: string }[] = [];
	for (const s of sets) {
		if (campaign && !campaign.allowed.includes(s.id.slice(3))) continue;
		const b = names.get(s.base ?? '');
		const on = b ? `${b.name} ${isHomebrewSet(b.id) ? '' : (b.version ?? '')}`.trim() : s.base;
		out.push({
			value: campaign ? `${campaign.rules}+${s.id}` : (await rules.chainOf(s.id)).join('+'),
			label: `${s.name} (homebrew on ${on})`
		});
	}
	return out;
}

/** The rules a new warband is built for: the given ones, else the newest loaded core version. */
export async function pickRules(input: { rulesSet?: string; rulesExpansions?: string[] }) {
	if (input.rulesSet)
		return { rulesSet: input.rulesSet, rulesExpansions: input.rulesExpansions ?? [] };
	const first = (await rulesOptions())[0];
	if (!first) throw new AppError('conflict', 'No rules are loaded yet. Ask an Owner to add them.');
	return { rulesSet: first.value, rulesExpansions: [] };
}

/**
 * What the new-warband wizard offers for one rules choice: the rules to pick from (the loaded versions, then the
 * homebrew the person may see; from a campaign seat, its rules and the homebrew it allows), then each faction with
 * its variants, starting Ducats and the Patrons each may serve. A homebrew pick offers the factions it makes or
 * varies (all of them for a set of items).
 */
export async function choices(
	ctx: Ctx,
	rulesValue?: string,
	campaign?: { rules: string; allowed: string[] }
): Promise<ApiChoices> {
	requireUser(ctx);
	const options = [
		...(campaign
			? (await rulesOptions()).filter((o) => o.value === campaign.rules)
			: await rulesOptions()),
		...(await homebrewOptions(ctx, campaign))
	];
	const picked =
		rulesValue && options.some((o) => o.value === rulesValue) ? rulesValue : options[0]?.value;
	if (!picked) return { rules: [], picked: '', factions: [] };
	const [core, ...exp] = picked.split('+');
	const set = await rules.rulesSetOf(core!, exp);
	const all = mergeSets(set);
	const own = set.manifest.kind === 'homebrew' ? set : null;
	const mine = (id: string) =>
		!own ||
		(!own.factions.length && !own.variants.length) ||
		own.factions.some((f) => f.id === id) ||
		own.variants.some((v) => v.faction === id);
	const playable = all.factions.filter(
		(f) => mine(f.id) && all.units.some((u) => u.owner === f.id && u.category !== 'mercenary')
	);
	return {
		rules: options,
		picked,
		factions: playable.map((fa) => {
			// A dedication's overlay (a Sin) is picked as the dedication, not offered as a variant.
			const viaDedication = new Set((fa.dedications ?? []).map((d) => d.variant));
			const variants = all.variants.filter((v) => v.faction === fa.id && !viaDedication.has(v.id));
			const patrons = Object.fromEntries(
				[undefined, ...variants.map((v) => v.id)].map((v) => [
					v ?? '',
					resolveFaction(set, fa.id, v).patrons.map((p) => ({ id: p.id, name: p.name }))
				])
			);
			return {
				id: fa.id,
				name: fa.name,
				alignment: fa.alignment,
				startDucats: fa.startDucats,
				startGlory: fa.startGlory,
				dedications: (fa.dedications ?? []).map((d) => ({ key: d.key, name: d.name })),
				variants: variants.map((v) => {
					const r = resolveFaction(set, fa.id, v.id).rules;
					return { id: v.id, name: v.name, startDucats: r.startDucats, startGlory: r.startGlory };
				}),
				patrons
			};
		})
	};
}
