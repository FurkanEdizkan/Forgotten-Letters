/**
 * Importing a Trench Companion warband into one of ours (a player's own list, or a campaign warband): from a share
 * link (fetched from Trench Companion's API), its JSON export, or its text export. The models, arsenal, banks and
 * fireteams replace the roster; every model and item is matched to the books (see `matchToBook`), and the result is
 * checked like any warband in the builder.
 */
import type { warband } from './db/schema';
import { builderInput } from './builder';
import { replaceRoster } from './roster';
import { publish } from './hub';
import { builderState } from '$lib/builder-state';
import { fromTrenchCompanion, importMismatch, trenchCompanionId, type TcImport } from '$lib/roster';
import { matchToBook, readTcExport, type MatchReport } from '$lib/tc-import';
import { readRules, warbandIssues } from '$lib/warband-rules';

export interface TcResult {
	name: string;
	models: number;
	report: MatchReport;
	/** What the builder finds wrong with the list as imported (by the books). */
	issues: string[];
}

/** The import, from a link or id (fetched) or a pasted / uploaded export (JSON or text). */
export async function readTcSource(source: { link?: string | null; text?: string | null }): Promise<TcImport> {
	const id = source.link ? trenchCompanionId(source.link) : null;
	if (id) {
		const res = await fetch(`https://synod.trench-companion.com/wp-json/synod/v1/warband/${id}`, {
			headers: { accept: 'application/json', 'user-agent': 'carcass-front-campaign-tracker' },
			signal: AbortSignal.timeout(15_000)
		});
		if (!res.ok) throw new Error(`Trench Companion answered ${res.status}. Is the warband shared publicly?`);
		return fromTrenchCompanion(await res.json());
	}
	if (source.link?.trim()) throw new Error('That is not a Trench Companion warband link or number.');
	if (!source.text?.trim()) throw new Error('Paste a Trench Companion link, or its exported warband (text or JSON).');
	return readTcExport(source.text, fromTrenchCompanion);
}

/**
 * Replace a warband's roster with an import. Refuses a list of another faction or variant unless `force`; the
 * refusal is returned (not thrown) so the page can offer to import anyway.
 */
export async function importInto(w: typeof warband.$inferSelect, imported: TcImport, { force = false } = {}): Promise<TcResult | { mismatch: string }> {
	const mismatch = importMismatch(imported, w);
	if (mismatch && !force) return { mismatch };
	const input = await builderInput(w);
	const rules = readRules(input.rulesText.faction, input.rulesText.variant, input.rulesText.overrides ?? []);
	const { imported: matched, report } = matchToBook(imported, { profiles: input.profiles, armoury: input.armoury, upgrades: rules.upgrades, leader: rules.leader, paragraphs: rules.paragraphs });
	await replaceRoster(w.campaignId, w.id, matched);
	if (w.campaignId) publish(w.campaignId);
	const after = builderState(await builderInput(w));
	return { name: imported.name, models: matched.units.length, report, issues: warbandIssues(after.state, after.rules, after.entries) };
}
