/**
 * Everything that makes a finished list illegal (empty when it is legal). An imported or older list never went
 * through the checks, so each fighter's kit is put on again one piece at a time, and every recruit-time rule is
 * asked again. With `allowBeyondLimits` every issue is a warning; limits that move with the warband's worth are
 * warnings once recruited (Q39 a).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (warbandIssues), rewritten to ids and the
 * rules folder format.
 */
import { capOf, kitReasons, limitCount, unitReasons, upgradeFor } from './checks.ts';
import { limitIssues, loadoutCheck, scopedLimits } from './limits.ts';
import { buildModels, carry, isElite, linesFor, type Model } from './model.ts';
import { rating } from './prices.ts';
import { excludedItem, isEl, nameOf, type Resolved } from './resolve.ts';
import type { Ctx } from './select.ts';
import { isActive, switchesOf } from './types.ts';
import type { Issue, Options, WarbandState } from './types.ts';

type Raw = Omit<Issue, 'severity'> & { warning?: boolean };

function kitIssues(m: Model, ctx: Ctx, out: Raw[]) {
	const { f } = ctx;
	const unit = m.unit.name;
	const id = m.fighter.id;
	// Fixed kit passes as it is; bought kit goes on again one piece at a time.
	let acc: Model = { ...m, items: m.items.filter((c) => c.fixed) };
	const lines = linesFor(f, m.unit);
	for (const lineId of m.fighter.kit) {
		const line = f.idx.lines.get(lineId);
		const c = line && carry(f, m.unit, line.item, false, line);
		if (!line || !c) {
			out.push({
				code: 'unknown-item',
				text: `${unit}: no armoury line "${lineId}".`,
				fighterId: id
			});
			continue;
		}
		const name = nameOf(f, line.item);
		if (!lines.includes(line)) {
			const ex = excludedItem(f, line.item);
			out.push({
				code: 'kit',
				text: `${unit}: ${name} is ${ex ? "excluded from this warband's armoury" : "not in this warband's armoury"}.`,
				fighterId: id
			});
		}
		for (const r of kitReasons(acc, c, { ...ctx, opts: { ...ctx.opts, openExploration: true } }))
			out.push({ code: 'kit', text: `${unit} with ${name}: ${r}.`, fighterId: id });
		acc = { ...acc, items: [...acc.items, c] };
	}
	const loadouts = m.unit.kit.loadouts;
	const bad =
		loadouts?.length &&
		loadoutCheck(
			m.items.map((c) => c.item.id),
			loadouts,
			true,
			(i) => nameOf(f, i)
		);
	if (bad) out.push({ code: 'loadout', text: `${unit}: ${bad}`, fighterId: id });
}

function upgradeIssues(models: Model[], f: Resolved, out: Raw[]) {
	for (const m of models)
		for (const u of m.fighter.upgrades) {
			const up = f.upgrades.find((x) => x.id === u);
			if (!up)
				out.push({
					code: 'upgrade',
					text: `${m.unit.name}: no upgrade "${nameOf(f, u)}".`,
					fighterId: m.fighter.id
				});
			else if (!upgradeFor(f, up, m.unit))
				out.push({
					code: 'upgrade',
					text: `${up.name} is only for ${(up.for ?? []).map((x) => nameOf(f, x)).join(', ')} (${m.unit.name} has it).`,
					fighterId: m.fighter.id
				});
		}
	for (const up of f.upgrades) {
		const on = models.filter((m) => m.fighter.upgrades.includes(up.id)).length;
		if (up.max != null && on > up.max)
			out.push({ code: 'upgrade-max', text: `${up.name} on ${on} models; the most is ${up.max}.` });
	}
}

function rosterIssues(models: Model[], state: WarbandState, f: Resolved, out: Raw[]) {
	const count = (unit: string) => models.filter((m) => isEl(f, unit, m.unit)).length;
	const r = f.rules;
	if (r.leader && count(r.leader) === 0 && !r.mustInclude.includes(r.leader))
		out.push({
			code: 'leader',
			text: `The warband must include its Leader (${nameOf(f, r.leader)}).`
		});
	// No "one LEADER at most" check: Q43 (a) gives a Papal States warband two. Caps keep the usual one.
	const need = new Map<string, number>();
	for (const u of r.mustInclude) need.set(u, (need.get(u) ?? 0) + 1);
	for (const u of f.units)
		if (u.availability.min > 0) need.set(u.id, Math.max(need.get(u.id) ?? 0, u.availability.min));
	for (const [u, n] of need)
		if (count(u) < n)
			out.push({ code: 'must-include', text: `The warband must include ${n} ${nameOf(f, u)}.` });
	const elites = models.filter((m) => isElite(m.fighter, m.unit)).length;
	if (elites > 6) out.push({ code: 'elite-max', text: `${elites} ELITE models; the most is 6.` });
	for (const u of new Set(models.map((m) => m.unit))) {
		const cap = capOf(f, u);
		const n = models.filter((m) => m.unit === u).length;
		if (cap != null && n > cap)
			out.push({ code: 'cap', text: `${n} ${u.name}: the limit is ${cap}.` });
	}
	const ctx: Ctx = { f, state };
	for (const l of new Map(
		f.lines.filter((x) => x.limit != null).map((x) => [x.item, x])
	).values()) {
		const n = limitCount(l, models, state, ctx);
		if (n > l.limit!)
			out.push({
				code: 'item-limit',
				text: `${n} × ${nameOf(f, l.item)}: the limit is ${l.limit}.`
			});
	}
	const p = state.patronId;
	if (r.patron && p !== r.patron)
		out.push({
			code: 'patron',
			text: `The warband must serve ${nameOf(f, r.patron)} as its Patron.`
		});
	else if (p && !f.patrons.some((x) => x.id === p))
		out.push({ code: 'patron', text: `${nameOf(f, p)} is not a Patron this warband may serve.` });
	if (f.faction.requiresVariant && !f.variant)
		out.push({ code: 'variant', text: "The warband must be one of its faction's variants." });
	const ded = f.faction.dedications ?? [];
	// A dedication that lays an overlay (a Sin) changes the list itself, so a list without one is not finished.
	if (ded.length && !ded.some((d) => d.key === state.dedication))
		out.push({
			code: 'dedication',
			text: `The warband must choose one of: ${ded.map((d) => d.name).join(', ')}.`,
			warning: !ded.some((d) => d.variant)
		});
}

function fireteamIssues(state: WarbandState, f: Resolved, out: Raw[]) {
	const on = new Set(state.fighters.filter(isActive).map((x) => x.id));
	const max = f.rules.fireteams ?? 0;
	if (state.fireteams.length > max)
		out.push({
			code: 'fireteams',
			text: `${state.fireteams.length} Fireteams; the most is ${max}.`
		});
	const seen = new Set<string>();
	for (const t of state.fireteams)
		for (const id of t) {
			if (!on.has(id))
				out.push({ code: 'fireteams', text: 'A Fireteam names a fighter not on the table.' });
			else if (seen.has(id))
				out.push({
					code: 'fireteams',
					text: 'A fighter is in more than one Fireteam.',
					fighterId: id
				});
			seen.add(id);
		}
}

export function issues(state: WarbandState, f: Resolved, options: Options = {}): Issue[] {
	const ctx: Ctx = { f, state, opts: options };
	const models = buildModels(state, f);
	const out: Raw[] = [];
	if (!models.length)
		out.push({ code: 'empty', text: 'The warband has no fighters yet.', warning: true });
	for (const x of state.fighters)
		if (!f.idx.units.has(x.unitId))
			out.push({
				code: 'unknown-unit',
				text: `No unit "${x.unitId}" in these rules.`,
				fighterId: x.id
			});
	for (const m of models)
		for (const t of unitReasons(f, m.unit))
			out.push({
				code: 'unit',
				// The old app's wording for an excluded entry, which the rules folders' legal lists expect.
				text: t.includes(' cannot include ')
					? `It cannot include ${t.split(' cannot include ')[1]}.`
					: `${t}.`,
				fighterId: m.fighter.id
			});
	rosterIssues(models, state, f, out);
	for (const m of models) kitIssues(m, ctx, out);
	upgradeIssues(models, f, out);
	const q39 = switchesOf(state, options).q39 === 'a';
	for (const i of limitIssues(models, scopedLimits(models, ctx), ctx))
		out.push({ code: 'limit', text: i.text, fighterId: i.fighterId, warning: q39 && i.moving });
	fireteamIssues(state, f, out);
	const worth = rating(state, f, options).ducats;
	if (worth > state.ducatLimit)
		out.push({
			code: 'ducat-limit',
			text: `The fighters are worth ${worth} Ducats, over the limit of ${state.ducatLimit}.`
		});
	if (state.stashDucats < 0)
		out.push({ code: 'bank', text: `The strongbox is ${-state.stashDucats} Ducats short.` });
	if (state.unspentGlory < 0)
		out.push({ code: 'bank', text: `The strongbox is ${-state.unspentGlory} Glory short.` });
	// The same problem twice (two models alike) is said once.
	const seen = new Set<string>();
	return out
		.filter((i) => !seen.has(i.text) && !!seen.add(i.text))
		.map(({ warning, ...i }) => ({
			...i,
			severity: warning || options.allowBeyondLimits ? 'warning' : 'error'
		}));
}
