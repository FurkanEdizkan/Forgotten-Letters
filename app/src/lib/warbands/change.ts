/**
 * May a change with no check of its own be made: editing or removing a fighter, moving one to Dead or back, selling
 * kit, changing the banks or the limit, fireteams? It may leave the list unfinished (no Leader yet, a minimum not
 * met, an empty roster, a loadout still to complete), since a player builds a warband over several steps; it may
 * never newly break a maximum, an entry's or kit's rules, the ducat limit or the banks. The reasons are the
 * finished-list issues the change adds, worded as `issues` words them.
 */
import { broken } from './checks.ts';
import { issues } from './issues.ts';
import type { Resolved } from './resolve.ts';
import { no, OK, type Check, type Options, type WarbandState } from './types.ts';

/** Issue codes a change may not add. Minimums, the Leader, Patron, variant and dedication wait for the finished list. */
const HARD = new Set([
	'unknown-unit',
	'unknown-item',
	'unit',
	'kit',
	'upgrade',
	'upgrade-max',
	'elite-max',
	'cap',
	'item-limit',
	'fireteams',
	'ducat-limit',
	'bank'
]);

export function canChange(
	before: WarbandState,
	after: WarbandState,
	f: Resolved,
	opts: Options = {}
): Check {
	const strict = { ...opts, allowBeyondLimits: false };
	const errors = (s: WarbandState) =>
		issues(s, f, strict).filter((i) => i.severity === 'error' && HARD.has(i.code));
	const had = new Set(errors(before).map((i) => i.text));
	const reasons = [
		...errors(after)
			.filter((i) => !had.has(i.text))
			.map((i) => i.text.replace(/\.$/, '')),
		...broken(before, after, f, opts)
	];
	return reasons.length ? no(...new Set(reasons)) : OK;
}
